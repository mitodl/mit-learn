"""Management command to update learning resource content"""

from django.core.management.base import BaseCommand

from learning_resources_search.indexing_api import setup_embedding_pipeline


class Command(BaseCommand):
    """
    Sets up the embeddings ingestion pipeline
    """

    def handle(self, **options):  # noqa: ARG002
        setup_embedding_pipeline()
