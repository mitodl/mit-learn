"""API functions for website_content"""

import logging

from website_content.hooks import get_plugin_manager
from website_content.tasks import (
    PURGE_TIMEOUT_SECONDS,
    fastly_purge_relative_url,
    fastly_purge_website_content_list,
)

log = logging.getLogger(__name__)


def purge_content_on_save(content):
    """
    Purge the content item from the CDN cache when it's saved.

    This will trigger a CDN purge for:
    - The specific content page (if published and has a slug) - attempted immediately
    - The content list page - queued as Celery task

    Args:
        content: The WebsiteContent instance being saved
    """
    if content.is_published and content.slug:
        log.info(
            "WebsiteContent %s (%s) saved, purging CDN...",
            content.id,
            content.slug,
        )

        content_url = content.get_url()
        try:
            purge_resp = fastly_purge_relative_url(
                content_url, timeout=PURGE_TIMEOUT_SECONDS
            )
            if purge_resp.get("status") == "ok":
                log.info("Content purge request processed OK.")
            else:
                fastly_purge_relative_url.delay(content_url)
                log.error("Content purge request failed, enqueued for retry.")
        except Exception:
            fastly_purge_relative_url.delay(content_url)
            log.exception("Content purge request failed, enqueued for retry.")

        fastly_purge_website_content_list.delay()
    else:
        log.debug(
            "WebsiteContent %s is not published or has no slug, skipping CDN purge.",
            content.id,
        )


def content_published_actions(*, content):
    """
    Trigger plugins when a content item is published or updated.

    Args:
        content (WebsiteContent): The content item that was published or updated
    """
    if not content.is_published:
        log.info(
            "WebsiteContent %s is not published, skipping plugin actions", content.id
        )
        return

    log.info(
        "Triggering website_content_published plugins for content: id=%s, title=%s",
        content.id,
        content.title,
    )

    pm = get_plugin_manager()
    hook = pm.hook
    hook.website_content_published(content=content)
