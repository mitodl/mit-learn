"""Tests for LiteLLM encoder."""

import threading
import time
from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings

from vector_search.encoders.litellm import LiteLLMEncoder, reset_hedge_executor

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _fresh_hedge_executor():
    """Isolate the shared hedge thread pool between tests"""
    reset_hedge_executor()
    yield
    reset_hedge_executor()


def _embedding_response(vector):
    """Build a mock litellm embedding response"""
    mock_resp = MagicMock()
    mock_resp.to_dict.return_value = {"data": [{"embedding": vector}]}
    return mock_resp


def _timed_responses(*delays):
    """
    Return a mock side effect that sleeps a different amount per call.

    Each successive call sleeps the next value in ``delays``.
    """
    counter = iter(range(len(delays)))
    lock = threading.Lock()

    def side_effect(**_kwargs):
        with lock:
            idx = next(counter)
        time.sleep(delays[idx])
        return _embedding_response([float(idx), 0.2, 0.3])

    return side_effect


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


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_hedging_enabled(mock_embedding, settings):
    """
    Test that embed_query issues hedged requests when the first one is slow
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0.05

    # first request never finishes in time, the hedge is fast
    mock_embedding.side_effect = _timed_responses(5.0, 0.0)
    encoder = LiteLLMEncoder("test_model")
    res = encoder.embed_query("search query")

    assert res == [1.0, 0.2, 0.3]
    assert mock_embedding.call_count == 2


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_does_not_wait_for_losers(mock_embedding, settings):
    """
    Test that embed_query returns on the first success without waiting
    for slower in-flight hedges to finish
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0

    slow = 5.0
    mock_embedding.side_effect = _timed_responses(slow, 0.0)
    encoder = LiteLLMEncoder("test_model")

    start = time.monotonic()
    res = encoder.embed_query("search query")
    elapsed = time.monotonic() - start

    assert res == [1.0, 0.2, 0.3]
    # must return at the speed of the winner, not the loser
    assert elapsed < slow / 2


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_hedge_skipped_when_fast(mock_embedding, settings):
    """
    Test that no backup request is sent when the first one beats the hedge delay
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 5.0

    mock_embedding.side_effect = _timed_responses(0.0, 0.0)
    encoder = LiteLLMEncoder("test_model")
    res = encoder.embed_query("search query")

    assert res == [0.0, 0.2, 0.3]
    assert mock_embedding.call_count == 1


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_hedge_covers_failure(mock_embedding, settings):
    """
    Test that a failing request falls back to a hedged request
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 5.0

    mock_embedding.side_effect = [
        ConnectionError("boom"),
        _embedding_response([0.1, 0.2, 0.3]),
    ]
    encoder = LiteLLMEncoder("test_model")
    res = encoder.embed_query("search query")

    assert res == [0.1, 0.2, 0.3]
    assert mock_embedding.call_count == 2


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_raises_when_all_fail(mock_embedding, settings):
    """
    Test that the first error is raised when every hedged request fails
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0

    mock_embedding.side_effect = ConnectionError("boom")
    encoder = LiteLLMEncoder("test_model")

    with pytest.raises(ConnectionError, match="boom"):
        encoder.embed_query("search query")

    assert mock_embedding.call_count == 2


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_hedging_disabled(mock_embedding, settings):
    """
    Test that embed_query issues only a single request when hedging is disabled
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = False

    mock_embedding.return_value.to_dict.return_value = {
        "data": [{"embedding": [0.1, 0.2, 0.3]}]
    }
    encoder = LiteLLMEncoder("test_model")
    res = encoder.embed_query("search query")

    assert res == [0.1, 0.2, 0.3]
    assert mock_embedding.call_count == 1
