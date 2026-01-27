"""Tasks for articles CDN purge"""

import logging
from urllib.parse import urljoin, urlparse

import requests
from django.conf import settings
from mitol.common.decorators import single_task

from articles.models import Article
from main.celery import app


def call_fastly_purge_api(relative_url):
    """
    Call the Fastly purge API.

    We aren't using the official Fastly SDK here because it doesn't work for
    this - the version of it that works with the current API only allows you
    to purge *everything*, not individual pages.

    Args:
        - relative_url  The relative URL to purge.
    Returns:
        - Dict of the response (resp.json), or False if there was an error.
    """
    logger = logging.getLogger("fastly_purge")
    netloc = urlparse(settings.APP_BASE_URL)[1]

    headers = {"host": netloc}

    if relative_url != "*":
        headers["fastly-soft-purge"] = "1"

    if settings.FASTLY_AUTH_TOKEN:
        headers["fastly-key"] = settings.FASTLY_AUTH_TOKEN

    api_url = urljoin(settings.FASTLY_URL, relative_url)

    resp = requests.request("PURGE", api_url, headers=headers, timeout=30)

    if resp.status_code >= 400:  # noqa: PLR2004
        logger.error(f"Fastly API Purge call failed: {resp.status_code} {resp.reason}")  # noqa: G004
        logger.error(f"Fastly returned: {resp.text}")  # noqa: G004
        return False
    else:
        logger.info(f"Fastly returned: {resp.text}")  # noqa: G004
        return resp.json()


@app.task
def queue_fastly_purge_article(article_id):
    """
    Purges the given article_id from the Fastly cache.
    """
    logger = logging.getLogger("fastly_purge")

    logger.info(f"Processing purge request for article {article_id}")  # noqa: G004

    try:
        article = Article.objects.get(pk=article_id)
    except Article.DoesNotExist:
        logger.exception(f"Article {article_id} not found.")  # noqa: G004
        return False

    # Only purge if article is published and has a slug
    if not article.is_published or not article.slug:
        logger.info(
            f"Article {article_id} is not published or has no slug, skipping purge."  # noqa: G004
        )
        return False

    article_url = article.get_url()
    logger.debug(f"Article URL is {article_url}")  # noqa: G004

    resp = call_fastly_purge_api(article_url)

    if resp and resp.get("status") == "ok":
        logger.info("Purge request processed OK.")
        return True

    logger.error("Purge request failed.")
    return False


@app.task()
def queue_fastly_full_purge():
    """
    Purges everything from the Fastly cache.

    Passing * to the purge API instructs Fastly to purge everything.
    """
    logger = logging.getLogger("fastly_purge")

    logger.info("Purging all pages from the Fastly cache...")

    resp = call_fastly_purge_api("*")

    if resp and resp.get("status") == "ok":
        logger.info("Purge request processed OK.")
        return True

    logger.error("Purge request failed.")
    return False


@app.task
@single_task(10)
def queue_fastly_purge_articles_list():
    """
    Purges the articles list page from the Fastly cache.
    """
    logger = logging.getLogger("fastly_purge")

    logger.info("Purging articles list page from the Fastly cache...")

    # Purge the articles API endpoint
    articles_url = "/api/v1/articles/"

    resp = call_fastly_purge_api(articles_url)

    if resp and resp.get("status") == "ok":
        logger.info("Articles list purge request processed OK.")
        return True

    logger.error("Articles list purge request failed.")
    return False
