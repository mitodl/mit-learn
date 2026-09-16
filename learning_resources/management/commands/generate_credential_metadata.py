"""Management command for pre-populating credential metadata"""

from django.core.management import BaseCommand

from learning_resources.tasks import (
    credential_metadata_resource_ids,
    generate_all_credential_metadata,
)


class Command(BaseCommand):
    """Generate Open Badges credential metadata for MITx Online courses"""

    help = "Generate Open Badges credential metadata for MITx Online courses"

    def add_arguments(self, parser):
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

        task = generate_all_credential_metadata.delay(overwrite=overwrite)
        self.stdout.write(
            f"Started task {task} to generate credential metadata for"
            f" {count} resource(s)"
        )
        # No --wait: generation is one task per resource and hours of them in
        # total, so there is no single result to block on that says anything
        # useful. Each resource logs its own outcome as it lands.
        self.stdout.write(
            "Generation runs in the background, roughly a minute per resource."
            " Follow the celery logs for progress and completion:"
        )
        self.stdout.write("    docker compose logs -f celery")
