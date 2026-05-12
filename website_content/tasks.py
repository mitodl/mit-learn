"""Tasks for website_content CDN purge"""

import logging

from mitol.common.decorators import single_task

from main.celery import app
from main.utils import call_fastly_purge_api

log = logging.getLogger(__name__)

PURGE_TIMEOUT_SECONDS = 5  # 5 seconds


@app.task()
def fastly_purge_relative_url(relative_url, timeout=30):
    """
    Purge the given relative URL from the Fastly cache.

    Can be called directly (runs immediately) or via .delay() (enqueued for Celery).

    Args:
        relative_url: The relative URL path to purge (e.g., "/news/article-slug/")
        timeout: Timeout in seconds for the API request (default: 30)

    Returns:
        dict: Response from Fastly API with status
    """
    return call_fastly_purge_api(relative_url, timeout=timeout)


@app.task()
def fastly_full_purge():
    """
    Purges everything from the Fastly cache.

    Passing * to the purge API instructs Fastly to purge everything.
    """
    log.info("Purging all pages from the Fastly cache...")
    return call_fastly_purge_api("*")


@app.task()
@single_task(10)
def fastly_purge_website_content_list():
    """
    Purges the news listing page from the Fastly cache.

    Can be called directly (runs immediately) or via .delay() (enqueued for Celery).
    """
    log.info("Purging website content list pages from the Fastly cache...")
    return call_fastly_purge_api("/news")
