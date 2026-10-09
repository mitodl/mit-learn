"""Tests for LiteLLM encoder."""

import concurrent.futures
import threading
import time
from collections import Counter
from unittest.mock import MagicMock, patch

import litellm
import pytest
from django.conf import settings

from main.azure_openai import azure_openai_litellm_params
from vector_search.encoders.litellm import (
    LiteLLMEncoder,
    get_hedge_executor,
    get_primary_executor,
    reset_embedding_executors,
)
from vector_search.utils import create_qdrant_collection

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _fresh_embedding_executors():
    """Isolate the shared embedding thread pools between tests"""
    reset_embedding_executors()
    yield
    reset_embedding_executors()


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


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_sets_request_timeout(mock_embedding, settings):
    """
    Test that hedged requests carry an explicit timeout so losing requests
    release their worker instead of occupying it indefinitely
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0
    settings.EMBEDDING_HEDGE_REQUEST_TIMEOUT_SECONDS = 3.5

    mock_embedding.side_effect = _timed_responses(0.0, 0.0)
    encoder = LiteLLMEncoder("test_model")
    encoder.embed_query("search query")

    assert mock_embedding.call_args_list
    assert all(call.kwargs["timeout"] == 3.5 for call in mock_embedding.call_args_list)


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_inline_when_primary_pool_full(
    mock_embedding, settings
):
    """
    Test that a query runs inline on the calling thread rather than queueing
    behind abandoned requests when the primary pool is saturated
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0
    settings.EMBEDDING_QUERY_MAX_WORKERS = 1

    release = threading.Event()
    calling_threads = []

    def side_effect(**_kwargs):
        calling_threads.append(threading.current_thread().name)
        return _embedding_response([0.1, 0.2, 0.3])

    mock_embedding.side_effect = side_effect
    executor = get_primary_executor()
    # occupy the only worker, the pool must then reject rather than queue
    assert executor.submit(release.wait, 10) is not None
    assert executor.submit(release.wait, 10) is None

    encoder = LiteLLMEncoder("test_model")
    try:
        res = encoder.embed_query("search query")
    finally:
        release.set()

    assert res == [0.1, 0.2, 0.3]
    assert mock_embedding.call_count == 1
    assert calling_threads == [threading.current_thread().name]


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_skips_hedges_when_hedge_pool_full(
    mock_embedding, settings
):
    """
    Test that backup requests are skipped when the hedge pool is saturated
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0
    settings.EMBEDDING_HEDGE_MAX_WORKERS = 1

    release = threading.Event()
    assert get_hedge_executor().submit(release.wait, 10) is not None

    mock_embedding.side_effect = _timed_responses(0.05, 0.0)
    encoder = LiteLLMEncoder("test_model")
    try:
        res = encoder.embed_query("search query")
    finally:
        release.set()

    assert res == [0.0, 0.2, 0.3]
    assert mock_embedding.call_count == 1


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_bounded_under_saturation(mock_embedding, settings):
    """
    Test that concurrent queries stay bounded by the configured pool sizes and
    still complete while earlier requests are in flight
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0
    settings.EMBEDDING_QUERY_MAX_WORKERS = 2
    settings.EMBEDDING_HEDGE_MAX_WORKERS = 2

    query_count = 8
    release = threading.Event()
    lock = threading.Lock()
    in_flight = Counter()
    peak = Counter()

    def _pool_of(thread_name):
        if thread_name.startswith("embed-query"):
            return "primary"
        if thread_name.startswith("embed-hedge"):
            return "hedge"
        return "inline"

    def side_effect(**_kwargs):
        pool = _pool_of(threading.current_thread().name)
        with lock:
            in_flight[pool] += 1
            peak[pool] = max(peak[pool], in_flight[pool])
        try:
            release.wait(10)
            return _embedding_response([0.1, 0.2, 0.3])
        finally:
            with lock:
                in_flight[pool] -= 1

    mock_embedding.side_effect = side_effect
    encoder = LiteLLMEncoder("test_model")

    with concurrent.futures.ThreadPoolExecutor(max_workers=query_count) as callers:
        futures = [
            callers.submit(encoder.embed_query, f"search query {idx}")
            for idx in range(query_count)
        ]
        # wait for every caller to have a request in flight before releasing
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            with lock:
                if sum(in_flight.values()) >= query_count:
                    break
            time.sleep(0.01)
        release.set()
        results = [fut.result(timeout=10) for fut in futures]

    assert results == [[0.1, 0.2, 0.3]] * query_count
    # no unbounded queueing - each pool stays within its configured size
    assert peak["primary"] <= settings.EMBEDDING_QUERY_MAX_WORKERS
    assert peak["hedge"] <= settings.EMBEDDING_HEDGE_MAX_WORKERS
    # queries that could not get a pool slot degraded to running inline
    assert peak["inline"] > 0


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_hedge_count_one(mock_embedding, settings):
    """
    Test that a hedge count of 1 short circuits to a plain un-hedged request
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 1
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0

    calling_threads = []

    def side_effect(**_kwargs):
        calling_threads.append(threading.current_thread().name)
        return _embedding_response([0.1, 0.2, 0.3])

    mock_embedding.side_effect = side_effect
    encoder = LiteLLMEncoder("test_model")
    res = encoder.embed_query("search query")

    assert res == [0.1, 0.2, 0.3]
    assert mock_embedding.call_count == 1
    # no thread pool and no hedge request timeout are involved
    assert calling_threads == [threading.current_thread().name]
    assert "timeout" not in mock_embedding.call_args.kwargs


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_hedge_count_three(mock_embedding, settings):
    """
    Test that a hedge count of 3 sends two backups and returns the first success
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 3
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0

    slow = 5.0
    lock = threading.Lock()
    calls = []

    def side_effect(**_kwargs):
        with lock:
            calls.append(threading.current_thread().name)
            # only the primary request is slow, both backups are fast
            is_primary = len(calls) == 1
        if is_primary:
            time.sleep(slow)
        return _embedding_response([0.1, 0.2, 0.3])

    mock_embedding.side_effect = side_effect
    encoder = LiteLLMEncoder("test_model")

    start = time.monotonic()
    res = encoder.embed_query("search query")
    elapsed = time.monotonic() - start

    assert res == [0.1, 0.2, 0.3]
    assert elapsed < slow / 2

    # both backups are sent, they may still be starting up when the winner returns
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        with lock:
            if len(calls) == 3:
                break
        time.sleep(0.01)
    assert len(calls) == 3
    assert sum(name.startswith("embed-hedge") for name in calls) == 2


