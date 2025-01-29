import numpy as np
import pytest
from langchain.text_splitter import RecursiveCharacterTextSplitter
from qdrant_client.http.models.models import CountResult

from vector_search.encoders.base import BaseEncoder


class DummyEmbedEncoder(BaseEncoder):
    """
    A dummy encoder that returns random vectors
    """

    def __init__(self, model_name="dummy-embedding"):
        self.model_name = model_name

    def embed(self, text: str) -> list:  # noqa: ARG002
        return np.random.random((10, 1))

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return np.random.random((10, len(texts)))


@pytest.fixture(autouse=True)
def _use_dummy_encoder(settings):
    settings.QDRANT_ENCODER = "vector_search.conftest.DummyEmbedEncoder"
    settings.QDRANT_DENSE_MODEL = None


@pytest.fixture(autouse=True)
def _use_test_qdrant_settings(settings, mocker):
    settings.QDRANT_HOST = "https://test"
    settings.QDRANT_BASE_COLLECTION_NAME = "test"
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 0
    settings.CONTENT_FILE_EMBEDDING_SEMANTIC_CHUNKING_ENABLED = False
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch("vector_search.utils.SemanticChunker")

    mock_qdrant.scroll.return_value = [
        [],
        None,
    ]
    get_text_splitter_patch = mocker.patch("vector_search.utils._chunk_documents")
    get_text_splitter_patch.return_value = (
        RecursiveCharacterTextSplitter().create_documents(
            texts=["test dociment"],
            metadatas=[
                {
                    "run_title": "",
                    "platform": "",
                    "offered_by": "",
                    "run_readable_id": "",
                    "resource_readable_id": "",
                    "content_type": "",
                    "file_extension": "",
                    "content_feature_type": "",
                    "course_number": "",
                    "file_type": "",
                    "description": "",
                    "key": "",
                    "url": "",
                }
            ],
        )
    )
    mock_qdrant.count.return_value = CountResult(count=10)
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
