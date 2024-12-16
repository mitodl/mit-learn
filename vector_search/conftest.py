import numpy as np
import pytest
from qdrant_client.http.models.models import CountResult

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


@pytest.fixture(autouse=True)
def _use_dummy_encoder(settings):
    settings.QDRANT_ENCODER = "vector_search.conftest.DummyEmbedEncoder"
    settings.QDRANT_DENSE_MODEL = None


@pytest.fixture(autouse=True)
def _use_test_qdrant_settings(settings, mocker):
    settings.QDRANT_HOST = "https://test"
    settings.QDRANT_BASE_COLLECTION_NAME = "test"
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mock_qdrant.scroll.return_value = [
        [],
        None,
    ]
    mock_qdrant.count.return_value = CountResult(count=10)
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
