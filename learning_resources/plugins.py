"""Pluggy plugins for learning resources"""

import logging

from django.apps import apps
from django.db import transaction

from learning_resources.constants import FAVORITES_TITLE
from learning_resources.models import UserList

log = logging.getLogger(__name__)


class FavoritesListPlugin:
    hookimpl = apps.get_app_config("authentication").hookimpl

    @hookimpl
    def user_created(self, user, user_data):  # noqa: ARG002
        """
        Perform functions on a newly created user

        Args:
            user(User): The user to create the list for
            user_data(dict): the user data
        """
        UserList.objects.get_or_create(
            author=user, title=FAVORITES_TITLE, defaults={"description": "My Favorites"}
        )


class WebsiteContentLearningResourcePlugin:
    """
    Mirrors published articles into LearningResources.

    That is what makes them reachable from search and filterable by topic:
    `WebsiteContent.topics` alone is invisible to search, which only ever
    queries LearningResources.

    Articles only. News is deliberately excluded -- it has the news feed, which
    `WebsiteContentNewsPlugin` syncs it into, and is not meant to turn up as a
    learning resource.
    """

    hookimpl = apps.get_app_config("website_content").hookimpl

    @staticmethod
    def _is_article(content) -> bool:
        """Whether this content is the type that gets mirrored at all"""
        from website_content.constants import WebsiteContentType

        if content.content_type != WebsiteContentType.article.name:
            log.info(
                "WebsiteContentLearningResourcePlugin: skipping non-article"
                " content: id=%s, type=%s",
                content.id,
                content.content_type,
            )
            return False
        return True

    @hookimpl
    def website_content_published(self, content):
        """
        Upsert the LearningResource for a published content item.

        Args:
            content (WebsiteContent): the item that was published or updated
        """
        if not self._is_article(content):
            return
        log.info("Scheduling learning resource sync for website content %s", content.id)
        content_id = content.id

        def trigger_async_sync():
            from learning_resources.tasks import (
                sync_website_content_learning_resource,
            )

            sync_website_content_learning_resource.delay(content_id)

        # on_commit so the task cannot read the item before the write lands.
        transaction.on_commit(trigger_async_sync)

    @hookimpl
    def website_content_unpublished(self, content):
        """
        Take an unpublished content item's LearningResource out of search.

        Args:
            content (WebsiteContent): the item that was unpublished
        """
        if not self._is_article(content):
            return
        log.info("Removing learning resource for website content %s", content.id)
        content_id = content.id

        def trigger_async_unpublish():
            from learning_resources.tasks import (
                unpublish_website_content_learning_resource_task,
            )

            try:
                unpublish_website_content_learning_resource_task.delay(content_id)
            except Exception:
                # Queueing needs the broker, which is exactly what may have
                # sent us here. Nothing further to try: the rows are already
                # correct and the indexes are left to the next reindex.
                log.exception(
                    "Could not queue the learning resource removal for content %s",
                    content_id,
                )

        # Inline, unlike the sync side: the resource row is what the APIs read,
        # so leaving the flag to a worker keeps serving an article the editor
        # has already unpublished. Taking it out of the search indexes stays
        # queued inside `resource_unpublished_actions`, as for any resource.
        from learning_resources.api import unpublish_website_content_learning_resource

        try:
            unpublish_website_content_learning_resource(content_id)
        except Exception:
            # Any failure, not just a database one. This runs the search and
            # vector hooks inline, which fail in other ways -- a broker that
            # cannot be reached escapes `try_with_retry_as_task`, whose own
            # fallback is an unguarded `.delay()`.
            #
            # Swallowed rather than raised because the request cannot usefully
            # fail here: `perform_update` fires these hooks only on the
            # published->unpublished transition, which has already committed,
            # so a client that retries gets a 200 and no hooks at all. The
            # rows are already correct; what is left is the index work, which
            # the retrying task redoes in full -- including the Qdrant removal
            # the raise skipped. on_commit, so a rolled back unpublish
            # schedules nothing.
            log.exception(
                "Inline learning resource removal failed for content %s, queueing task",
                content_id,
            )
            transaction.on_commit(trigger_async_unpublish)
