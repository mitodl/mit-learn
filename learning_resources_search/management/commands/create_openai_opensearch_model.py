from django.core.management.base import BaseCommand

from learning_resources_search.connection import (
    create_openai_embedding_connector_and_model,
    deploy_vector_model,
)


class Command(BaseCommand):
    """Create and deploy OpenAI OpenSearch vector model"""

    def handle(self, *args, **kwargs):  # noqa: ARG002
        create_openai_embedding_connector_and_model()
        deploy_vector_model()