AZURE_ENDPOINT = "https://ol-openai-test.openai.azure.com/"


@pytest.fixture
def azure_openai(settings, mocker):
    """Configure Azure OpenAI with a fake token provider"""
    settings.AZURE_OPENAI_ENDPOINT = AZURE_ENDPOINT
    settings.AZURE_OPENAI_API_VERSION = "2024-10-21"
    token_provider = MagicMock(return_value="fake-entra-token")
    mocker.patch(
        "main.azure_openai.azure_ad_token_provider", return_value=token_provider
    )
    return token_provider


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_azure_model(mock_embedding, azure_openai):
    """An azure/ model is sent to Azure OpenAI instead of LITELLM_API_BASE"""
    mock_embedding.return_value = _embedding_response([0.1, 0.2])
    encoder = LiteLLMEncoder("azure/text-embedding-3-large")
    encoder.get_embedding(["test"], request_timeout=5)

    mock_embedding.assert_called_once_with(
        model="azure/text-embedding-3-large",
        input=["test"],
        cache={"no-cache": True, "no-store": True},
        custom_llm_provider="azure",
        api_base=AZURE_ENDPOINT,
        api_version="2024-10-21",
        azure_ad_token_provider=azure_openai,
        timeout=5,
    )


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_azure_model_hedged_requests(
    mock_embedding, settings, azure_openai
):
    """The primary and backup requests for a query all go to Azure OpenAI"""
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 3
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0.05
    mock_embedding.side_effect = _timed_responses(1.0, 1.0, 0.0)
    encoder = LiteLLMEncoder("azure/text-embedding-3-large")

    assert encoder.embed_query("search query") == [2.0, 0.2, 0.3]
    assert mock_embedding.call_count == 3
    for call in mock_embedding.call_args_list:
        assert call.kwargs["custom_llm_provider"] == "azure"
        assert call.kwargs["api_base"] == AZURE_ENDPOINT
        assert call.kwargs["azure_ad_token_provider"] is azure_openai


def test_litellm_encoder_azure_cache_key(azure_openai):
    """
    The embedding cache key depends on the model string and input, not on the
    Azure endpoint or token provider.
    """
    encoder = LiteLLMEncoder("azure/text-embedding-3-large")
    encoder.cache = True
    base = {"model": "azure/text-embedding-3-large", "input": ["test"]}
    config = {**base, **azure_openai_litellm_params()}
    with_other_provider = {
        **config,
        "azure_ad_token_provider": MagicMock(return_value="another-token"),
    }

    key = litellm.cache.get_cache_key(**config)

    assert key == litellm.cache.get_cache_key(**base)
    assert key == litellm.cache.get_cache_key(**with_other_provider)
    assert key != litellm.cache.get_cache_key(
        model="text-embedding-3-large", input=["test"]
    )


@pytest.mark.parametrize(
    "model_name", ["text-embedding-3-large", "azure/text-embedding-3-large"]
)
def test_litellm_encoder_azure_prefix_keeps_vector_name(
    model_name, mocker, azure_openai
):
    """
    The azure/ prefix doesn't change the tokenizer, the Qdrant vector name, or
    the vector size, so switching to Azure doesn't need a reindex.
    """
    mocker.patch(
        "vector_search.encoders.litellm.embedding",
        return_value=_embedding_response([0.1] * 3072),
    )
    encoder = LiteLLMEncoder(model_name)
    mocker.patch("vector_search.utils.dense_encoder", return_value=encoder)
    mock_qdrant = mocker.patch("vector_search.utils.qdrant_client").return_value
    mock_qdrant.collection_exists.return_value = False

    create_qdrant_collection("test.resources", force_recreate=False)

    assert encoder.token_encoding_name == "cl100k_base"  # noqa: S105
    vectors_config = mock_qdrant.recreate_collection.call_args.kwargs["vectors_config"]
    assert list(vectors_config) == ["text-embedding-3-large"]
    assert vectors_config["text-embedding-3-large"].size == 3072
