"""Plugins for news_events app"""

import logging

from django.apps import apps
from django.db import transaction

log = logging.getLogger(__name__)


class ArticleNewsPlugin:
    """Plugin to sync articles to news feed when published"""

    hookimpl = apps.get_app_config("articles").hookimpl

    @hookimpl
    def article_published(self, article):
        """
        Sync a published article to news_events feed

        Args:
            article (Article): The article that was published or updated
        """
        log.info(
            "ArticleNewsPlugin: Syncing article to news feed: id=%s, title=%s",
            article.id,
            article.title,
        )

        # Capture the article ID to use in the on_commit callback
        article_id = article.id

        def trigger_async_sync():
            """Trigger the async Celery task after the transaction commits"""
            from news_events.tasks import sync_article_to_news

            log.info("Scheduling async sync for article %s to news feed...", article_id)
            sync_article_to_news.delay(article_id)

        # Schedule the async task to run after the transaction commits
        transaction.on_commit(trigger_async_sync)
