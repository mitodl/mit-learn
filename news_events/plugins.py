"""Plugins for news_events app"""

import logging

from django.apps import apps
from django.db import transaction

log = logging.getLogger(__name__)


class WebsiteContentNewsPlugin:
    """Plugin to sync website_content news items to the news feed when published"""

    hookimpl = apps.get_app_config("website_content").hookimpl

    @hookimpl
    def website_content_published(self, content):
        """
        Sync a published news content item to news_events feed.

        Args:
            content (WebsiteContent): The content item that was published or updated
        """
        from website_content.constants import CONTENT_TYPE_NEWS

        if content.content_type != CONTENT_TYPE_NEWS:
            log.info(
                "WebsiteContentNewsPlugin: Skipping non-news content: id=%s, type=%s",
                content.id,
                content.content_type,
            )
            return

        log.info(
            "WebsiteContentNewsPlugin: Syncing content to news feed: id=%s, title=%s",
            content.id,
            content.title,
        )

        content_id = content.id

        def trigger_async_sync():
            """Trigger the async Celery task after the transaction commits"""
            from news_events.tasks import sync_website_content_to_news

            log.info("Scheduling async sync for content %s to news feed...", content_id)
            sync_website_content_to_news.delay(content_id)

        transaction.on_commit(trigger_async_sync)
