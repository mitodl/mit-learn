import logging

import tiktoken
from litellm import embedding

from vector_search.encoders.base import BaseEncoder

log = logging.getLogger()


class LiteLLMEncoder(BaseEncoder):
    """
    LiteLLM encoder
    """

    token_encoding_name = "cl100k_base"  # noqa: S105

    def __init__(self, model_name="text-embedding-3-small"):
        self.model_name = model_name
        try:
            self.token_encoding_name = tiktoken.encoding_name_for_model(model_name)
        except KeyError:
            msg = f"Model {model_name} not found in tiktoken. defaulting to cl100k_base"
            log.warning(msg)

    def encode_batch(self, texts: list[str]) -> list[list[float]]:
        return [
            result["embedding"]
            for result in embedding(model=self.model_name, input=texts).to_dict()[
                "data"
            ]
        ]
