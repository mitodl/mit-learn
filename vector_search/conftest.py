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
def marketing_metadata_mocks(mocker):
    mocker.patch(
        "vector_search.utils._fetch_page",
        return_value="""
        <html>
        <body>
            <div class="container">
            <div class="learning-header">
              <h1>WHAT YOU WILL LEARN</h1>
              <p data-block-key="fq16h">MIT xPRO is collaborating with online
              education provider Emeritus to deliver this online program.</p>
            </div>
            <ul class="learning-outcomes-list d-flex flex-wrap justify-content-between">
              <li>Learn to code in Python</li>
              <li>Use SQL to create databases</li>
              <li>Wrangle and analyze millions of pieces of
              data using databases in Python</li>
              <li>Understand how networks work, including IPs,
              security, and servers</li>
              <li>Manage big data using data warehousing and
              workflow management platforms</li>
              <li>Use cutting-edge data engineering
              platforms and tools to manage data</li>
              <li>Explore artificial intelligence
              and machine learning concepts,
              including reinforcement learning and deep neural networks</li>
            </ul>
          </div>
        </body>
        </html>""",
    )


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
