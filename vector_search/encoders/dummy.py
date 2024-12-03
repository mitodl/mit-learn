import numpy as np

from vector_search.encoders.base import BaseEncoder


class DummyEmbedEncoder(BaseEncoder):
    """
    A dummy encoder that returns random vectors
    """

    def __init__(self, model_name="dummy-embedding"):
        self.model_name = model_name

    def encode(self, text: str) -> list:  # noqa: ARG002
        return np.random.random((10, 1))

    def encode_batch(self, texts: list[str]) -> list[list[float]]:
        return np.random.random((10, len(texts)))
