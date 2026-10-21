"""Tests for LiteLLM encoder."""

import concurrent.futures
import contextvars
import threading
import time
from collections import Counter
from unittest.mock import patch

import ol_llm
import pytest
from django.conf import settings
from litellm import EmbeddingResponse, Usage

from vector_search.encoders.litellm import (
    LiteLLMEncoder,
    catalog_model_id,
    get_hedge_executor,
    get_primary_executor,
    reset_embedding_executors,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _fresh_embedding_executors():
    """Isolate the shared embedding thread pools between tests"""
    reset_embedding_executors()
    yield
    reset_embedding_executors(wait=True)


def _embedding_response(*vectors, prompt_tokens=3, cache_hit=None):
    """Build a litellm embedding response with one item per vector"""
    return EmbeddingResponse(
        model="test_model",
        data=[
            {"object": "embedding", "index": idx, "embedding": vector}
            for idx, vector in enumerate(vectors)
        ],
        usage=Usage(prompt_tokens=prompt_tokens, total_tokens=prompt_tokens),
        hidden_params=None if cache_hit is None else {"cache_hit": cache_hit},
    )


@pytest.fixture
def traced(mocker):
    """Spy on the traced requests and what each one records"""
    return {
        "requests": mocker.spy(ol_llm, "traced_embedding"),
        "records": mocker.spy(ol_llm.EmbeddingRequest, "record"),
    }


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
    mock_embedding.return_value = _embedding_response([0.1, 0.2])
    encoder = LiteLLMEncoder("test_model")
    encoder.cache = True
    encoder.get_embedding(["test"], encoder.query_use_case)

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
    mock_embedding.return_value = _embedding_response([0.1, 0.2])
    encoder = LiteLLMEncoder("test_model")
    encoder.cache = False
    encoder.get_embedding(["test"], encoder.query_use_case)

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

    mock_embedding.return_value = _embedding_response([0.1, 0.2, 0.3])
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


def _recorded(traced):
    """Return (texts, model, vectors, input_tokens) for each recorded request"""
    return [
        (
            list(call.args[0].texts),
            call.args[0].model,
            [list(vector) for vector in call.args[1]],
            call.kwargs["input_tokens"],
        )
        for call in traced["records"].call_args_list
    ]


@pytest.mark.parametrize(
    ("model_name", "provider", "expected"),
    [
        ("text-embedding-3-large", "openai", "openai:text-embedding-3-large"),
        ("openai/text-embedding-3-small", "openai", "openai:text-embedding-3-small"),
        ("text-embedding-3-large", "azure", "azure:text-embedding-3-large"),
        ("azure/text-embedding-3-large", None, "azure:text-embedding-3-large"),
    ],
)
def test_catalog_model_id(settings, model_name, provider, expected):
    """The catalog id names the provider litellm resolves for the request"""
    settings.LITELLM_CUSTOM_PROVIDER = provider
    assert catalog_model_id(model_name) == expected


def test_litellm_encoder_use_cases(settings):
    """Query and document embeddings are separate use cases on the same model"""
    settings.LITELLM_CUSTOM_PROVIDER = "openai"
    encoder = LiteLLMEncoder("text-embedding-3-large")

    query, document = encoder.query_use_case, encoder.document_use_case
    assert (query.app, query.name, query.profile) == (
        "mit-learn",
        "search-query",
        "request",
    )
    assert (document.app, document.name, document.profile) == (
        "mit-learn",
        "document-embedding",
        "batch",
    )
    assert query.model == document.model == "openai:text-embedding-3-large"


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_documents_traced(mock_embedding, traced, mocker):
    """A document request is traced with its vectors, billed tokens and task id"""
    mocker.patch(
        "vector_search.encoders.litellm.current_task",
        mocker.Mock(request=mocker.Mock(id="task-1")),
    )
    mock_embedding.return_value = _embedding_response(
        [0.1, 0.2], [0.3, 0.4], prompt_tokens=11
    )
    encoder = LiteLLMEncoder("test_model")

    assert encoder.embed_documents(["one", "two"]) == [[0.1, 0.2], [0.3, 0.4]]

    [request] = traced["requests"].call_args_list
    assert request.args[0] is encoder.document_use_case
    assert request.kwargs["attribution"] == ol_llm.Attribution(run_id="task-1")
    assert _recorded(traced) == [
        (["one", "two"], "openai:test_model", [[0.1, 0.2], [0.3, 0.4]], 11)
    ]


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_embed_query_traced(mock_embedding, traced, settings):
    """An un-hedged query is traced under the query use case"""
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = False
    mock_embedding.return_value = _embedding_response([0.5, 0.6], prompt_tokens=4)
    encoder = LiteLLMEncoder("test_model")

    assert encoder.embed_query("search query") == [0.5, 0.6]

    [request] = traced["requests"].call_args_list
    assert request.args[0] is encoder.query_use_case
    assert request.kwargs["attribution"] == ol_llm.Attribution()
    assert _recorded(traced) == [
        (["search query"], "openai:test_model", [[0.5, 0.6]], 4)
    ]


@pytest.mark.parametrize(("cache_hit", "expected_tokens"), [(True, 0), (False, 7)])
@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_cache_hit_reports_no_tokens(
    mock_embedding, traced, cache_hit, expected_tokens
):
    """A query served from litellm's cache was not billed, so it reports 0 tokens"""
    mock_embedding.return_value = _embedding_response(
        [0.1, 0.2], prompt_tokens=7, cache_hit=cache_hit
    )
    encoder = LiteLLMEncoder("test_model")
    encoder.cache = True

    encoder.get_embedding(["search query"], encoder.query_use_case)

    assert mock_embedding.call_args.kwargs["cache"]["caching"] is True
    assert [tokens for *_, tokens in _recorded(traced)] == [expected_tokens]


@pytest.mark.parametrize(("cache_hit", "expected_tokens"), [(True, 0), (False, 9)])
@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_multi_text_cache_hit_reports_no_tokens(
    mock_embedding, traced, cache_hit, expected_tokens
):
    """
    A multi-text request is cached as a whole, so a hit reports 0 tokens and a
    miss reports the provider's usage
    """
    mock_embedding.return_value = _embedding_response(
        [0.1], [0.2], prompt_tokens=9, cache_hit=cache_hit
    )
    encoder = LiteLLMEncoder("test_model")
    encoder.cache = True

    encoder.embed_documents(["one", "two"])

    assert mock_embedding.call_args.kwargs["cache"]["caching"] is True
    assert [tokens for *_, tokens in _recorded(traced)] == [expected_tokens]


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_each_hedged_request_traced(mock_embedding, traced, settings):
    """Every hedged request is billed, so each one is traced on its own"""
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 0

    lock = threading.Lock()
    calls = []
    both_sent = threading.Event()

    def side_effect(**_kwargs):
        with lock:
            calls.append(threading.current_thread().name)
            if len(calls) == 2:
                both_sent.set()
        # hold each request until both are in flight, so both are always sent
        both_sent.wait(5)
        return _embedding_response([0.1, 0.2], prompt_tokens=5)

    mock_embedding.side_effect = side_effect
    encoder = LiteLLMEncoder("test_model")

    assert encoder.embed_query("search query") == [0.1, 0.2]
    # the losing request may still be recording when the winner returns
    deadline = time.monotonic() + 5
    while traced["records"].call_count < 2 and time.monotonic() < deadline:
        time.sleep(0.01)

    assert sorted(name.split("_")[0] for name in calls) == [
        "embed-hedge",
        "embed-query",
    ]
    assert [call.args[0] for call in traced["requests"].call_args_list] == [
        encoder.query_use_case
    ] * 2
    assert (
        _recorded(traced)
        == [(["search query"], "openai:test_model", [[0.1, 0.2]], 5)] * 2
    )


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_hedged_requests_run_in_caller_context(
    mock_embedding, settings
):
    """
    Pool threads run each request in a copy of the caller's context, so the
    request's trace nests under a trace the caller has open
    """
    settings.EMBEDDING_REQUEST_HEDGING_ENABLED = True
    settings.EMBEDDING_HEDGE_COUNT = 2
    settings.EMBEDDING_HEDGE_DELAY_SECONDS = 5.0

    caller_value = contextvars.ContextVar("caller_value", default=None)
    seen = []

    def side_effect(**_kwargs):
        seen.append((threading.current_thread().name, caller_value.get()))
        return _embedding_response([0.1, 0.2])

    mock_embedding.side_effect = side_effect
    encoder = LiteLLMEncoder("test_model")

    token = caller_value.set("caller trace")
    try:
        encoder.embed_query("search query")
    finally:
        caller_value.reset(token)

    [(thread_name, value)] = seen
    assert thread_name.startswith("embed-query")
    assert value == "caller trace"


@patch("vector_search.encoders.litellm.embedding")
def test_litellm_encoder_failed_request_traced(mock_embedding, traced):
    """A failing request still passes its error through the trace unchanged"""
    mock_embedding.side_effect = ConnectionError("boom")
    encoder = LiteLLMEncoder("test_model")

    with pytest.raises(ConnectionError, match="boom"):
        encoder.embed_documents(["one"])

    assert traced["requests"].call_count == 1
    assert traced["records"].call_count == 0
