"""Management command to update or create the topics collection in Qdrant"""

from django.core.management.base import BaseCommand, CommandError

from main.utils import clear_search_cache, now_in_utc
from vector_search.tasks import sync_topics


class Command(BaseCommand):
    """Syncs embeddings for topics in Qdrant"""

    help = "update or create the topics collection in Qdrant"

    def handle(self, *args, **options):  # noqa: ARG002
        """Sync the topics collection"""
        task = sync_topics.apply()
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
