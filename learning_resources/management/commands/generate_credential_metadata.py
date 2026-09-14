"""Management command for pre-populating credential metadata"""

from django.core.management import BaseCommand

from learning_resources.tasks import (
    credential_metadata_resource_ids,
    generate_all_credential_metadata,
)
from main import settings
from main.utils import now_in_utc


class Command(BaseCommand):
    """Generate Open Badges credential metadata for MITx Online courses"""

    help = "Generate Open Badges credential metadata for MITx Online courses"

    def add_arguments(self, parser):
        parser.add_argument(
            "-c",
            "--chunk-size",
            dest="chunk_size",
            default=settings.CREDENTIAL_METADATA_CHUNK_SIZE,
            type=int,
            help="Number of resources per generation task",
        )
        parser.add_argument(
            "--overwrite",
            dest="overwrite",
            action="store_true",
            help="Regenerate metadata for resources that already have it",
        )
        parser.add_argument(
            "--dry-run",
            dest="dry_run",
            action="store_true",
            help=(
                "Print how many resources would be generated for, and exit"
                " without spending anything"
            ),
        )
        parser.add_argument(
            "--wait",
            dest="wait",
            action="store_true",
            help=(
                "Block until the sweep finishes. Opt-in: a full sweep can"
                " outlive CELERY_RESULT_EXPIRES, in which case the result"
                " keys are gone and this waits for nothing."
            ),
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Run the credential metadata sweep"""
        overwrite = options["overwrite"]

        # The cost guard: at ~50s and one frontier-model call per resource,
        # the size of this queryset is the thing worth knowing before running.
        count = credential_metadata_resource_ids(overwrite=overwrite).count()
        if options["dry_run"]:
            self.stdout.write(
                f"{count} resource(s) would have credential metadata generated"
            )
            return
        if not count:
            self.stdout.write("No resources need credential metadata generation")
            return

        task = generate_all_credential_metadata.delay(
            chunk_size=options["chunk_size"], overwrite=overwrite
        )
        self.stdout.write(
            f"Started task {task} to generate credential metadata for"
            f" {count} resource(s)"
        )
        if not options["wait"]:
            return

        self.stdout.write("Waiting on task...")
        start = now_in_utc()
        task.get()
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            f"Credential metadata generation finished, took {total_seconds} seconds"
        )
