"""LiteLLM encoder module for vector search."""

import concurrent.futures
import logging
import os
import threading
from urllib.parse import urlparse

import litellm
import tiktoken
from django.conf import settings
from litellm import embedding
from litellm.caching.caching import Cache

from vector_search.encoders.base import BaseEncoder

log = logging.getLogger()
redis_url = urlparse(settings.CELERY_BROKER_URL)

# drop unsupported model params
litellm.drop_params = True

# these must be set directly via environ (litellm limitation)
os.environ["REDIS_SSL"] = str(redis_url.scheme.endswith("ss"))
litellm.cache = Cache(
    type="redis",
    host=redis_url.hostname,
    port=redis_url.port,
    password=redis_url.password,
    supported_call_types=["embedding", "aembedding"],
    ttl=settings.QDRANT_QUERY_EMBEDDING_CACHE_TTL,
)

# Shared across all encoder instances so hedged queries do not pay
# thread-creation cost on every search request.
_hedge_executor = None
_hedge_executor_lock = threading.Lock()


def get_hedge_executor():
    """
    Return the process-wide thread pool used for hedged embedding requests.

    Created lazily so that settings overrides (in tests) are picked up.
    """
    global _hedge_executor  # noqa: PLW0603
    if _hedge_executor is None:
        with _hedge_executor_lock:
            if _hedge_executor is None:
                _hedge_executor = concurrent.futures.ThreadPoolExecutor(
                    max_workers=settings.EMBEDDING_HEDGE_MAX_WORKERS,
                    thread_name_prefix="embed-hedge",
                )
    return _hedge_executor


def reset_hedge_executor():
    """Drop the shared hedge executor. Intended for tests."""
    global _hedge_executor
    with _hedge_executor_lock:
        executor, _hedge_executor = _hedge_executor, None
    if executor is not None:
        executor.shutdown(wait=False)


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

    def embed_documents(self, documents):
        """Embed a list of documents without hedging."""
        return [result["embedding"] for result in self.get_embedding(documents)["data"]]

    def _hedged_get_embedding(self, texts, hedge_count=2, hedge_delay=0.0):
        """
        Run concurrent embedding requests and return the first successful result.

        The first request is issued immediately. When ``hedge_delay`` is
        positive the backup requests are only issued if the first request has
        not completed within that many seconds, so the extra backend load is
        paid on the tail rather than on every query. Losing requests are
        abandoned rather than waited on - the caller returns as soon as any
        request succeeds.
        """
        executor = get_hedge_executor()
        pending = {executor.submit(self.get_embedding, texts)}
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
                    return fut.result()
                except Exception as exc:  # noqa: BLE001
                    log.warning("Hedged embedding request failed with error: %s", exc)
                    if first_exception is None:
                        first_exception = exc

            if hedges_remaining:
                # the first request is slow (or failed) - send the backups
                pending |= {
                    executor.submit(self.get_embedding, texts)
                    for _ in range(hedges_remaining)
                }
                hedges_remaining = 0
                timeout = None

        if first_exception is not None:
            raise first_exception
        return None

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
        return self.embed(query)

    def get_embedding(self, texts):
        """Generate embeddings using LiteLLM/OpenAI API."""
        if self.cache:
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
        return embedding(**config).to_dict()
