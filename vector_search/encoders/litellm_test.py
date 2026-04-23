from unittest.mock import patch

import pytest
from django.conf import settings

from vector_search.encoders.litellm import LiteLLMEncoder, redis_url

pytestmark = pytest.mark.django_db


@patch("vector_search.encoders.litellm.litellm")
@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_cache_enabled(mock_embedding, mock_litellm):
    mock_embedding.return_value.to_dict.return_value = {
        "data": [{"embedding": [0.1, 0.2]}]
    }
    encoder = LiteLLMEncoder("test_model")
    encoder.cache = True
    encoder.get_embedding(["test"])

    mock_litellm.enable_cache.assert_called_once_with(
        type="redis",
        host=redis_url.hostname,
        port=redis_url.port,
        password=redis_url.password,
        supported_call_types=["embedding", "aembedding"],
        ttl=settings.QDRANT_QUERY_EMBEDDING_CACHE_TTL,
    )
    mock_litellm.disable_cache.assert_not_called()


@patch("vector_search.encoders.litellm.litellm")
@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_cache_disabled(mock_embedding, mock_litellm):
    mock_embedding.return_value.to_dict.return_value = {
        "data": [{"embedding": [0.1, 0.2]}]
    }
    encoder = LiteLLMEncoder("test_model")
    encoder.cache = False
    encoder.get_embedding(["test"])

    mock_litellm.enable_cache.assert_not_called()
    mock_litellm.disable_cache.assert_called_once()
