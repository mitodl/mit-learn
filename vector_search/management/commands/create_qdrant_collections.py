"""Management command to create Qdrant collections"""

from django.core.management.base import BaseCommand

from vector_search.utils import (
    create_qdrand_collections,
)


class Command(BaseCommand):
    """Creates Qdrant collections"""

    help = "Create Qdrant collections"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            dest="force",
            action="store_true",
            help="delete existing collections and force recreate",
        )

        super().add_arguments(parser)

    def handle(self, *args, **options):  # noqa: ARG002
        """Create Qdrant collections"""

        if options["force"]:
            create_qdrand_collections(force_recreate=True)
        else:
            create_qdrand_collections(force_recreate=False)

        self.stdout.write("Created Qdrant collections")
