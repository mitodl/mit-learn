from unittest.mock import patch

import pytest
from django.conf import settings

from vector_search.encoders.litellm import LiteLLMEncoder

pytestmark = pytest.mark.django_db


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_cache_enabled(mock_embedding):
    """
    Test that cache is enabled when cache is True on the encoder
    """
    mock_embedding.return_value.to_dict.return_value = {
        "data": [{"embedding": [0.1, 0.2]}]
    }
    encoder = LiteLLMEncoder("test_model")
    encoder.cache = True
    encoder.get_embedding(["test"])

    expected_kwargs = {
        "model": "test_model",
        "input": ["test"],
        "cache": {"caching": True, "ttl": settings.QDRANT_QUERY_EMBEDDING_CACHE_TTL},
    }
    if settings.LITELLM_CUSTOM_PROVIDER:
        expected_kwargs["custom_llm_provider"] = settings.LITELLM_CUSTOM_PROVIDER
    if settings.LITELLM_API_BASE:
        expected_kwargs["api_base"] = settings.LITELLM_API_BASE

    mock_embedding.assert_called_once_with(**expected_kwargs)


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_cache_disabled(mock_embedding):
    """
    Test that cache is disabled when cache is False on the encoder
    """
    mock_embedding.return_value.to_dict.return_value = {
        "data": [{"embedding": [0.1, 0.2]}]
    }
    encoder = LiteLLMEncoder("test_model")
    encoder.cache = False
    encoder.get_embedding(["test"])

    expected_kwargs = {
        "model": "test_model",
        "input": ["test"],
        "cache": {"no-cache": True, "no-store": True},
    }
    if settings.LITELLM_CUSTOM_PROVIDER:
        expected_kwargs["custom_llm_provider"] = settings.LITELLM_CUSTOM_PROVIDER
    if settings.LITELLM_API_BASE:
        expected_kwargs["api_base"] = settings.LITELLM_API_BASE

    mock_embedding.assert_called_once_with(**expected_kwargs)
