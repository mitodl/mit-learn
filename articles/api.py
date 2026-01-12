"""API functions for articles"""

import logging

from articles.hooks import get_plugin_manager

log = logging.getLogger(__name__)


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
