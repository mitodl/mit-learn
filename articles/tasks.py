"""Tasks for articles CDN purge"""

import logging

from mitol.common.decorators import single_task

from articles.models import Article
from main.celery import app
from main.utils import call_fastly_purge_api

log = logging.getLogger(__name__)

PURGE_TIMEOUT_SECONDS = 5  # 5 seconds


def purge_article_immediate(article_id):
    """
    Attempt to purge the article immediately with a timeout.

    If the purge fails or times out, falls back to queuing a Celery task.

    Args:
        article_id: The ID of the article to purge

    Returns:
        bool: True if immediate purge succeeded, False if failed/fallback used
    """
    log.info(f"Attempting immediate purge for article {article_id}")  # noqa: G004

    try:
        article = Article.objects.get(pk=article_id)
    except Article.DoesNotExist:
        log.exception(f"Article {article_id} not found.")  # noqa: G004
        return False

    # Only purge if article is published and has a slug
    if not article.is_published or not article.slug:
        log.info(
            f"Article {article_id} is not published or has no slug, skipping purge."  # noqa: G004
        )
        return False

    article_url = article.get_url()
    log.debug(f"Article URL is {article_url}")  # noqa: G004

    try:
        # Attempt immediate purge with timeout
        resp = call_fastly_purge_api(article_url, timeout=PURGE_TIMEOUT_SECONDS)

        if resp and resp.get("status") == "ok":
            log.info("Immediate purge request processed OK.")
            return True
        else:
            log.warning("Immediate purge request failed, falling back to Celery task.")
            queue_fastly_purge_article.delay(article_id)
            return False

    except Exception:
        log.exception(
            f"Exception during immediate purge for article {article_id}, "  # noqa: G004
            "falling back to Celery task."
        )
        queue_fastly_purge_article.delay(article_id)
        return False


@app.task()
def queue_fastly_purge_article(article_id):
    """
    Purges the given article_id from the Fastly cache.

    This is used as a fallback when immediate purging fails or as a direct
    queued task when immediate purging is not needed.
    """
    log.info(f"Processing purge request for article {article_id}")  # noqa: G004

    try:
        article = Article.objects.get(pk=article_id)
    except Article.DoesNotExist:
        log.exception(f"Article {article_id} not found.")  # noqa: G004
        return False

    # Only purge if article is published and has a slug
    if not article.is_published or not article.slug:
        log.info(
            f"Article {article_id} is not published or has no slug, skipping purge."  # noqa: G004
        )
        return False

    article_url = article.get_url()
    log.debug(f"Article URL is {article_url}")  # noqa: G004

    resp = call_fastly_purge_api(article_url)

    if resp and resp.get("status") == "ok":
        log.info("Purge request processed OK.")
        return True

    log.error("Purge request failed.")
    return False


@app.task()
def queue_fastly_full_purge():
    """
    Purges everything from the Fastly cache.

    Passing * to the purge API instructs Fastly to purge everything.
    """
    log.info("Purging all pages from the Fastly cache...")

    resp = call_fastly_purge_api("*")

    if resp and resp.get("status") == "ok":
        log.info("Purge request processed OK.")
        return True

    log.error("Purge request failed.")
    return False


@app.task()
@single_task(10)
def queue_fastly_purge_articles_list():
    """
    Purges the articles list page from the Fastly cache.
    """
    log.info("Purging articles list page from the Fastly cache...")

    # Purge the articles API endpoint
    articles_url = "/news"

    resp = call_fastly_purge_api(articles_url)

    if resp and resp.get("status") == "ok":
        log.info("Articles list purge request processed OK.")
        return True

    log.error("Articles list purge request failed.")
    return False
