"""Signals for articles"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from articles.models import Article

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Article)
def purge_article_on_save(sender, instance, created, **kwargs):  # noqa: ARG001
    """
    Purge the article from the CDN cache when it's saved.

    This will trigger a CDN purge for:
    - The specific article page (if published and has a slug)
    - The articles list page

    Args:
        sender: The model class (Article)
        instance: The actual article instance being saved
        created: Boolean indicating if this is a new article
        **kwargs: Additional keyword arguments
    """
    from articles.tasks import (  # Import here to avoid circular imports
        queue_fastly_purge_article,
        queue_fastly_purge_articles_list,
    )

    # Only purge if the article is published
    if instance.is_published and instance.slug:
        logger.info(
            f"Article {instance.id} ({instance.slug}) saved, queueing CDN purge..."  # noqa: G004
        )

        # Purge the specific article page
        queue_fastly_purge_article.delay(instance.id)

        # Also purge the articles list since it may now include this article
        queue_fastly_purge_articles_list.delay()
    else:
        logger.debug(
            f"Article {instance.id} is not published or has no slug, "  # noqa: G004
            f"skipping CDN purge."
        )
