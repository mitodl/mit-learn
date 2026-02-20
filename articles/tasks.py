"""Tasks for articles CDN purge"""

import logging

from mitol.common.decorators import single_task

from articles.models import Article
from main.celery import app
from main.utils import call_fastly_purge_api

log = logging.getLogger(__name__)


@app.task()
def queue_fastly_purge_article(article_id):
    """
    Purges the given article_id from the Fastly cache.
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
