"""Cache invalidation for channel pages"""

import logging

from requests import RequestException

from main.utils import (
    call_fastly_purge_surrogate_keys,
    clear_views_cache,
    path_surrogate_key,
)

log = logging.getLogger(__name__)

PURGE_TIMEOUT_SECONDS = 5


def purge_channel_pages(channel_urls, *, homepage=False):
    """
    Hard-purge every cached variant of each channel's page from Fastly, and of
    the homepage if `homepage`.

    Takes `channel_url`s and purges their `path:` surrogate keys, which cover
    each query-param variant of a page and its RSC payload.
    """
    keys = [path_surrogate_key(url) for url in channel_urls]
    if homepage:
        keys.append(path_surrogate_key("/"))
    if not keys:
        return
    try:
        call_fastly_purge_surrogate_keys(keys, timeout=PURGE_TIMEOUT_SECONDS)
    except RequestException:
        log.exception("Channel Fastly purge failed for %s", keys)


def clear_featured_caches(channel_urls):
    """
    Clear the Redis featured-list cache, and hard-purge from Fastly the
    channels' pages and the homepage, which shows the featured rows.

    Takes the `channel_url`s of the channels whose featured list changed:
    every channel type shows its featured row on its own page. A failed Redis
    clear is logged and the Fastly purges still run.
    """
    try:
        clear_views_cache(key_prefix="featured_resources")
    except Exception:
        log.exception("Failed to clear the featured_resources view cache")
    purge_channel_pages(channel_urls, homepage=True)
