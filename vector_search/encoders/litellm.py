import logging

import tiktoken
from django.conf import settings
from litellm import embedding

from vector_search.encoders.base import BaseEncoder

log = logging.getLogger()


class LiteLLMEncoder(BaseEncoder):
    """
    LiteLLM encoder
    """

    token_encoding_name = settings.LITELLM_TOKEN_ENCODING_NAME

    def __init__(self, model_name):
        self.model_name = model_name
        try:
            self.token_encoding_name = tiktoken.encoding_name_for_model(model_name)
        except KeyError:
            msg = f"Model {model_name} not found in tiktoken. defaulting to None"
            log.warning(msg)

    def embed_documents(self, documents):
        return [result["embedding"] for result in self.get_embedding(documents)["data"]]

    def get_embedding(self, texts):
        config = {
            "model": self.model_name,
            "input": texts,
        }
        if settings.LITELLM_CUSTOM_PROVIDER:
            config["custom_llm_provider"] = settings.LITELLM_CUSTOM_PROVIDER
        if settings.LITELLM_API_BASE:
            config["api_base"] = settings.LITELLM_API_BASE
        return embedding(**config).to_dict()
