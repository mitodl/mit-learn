from litellm import embedding

from vector_search.encoders.base import BaseEncoder


class LiteLLMEncoder(BaseEncoder):
    """
    LiteLLM encoder
    """

    def __init__(self, model_name="text-embedding-3-small"):
        self.model_name = model_name

    def encode_batch(self, texts: list[str]) -> list[list[float]]:
        return [
            result["embedding"]
            for result in embedding(model=self.model_name, input=texts).to_dict()[
                "data"
            ]
        ]
