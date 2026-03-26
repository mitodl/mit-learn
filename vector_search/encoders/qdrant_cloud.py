import logging

import litellm
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
            self.token_encoding_name = tiktoken.encoding_name_for_model(
                self.model_short_name()
            )
        except KeyError:
            msg = (
                f"Model short name {self.model_short_name()!r} (from original model "
                f"{model_name!r}) not found in tiktoken. defaulting to None"
            )
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

    def dim(self):
        """
        Return the dimension of the embeddings
        """
        info = litellm.get_model_info(self.model_short_name())
        if not isinstance(info, dict):
            raise ValueError(
                f"Could not determine embedding dimension: litellm.get_model_info("
                f"{self.model_short_name()!r}) returned {type(info).__name__}, "
                "expected a dict with an 'output_vector_size' field."
            )
        if "output_vector_size" not in info:
            raise ValueError(
                "Could not determine embedding dimension: 'output_vector_size' "
                f"missing from litellm.get_model_info({self.model_short_name()!r}) "
                "response."
            )
        dim = info["output_vector_size"]
        if not isinstance(dim, int):
            raise ValueError(
                "Could not determine embedding dimension: 'output_vector_size' "
                f"from litellm.get_model_info({self.model_short_name()!r}) is of "
                f"type {type(dim).__name__}, expected int."
            )
        return dim
