"""Plugins for news_events app"""

import logging

from django.apps import apps
from django.db import DatabaseError, transaction

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
        from website_content.constants import WebsiteContentType

        if content.content_type != WebsiteContentType.news.name:
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

    @hookimpl
    def website_content_unpublished(self, content):
        """
        Remove an unpublished news content item from the news_events feed.

        Args:
            content (WebsiteContent): The content item that was unpublished
        """
        from website_content.constants import WebsiteContentType

        if content.content_type != WebsiteContentType.news.name:
            log.info(
                "WebsiteContentNewsPlugin: Skipping non-news content: id=%s, type=%s",
                content.id,
                content.content_type,
            )
            return

        log.info(
            "WebsiteContentNewsPlugin: Removing from news feed: id=%s, title=%s",
            content.id,
            content.title,
        )

        from news_events.etl.articles_news import delete_website_content_news_from_news

        content_id = content.id

        def trigger_async_delete():
            """Trigger the async Celery task after the transaction commits"""
            from news_events.tasks import delete_website_content_from_news

            log.info(
                "Scheduling async removal of content %s from news feed...", content_id
            )
            delete_website_content_from_news.delay(content_id)

        # Unlike the sync side, removal is a single indexed delete, so it runs
        # inline: by the time the unpublish request answers, the news feed no
        # longer serves the item. Queued, it left a window the editor could see
        # through -- the listing refetches as soon as the request returns, and
        # got the story back it had just unpublished.
        try:
            delete_website_content_news_from_news(content_id)
        except DatabaseError:
            # Losing a race with the sync task for the same row is transient, so
            # hand off to the retrying task rather than failing the unpublish
            # over it. on_commit, so a rolled back unpublish schedules nothing.
            log.exception(
                "Inline news feed removal failed for content %s, queueing task",
                content_id,
            )
            transaction.on_commit(trigger_async_delete)
