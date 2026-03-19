import logging

import tiktoken
from django.conf import settings
from qdrant_client import models

from vector_search.encoders.base import BaseEncoder

log = logging.getLogger()


class QdrantCloudEncoder(BaseEncoder):
    """
    Qdrant native inferencing cloud encoder
    """

    requires_cloud_inferencing = True

    def __init__(self, model_name):
        self.model_name = model_name
        try:
            self.token_encoding_name = tiktoken.encoding_name_for_model(model_name)
        except KeyError:
            msg = f"Model {model_name} not found in tiktoken. defaulting to None"
            log.warning(msg)

    def embed_documents(self, documents):
        return self.get_embedding(documents)

    def get_embedding(self, texts):
        """
        Return Documents with text and model name for qdrant cloud inferencing.
        """
        return [
            models.Document(
                text=text,
                model=self.model_name,
                options={
                    # required for openai models
                    "openai-api-key": settings.OPENAI_API_KEY,
                },
            )
            for text in texts
        ]
