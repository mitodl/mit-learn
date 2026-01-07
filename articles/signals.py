"""Signal handlers for articles app"""

import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from articles.models import Article

log = logging.getLogger(__name__)


@receiver(post_save, sender=Article)
def sync_article_to_news_on_publish(sender, instance, created, **kwargs):  # noqa: ARG001
    """
    When an article is published or edited, sync only that article to the news feed.
    Uses Celery task with transaction.on_commit to ensure async sync after commit.
    """
    log.info(
        "Article signal triggered: id=%s, title=%s, is_published=%s, created=%s",
        instance.id,
        instance.title,
        instance.is_published,
        created,
    )

    if not instance.is_published:
        log.info("Article %s is not published, skipping sync", instance.id)
        return

    # Capture the article ID to use in the on_commit callback
    article_id = instance.id

    def trigger_async_sync():
        """Trigger the async Celery task after the transaction commits"""
        from news_events.tasks import sync_article_to_news

        log.info("Scheduling async sync for article %s to news feed...", article_id)
        sync_article_to_news.delay(article_id)

    # Schedule the async task to run after the transaction commits
    transaction.on_commit(trigger_async_sync)
