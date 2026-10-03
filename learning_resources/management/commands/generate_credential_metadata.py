"""Management command for pre-populating credential metadata"""

from django.core.management import BaseCommand

from learning_resources.constants import CREDENTIAL_METADATA_RESOURCE_TYPES
from learning_resources.tasks import (
    credential_metadata_resource_ids,
    generate_all_credential_metadata,
)


class Command(BaseCommand):
    """Generate Open Badges credential metadata for MITx Online resources"""

    help = "Generate Open Badges credential metadata for MITx Online resources"

    def add_arguments(self, parser):
        parser.add_argument(
            "--overwrite",
            dest="overwrite",
            action="store_true",
            help="Regenerate metadata for resources that already have it",
        )
        parser.add_argument(
            "--resource-type",
            dest="resource_types",
            action="append",
            choices=CREDENTIAL_METADATA_RESOURCE_TYPES,
            help=(
                "Generate for this resource type only. Repeatable."
                " Defaults to every type credential metadata is generated"
                f" for ({', '.join(CREDENTIAL_METADATA_RESOURCE_TYPES)})."
            ),
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

        resource_types = options["resource_types"]

        count = len(
            credential_metadata_resource_ids(
                overwrite=overwrite, resource_types=resource_types
            )
        )
        if options["dry_run"]:
            self.stdout.write(
                f"{count} resource(s) would have credential metadata generated"
            )
            return
        if not count:
            self.stdout.write("No resources need credential metadata generation")
            return

        task = generate_all_credential_metadata.delay(
            overwrite=overwrite, resource_types=resource_types
        )
        self.stdout.write(
            f"Started task {task} to generate credential metadata for"
            f" {count} resource(s)"
        )

        self.stdout.write(
            "Generation runs in the background, roughly a minute per resource."
            " Follow the celery logs for progress."
        )
