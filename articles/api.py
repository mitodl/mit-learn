"""API functions for articles"""

import logging

from articles.hooks import get_plugin_manager
from articles.tasks import (
    purge_article_immediate,
    queue_fastly_purge_articles_list,
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

        # Purge the specific article page immediately (with fallback to Celery)
        purge_article_immediate(article.id)

        # Also purge the articles list since it may now include this article
        queue_fastly_purge_articles_list.delay()
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
