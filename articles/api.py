"""API functions for articles"""

import logging

from articles.hooks import get_plugin_manager
from articles.tasks import (
    PURGE_TIMEOUT_SECONDS,
    fastly_purge_articles_list,
    fastly_purge_relative_url,
)

log = logging.getLogger(__name__)


def purge_article_on_save(article):
    """
    Purge the article from the CDN cache when it's saved.

    This will trigger a CDN purge for:
    - The specific article page (if published and has a slug) - attempted immediately
    - The articles list page - queued as Celery task

    Args:
        article: The article instance being saved
    """
    # Only purge if the article is published
    if article.is_published and article.slug:
        log.info(
            "Article %s (%s) saved, purging CDN...",
            article.id,
            article.slug,
        )

        # Try to purge the article immediately with a short timeout
        article_url = article.get_url()
        try:
            article_purge_resp = fastly_purge_relative_url(
                article_url, timeout=PURGE_TIMEOUT_SECONDS
            )
            if article_purge_resp.get("status") == "ok":
                log.info("Article purge request processed OK.")
            else:
                # If immediate purge fails, queue it for Celery
                fastly_purge_relative_url.delay(article_url)
                log.error("Article purge request failed, enqueued for retry.")
        except Exception:
            # On any exception (timeout, network error, etc.), queue for Celery
            fastly_purge_relative_url.delay(article_url)
            log.exception("Article purge request failed, enqueued for retry.")

        # Also purge the articles list since it may now include this article
        fastly_purge_articles_list.delay()
    else:
        log.debug(
            "Article %s is not published or has no slug, skipping CDN purge.",
            article.id,
        )


def article_published_actions(*, article):
    """
    Trigger plugins when an article is published or updated

    Args:
        article (Article): The article that was published or updated
    """
    if not article.is_published:
        log.info("Article %s is not published, skipping plugin actions", article.id)
        return

    log.info(
        "Triggering article_published plugins for article: id=%s, title=%s",
        article.id,
        article.title,
    )

    pm = get_plugin_manager()
    hook = pm.hook
    hook.article_published(article=article)
