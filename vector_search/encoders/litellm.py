"""LiteLLM encoder module for vector search."""

import concurrent.futures
import contextvars
import logging
import os
import threading
from urllib.parse import urlparse

import litellm
import ol_llm
import tiktoken
from celery import current_task
from django.conf import settings
from litellm import embedding
from litellm.caching.caching import Cache

from vector_search.encoders.base import BaseEncoder

log = logging.getLogger()
redis_url = urlparse(settings.CELERY_BROKER_URL)
redis_ssl = redis_url.scheme.endswith("ss")

# drop unsupported model params
litellm.drop_params = True

# these must be set directly via environ (litellm limitation)
os.environ["REDIS_SSL"] = str(redis_ssl)
litellm.cache = Cache(
    type="redis",
    host=redis_url.hostname,
    port=redis_url.port,
    password=redis_url.password,
    ssl=redis_ssl,
    supported_call_types=["embedding", "aembedding"],
    ttl=settings.QDRANT_QUERY_EMBEDDING_CACHE_TTL,
    **({"ssl_cert_reqs": "required"} if redis_ssl else {}),
)

ol_llm.configure(ol_llm.Settings(environment=settings.OL_LLM_ENVIRONMENT))
ol_llm.configure_tracing(
    None if settings.OPIK_URL_OVERRIDE else ol_llm.TracingConfig(enabled=False)
)

APP_NAME = "mit-learn"
NO_ATTRIBUTION = ol_llm.Attribution()


class CapacityLimitedExecutor:
    """
    Thread pool that rejects work instead of queueing it.

    ``ThreadPoolExecutor`` has an unbounded work queue, so a burst of slow
    requests would silently pile up behind the busy workers. Here every
    in-flight task holds a slot for its whole lifetime, so at most
    ``max_workers`` tasks exist at once and ``submit`` returns ``None`` when
    the pool is saturated, letting the caller degrade instead of queueing.
    """

    def __init__(self, max_workers, thread_name_prefix):
        """Create the pool and the semaphore bounding its in-flight work."""
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix=thread_name_prefix,
        )
        self._slots = threading.BoundedSemaphore(max_workers)

    def submit(self, fn, *args, **kwargs):
        """Submit ``fn``, returning ``None`` if every worker is busy."""
        if not self._slots.acquire(blocking=False):
            return None
        try:
            future = self._executor.submit(fn, *args, **kwargs)
        except RuntimeError:
            # pool already shut down
            self._slots.release()
            return None
        # the slot is held until the call finishes, including for losing
        # requests the caller has already abandoned
        future.add_done_callback(lambda _future: self._slots.release())
        return future

    def shutdown(self):
        """Shut down the underlying pool without waiting on in-flight calls."""
        self._executor.shutdown(wait=False)


# Speculative requests get their own pool so a pile-up of abandoned hedges can
# never take capacity away from the primary request of a later query.
_executors = {}
_executor_lock = threading.Lock()


def _get_executor(key, max_workers, thread_name_prefix):
    """
    Return (creating if needed) one of the process-wide embedding thread pools.

    Created lazily so that settings overrides (in tests) are picked up.
    """
    executor = _executors.get(key)
    if executor is None:
        with _executor_lock:
            executor = _executors.get(key)
            if executor is None:
                executor = CapacityLimitedExecutor(
                    max_workers=max_workers,
                    thread_name_prefix=thread_name_prefix,
                )
                _executors[key] = executor
    return executor


def get_primary_executor():
    """Return the pool running the first (non-speculative) embedding request."""
    return _get_executor(
        "primary",
        settings.EMBEDDING_QUERY_MAX_WORKERS,
        "embed-query",
    )


def get_hedge_executor():
    """Return the pool running speculative (backup) embedding requests."""
    return _get_executor(
        "hedge",
        settings.EMBEDDING_HEDGE_MAX_WORKERS,
        "embed-hedge",
    )


def reset_embedding_executors():
    """Drop the shared embedding executors. Intended for tests."""
    with _executor_lock:
        executors = list(_executors.values())
        _executors.clear()
    for executor in executors:
        executor.shutdown()


def catalog_model_id(model_name):
    """
    Return the ol-llm catalog id (``provider:model``) of the model litellm calls.

    The provider is the one litellm resolves for the request the encoder sends,
    e.g. ``openai:text-embedding-3-large`` for ``text-embedding-3-large``.
    """
    model, provider, _api_key, _api_base = litellm.get_llm_provider(
        model=model_name,
        custom_llm_provider=settings.LITELLM_CUSTOM_PROVIDER,
        api_base=settings.LITELLM_API_BASE,
    )
    return f"{provider}:{model}"


def _document_attribution():
    """Attribute document embeddings to the Celery task making them, if any."""
    if current_task and current_task.request.id:
        return ol_llm.Attribution(run_id=current_task.request.id)
    return NO_ATTRIBUTION


