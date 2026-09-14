"""API functions for website_content"""

import logging

from website_content.constants import WebsiteContentType
from website_content.hooks import get_plugin_manager
from website_content.tasks import (
    PURGE_TIMEOUT_SECONDS,
    fastly_purge_relative_url,
    fastly_purge_website_content_list,
)

log = logging.getLogger(__name__)


_CONTENT_TYPE_LISTING_URL = {
    WebsiteContentType.news.name: "/news",
    WebsiteContentType.article.name: "/articles",
}


def _purge_content_and_listing(content):
    """
    Purge the content item's own page and its listing page from the CDN.

    The page purge is attempted immediately and falls back to a Celery task;
    the listing is always queued.

    Args:
        content: The WebsiteContent instance whose URLs should be purged
    """
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

    fastly_purge_website_content_list.delay(
        _CONTENT_TYPE_LISTING_URL.get(content.content_type, "/news")
    )


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
        _purge_content_and_listing(content)

    else:
        log.debug(
            "WebsiteContent %s is not published or has no slug, skipping CDN purge.",
            content.id,
        )


def purge_content_on_unpublish(content):
    """
    Purge an unpublished content item from the CDN cache.

    `purge_content_on_save` deliberately skips anything unpublished, which
    leaves the CDN serving a page that is no longer public and a listing that
    still advertises it. Unpublishing keeps the slug -- it is only (re)generated
    on the transition to published -- so the page URL is still resolvable here.

    Args:
        content: The WebsiteContent instance that was unpublished
    """
    if not content.slug:
        log.debug(
            "WebsiteContent %s has no slug, skipping CDN purge on unpublish.",
            content.id,
        )
        return

    log.info(
        "WebsiteContent %s (%s) unpublished, purging CDN...",
        content.id,
        content.slug,
    )
    _purge_content_and_listing(content)


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


def content_unpublished_actions(*, content):
    """
    Trigger plugins when a content item is unpublished.

    The counterpart to `content_published_actions`: publishing syncs a news item
    into the news feed, so unpublishing has to take it back out. Guarded on the
    flag so a caller cannot accidentally tear down a still-published item.

    Args:
        content (WebsiteContent): The content item that was unpublished
    """
    if content.is_published:
        log.info(
            "WebsiteContent %s is still published, skipping unpublish plugin actions",
            content.id,
        )
        return

    log.info(
        "Triggering website_content_unpublished plugins for content: id=%s, title=%s",
        content.id,
        content.title,
    )

    pm = get_plugin_manager()
    hook = pm.hook
    hook.website_content_unpublished(content=content)
