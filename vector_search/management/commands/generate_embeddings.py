"""Management command to index content"""

from django.core.management.base import BaseCommand, CommandError

from learning_resources_search.constants import LEARNING_RESOURCE_TYPES, TOPIC_TYPE
from main.utils import clear_search_cache, now_in_utc
from vector_search.tasks import start_embed_resources
from vector_search.utils import (
    create_qdrand_collections,
)

EMBED_TYPES = (*LEARNING_RESOURCE_TYPES, TOPIC_TYPE)


class Command(BaseCommand):
    """Generates embeddings in Qdrant"""

    help = "generate and index embeddings in Qdrant"

    def add_arguments(self, parser):
        parser.add_argument(
            "--recreate-collections",
            dest="recreate_collections",
            action="store_true",
            help="Recreate collections",
        )

        parser.add_argument(
            "--all",
            dest="all",
            action="store_true",
            help="Embed all resource types (including content files)",
        )

        parser.add_argument(
            "--skip-contentfiles",
            dest="skip_content_files",
            action="store_true",
            help="Skip embedding content files",
        )

        for object_type in sorted(EMBED_TYPES):
            parser.add_argument(
                f"--{object_type}s",
                dest=object_type,
                action="store_true",
                help=f"Recreate the {object_type} embeddings",
            )
        super().add_arguments(parser)

    def handle(self, *args, **options):  # noqa: ARG002
        """Embed all LEARNING_RESOURCE_TYPES"""

        if options["all"]:
            indexes_to_update = list(EMBED_TYPES)
        else:
            indexes_to_update = list(
                filter(lambda object_type: options[object_type], EMBED_TYPES)
            )
            if not indexes_to_update:
                self.stdout.write("Must select at least one type to update")
                self.stdout.write("The following are valid options:")
                self.stdout.write("  --all")
                for object_type in sorted(EMBED_TYPES):
                    self.stdout.write(f"  --{object_type}s")
                return
        if options["recreate_collections"]:
            create_qdrand_collections(force_recreate=True)
        task = start_embed_resources.delay(
            indexes_to_update, skip_content_files=options["skip_content_files"]
        )

        self.stdout.write(
            f"Started celery task {task} to index content for the following"
            f" Types to embed: {indexes_to_update}"
        )

        self.stdout.write("Waiting on task...")
        start = now_in_utc()
        error = task.get()
        if error:
            msg = f"Geenerate embeddings errored: {error}"
            raise CommandError(msg)
        clear_search_cache()
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            f"Embeddings generated and stored, took {total_seconds} seconds"
        )
