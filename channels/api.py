"""Cache invalidation for channel pages"""

import logging
from itertools import batched

from requests import RequestException

from main.utils import (
    call_fastly_purge_surrogate_keys,
    clear_views_cache,
    path_surrogate_key,
)

log = logging.getLogger(__name__)

PURGE_TIMEOUT_SECONDS = 5

# Fastly's bulk purge takes at most 256 keys per request.
PURGE_BATCH_SIZE = 128


def clear_featured_caches(channel_urls):
    """
    Clear the Redis featured-list cache, then hard-purge from Fastly the
    channels' pages and the homepage, which shows the featured rows.

    Takes the `channel_url`s of the channel pages to purge. Pages are purged by
    their `path:` surrogate keys, which cover each query-param variant of a
    page and its RSC payload, in batches of `PURGE_BATCH_SIZE`. A failed Redis
    clear or purge batch is logged and the rest still run.
    """
    try:
        clear_views_cache(key_prefix="featured_resources")
    except Exception:
        log.exception("Failed to clear the featured_resources view cache")
    keys = [path_surrogate_key(url) for url in [*channel_urls, "/"]]
    for batch in batched(keys, PURGE_BATCH_SIZE):
        try:
            call_fastly_purge_surrogate_keys(list(batch), timeout=PURGE_TIMEOUT_SECONDS)
        except RequestException:
            log.exception("Channel Fastly purge failed for %s", batch)
