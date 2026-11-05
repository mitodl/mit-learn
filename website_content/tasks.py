"""Tasks for website_content CDN purge"""

import logging

from mitol.common.decorators import single_task

from main.celery import app
from main.utils import call_fastly_purge_surrogate_keys, path_surrogate_key

log = logging.getLogger(__name__)

PURGE_TIMEOUT_SECONDS = 5  # 5 seconds


@app.task()
def fastly_purge_relative_url(relative_url, timeout=30):
    """
    Hard-purge from Fastly every cached variant of the page at the given
    relative URL, by its `path:` surrogate key.

    Can be called directly (runs immediately) or via .delay() (enqueued for Celery).

    Args:
        relative_url: The relative URL path to purge (e.g., "/news/article-slug")
        timeout: Timeout in seconds for the API request (default: 30)

    Raises:
        RequestException if the purge request fails
    """
    return call_fastly_purge_surrogate_keys(
        [path_surrogate_key(relative_url)], timeout=timeout
    )


@app.task()
@single_task(10)
def fastly_purge_website_content_list(listing_url="/news"):
    """
    Hard-purge from Fastly every cached variant of a website content listing
    page, by its `path:` surrogate key.

    Args:
        listing_url: The listing path to purge (e.g. "/news" or "/articles").
                     Defaults to "/news" for backward compatibility.

    Can be called directly (runs immediately) or via .delay() (enqueued for Celery).
    """
    log.info(
        "Purging website content list page %s from the Fastly cache...", listing_url
    )
    return call_fastly_purge_surrogate_keys([path_surrogate_key(listing_url)])