class LiteLLMEncoder(BaseEncoder):
    """
    LiteLLM encoder
    """

    token_encoding_name = settings.LITELLM_TOKEN_ENCODING_NAME

    def __init__(self, model_name):
        """Initialize LiteLLM encoder with model name."""
        self.model_name = model_name
        try:
            self.token_encoding_name = tiktoken.encoding_name_for_model(model_name)
        except KeyError:
            msg = f"Model {model_name} not found in tiktoken. defaulting to None"
            log.warning(msg)
        model_id = catalog_model_id(model_name)
        self.query_use_case = ol_llm.UseCase(
            app=APP_NAME, name="search-query", profile="request", model=model_id
        )
        self.document_use_case = ol_llm.UseCase(
            app=APP_NAME, name="document-embedding", profile="batch", model=model_id
        )

    def embed_documents(self, documents):
        """Embed a list of documents without hedging."""
        response = self.get_embedding(
            documents, self.document_use_case, attribution=_document_attribution()
        )
        return [result["embedding"] for result in response["data"]]

    def _submit_query(self, executor, texts, timeout_seconds):
        """
        Submit one query embedding request, returning ``None`` if the pool is full.

        The request runs in a copy of the caller's context, so its trace nests
        under any Opik trace the caller has open instead of starting its own.
        """
        return executor.submit(
            contextvars.copy_context().run,
            self.get_embedding,
            texts,
            self.query_use_case,
            request_timeout=timeout_seconds,
        )

    def _hedged_get_embedding(self, texts, hedge_count, hedge_delay):
        """
        Run concurrent embedding requests and return the first successful result.

        The first request is issued immediately. When ``hedge_delay`` is
        positive the backup requests are only issued if the first request has
        not completed within that many seconds, so the extra backend load is
        paid on the tail rather than on every query. Losing requests are
        abandoned rather than waited on - the caller returns as soon as any
        request succeeds - but each one carries an explicit request timeout so
        it releases its worker instead of occupying it indefinitely.

        Both pools reject work when saturated: if the primary pool is full the
        request runs inline on the calling thread, and if the hedge pool is
        full the backups are skipped. Under load the behavior degrades to
        un-hedged requests rather than queueing behind abandoned losers.
        """
        timeout_seconds = settings.EMBEDDING_HEDGE_REQUEST_TIMEOUT_SECONDS
        primary = self._submit_query(get_primary_executor(), texts, timeout_seconds)
        if primary is None:
            log.warning(
                "Embedding pool saturated, running embedding request without hedging"
            )
            return self.get_embedding(
                texts, self.query_use_case, request_timeout=timeout_seconds
            )

        pending = {primary}
        hedge_futures = set()
        hedges_remaining = max(hedge_count - 1, 0)
        # only bound the wait while there are backups left to send
        timeout = hedge_delay if hedges_remaining else None
        first_exception = None

        while pending:
            done, pending = concurrent.futures.wait(
                pending,
                timeout=timeout,
                return_when=concurrent.futures.FIRST_COMPLETED,
            )
            for fut in done:
                try:
                    result = fut.result()
                except Exception as exc:  # noqa: BLE001
                    log.warning("Hedged embedding request failed with error: %s", exc)
                    if first_exception is None:
                        first_exception = exc
                else:
                    log.info(
                        "Embedding request won by %s request",
                        "backup" if fut in hedge_futures else "primary",
                    )
                    return result

            if hedges_remaining:
                # the first request is slow (or failed) - send the backups
                hedge_executor = get_hedge_executor()
                hedges = {
                    self._submit_query(hedge_executor, texts, timeout_seconds)
                    for _ in range(hedges_remaining)
                }
                hedges.discard(None)
                if hedges:
                    log.info(
                        "Sent %d backup embedding request(s) after %ss",
                        len(hedges),
                        hedge_delay,
                    )
                else:
                    log.warning("Hedge pool saturated, skipping backup requests")
                hedge_futures |= hedges
                pending |= hedges
                hedges_remaining = 0
                timeout = None

        if first_exception is not None:
            raise first_exception
        # unreachable: pending only empties once a request returned or raised
        msg = "All hedged embedding requests were abandoned"
        raise RuntimeError(msg)

    def embed_query(self, query):
        """
        Embed a single search query, hedging the request to mitigate tail latency.
        """
        hedge_count = settings.EMBEDDING_HEDGE_COUNT
        if settings.EMBEDDING_REQUEST_HEDGING_ENABLED and hedge_count > 1:
            res = self._hedged_get_embedding(
                [query],
                hedge_count=hedge_count,
                hedge_delay=settings.EMBEDDING_HEDGE_DELAY_SECONDS,
            )
            return res["data"][0]["embedding"]
        res = self.get_embedding([query], self.query_use_case)
        return res["data"][0]["embedding"]

    def get_embedding(
        self, texts, use_case, request_timeout=None, attribution=NO_ATTRIBUTION
    ):
        """
        Generate embeddings using LiteLLM/OpenAI API, traced as one request.

        Only single-text requests use the cache. litellm caches each text of a
        request separately and reports a partial hit's usage as the sum of the
        cached and billed texts, so the billed tokens of a multi-text request
        could not be told apart.
        """
        if self.cache and len(texts) == 1:
            cache_params = {
                "caching": True,
                "ttl": settings.QDRANT_QUERY_EMBEDDING_CACHE_TTL,
            }

        else:
            cache_params = {
                "no-cache": True,
                "no-store": True,
            }
        config = {"model": self.model_name, "input": texts, "cache": cache_params}
        if settings.LITELLM_CUSTOM_PROVIDER:
            config["custom_llm_provider"] = settings.LITELLM_CUSTOM_PROVIDER
        if settings.LITELLM_API_BASE:
            config["api_base"] = settings.LITELLM_API_BASE
        if request_timeout:
            # bounds abandoned losing requests so they release their worker
            config["timeout"] = request_timeout
        with ol_llm.traced_embedding(
            use_case, texts, attribution=attribution
        ) as request:
            response = embedding(**config)
            # read before to_dict(), which drops _hidden_params
            cache_hit = response._hidden_params.get("cache_hit") is True  # noqa: SLF001
            result = response.to_dict()
            request.record(
                [item["embedding"] for item in result["data"]],
                input_tokens=0 if cache_hit else response.usage.prompt_tokens,
            )
        return result
