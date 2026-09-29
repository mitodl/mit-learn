"""Tests for news_events plugins"""

from unittest.mock import patch

import pytest
from django.db import DatabaseError

from main.factories import UserFactory
from news_events.plugins import WebsiteContentNewsPlugin
from website_content.models import WebsiteContent

pytestmark = [pytest.mark.django_db]


@pytest.fixture(autouse=True)
def _mock_cdn_purge(mocker):
    """Auto-mock CDN purge tasks for all tests in this module"""
    mocker.patch("website_content.tasks.fastly_purge_relative_url")
    mocker.patch("website_content.tasks.fastly_purge_relative_url.delay")
    mocker.patch("website_content.tasks.fastly_purge_website_content_list.delay")


def test_website_content_published_hook_calls_sync_task():
    """Test that website_content_published hook schedules the sync task on commit"""
    user = UserFactory.create()
    content = WebsiteContent.objects.create(
        title="Test Article",
        content={},
        is_published=True,
        user=user,
        content_type="news",
    )

    plugin = WebsiteContentNewsPlugin()

    with patch("news_events.plugins.transaction.on_commit") as mock_on_commit:
        plugin.website_content_published(content)

        assert mock_on_commit.called
        assert mock_on_commit.call_count == 1

        callback = mock_on_commit.call_args[0][0]

        with patch("news_events.tasks.sync_website_content_to_news.delay") as mock_task:
            callback()

            mock_task.assert_called_once_with(content.id)


def test_website_content_published_hook_skips_non_news():
    """Test that the hook skips non-news content types"""
    user = UserFactory.create()
    content = WebsiteContent.objects.create(
        title="Draft Article",
        content={},
        is_published=True,
        user=user,
        content_type="article",
    )

    plugin = WebsiteContentNewsPlugin()

    with patch("news_events.plugins.transaction.on_commit") as mock_on_commit:
        plugin.website_content_published(content)

        assert not mock_on_commit.called


def test_website_content_published_hook_logging(caplog):
    """Test that the hook logs appropriate messages"""
    user = UserFactory.create()
    content = WebsiteContent.objects.create(
        title="Logging Test Article",
        content={},
        is_published=True,
        user=user,
        content_type="news",
    )

    plugin = WebsiteContentNewsPlugin()

    with patch("news_events.plugins.transaction.on_commit"), caplog.at_level("INFO"):
        plugin.website_content_published(content)

        assert any(
            "WebsiteContentNewsPlugin: Syncing content to news feed" in record.message
            for record in caplog.records
        )
        assert any(str(content.id) in record.message for record in caplog.records)
        assert any(content.title in record.message for record in caplog.records)


def test_website_content_published_hook_captures_content_id():
    """Test that the callback captures the correct content ID"""
    user = UserFactory.create()
    content = WebsiteContent.objects.create(
        title="ID Capture Test",
        content={},
        is_published=True,
        user=user,
        content_type="news",
    )

    plugin = WebsiteContentNewsPlugin()

    with patch("news_events.plugins.transaction.on_commit") as mock_on_commit:
        plugin.website_content_published(content)

        callback = mock_on_commit.call_args[0][0]

        with patch("news_events.tasks.sync_website_content_to_news.delay") as mock_task:
            callback()
            mock_task.assert_called_once_with(content.id)


def test_website_content_unpublished_hook_removes_feed_item_inline():
    """
    The feed entry is gone by the time the hook returns.

    Nothing may be left for a worker to pick up: the listing refetches as soon
    as the unpublish request answers, so anything deferred here is a window in
    which the news feed still serves the unpublished story.
    """
    from news_events.constants import FeedType
    from news_events.etl.articles_news import website_content_feed_guid
    from news_events.models import FeedItem, FeedSource

    user = UserFactory.create()
    content = WebsiteContent.objects.create(
        title="Test Article",
        content={},
        is_published=False,
        user=user,
        content_type="news",
    )
    source = FeedSource.objects.create(
        title="MIT Learn Articles", url="/news", feed_type=FeedType.news.name
    )
    guid = website_content_feed_guid(content.id)
    FeedItem.objects.create(
        guid=guid, source=source, title=content.title, url="/news/test-article"
    )

    plugin = WebsiteContentNewsPlugin()

    with patch("news_events.plugins.transaction.on_commit") as mock_on_commit:
        plugin.website_content_unpublished(content)

        assert not FeedItem.objects.filter(guid=guid).exists()
        # No deferred work at all: the removal already happened.
        assert not mock_on_commit.called


def test_website_content_unpublished_hook_queues_task_on_db_error():
    """
    A transient database error hands off to the retrying task.

    Racing the sync task for the same row must not fail the editor's unpublish,
    and the feed entry still has to go eventually.
    """
    user = UserFactory.create()
    content = WebsiteContent.objects.create(
        title="Test Article",
        content={},
        is_published=False,
        user=user,
        content_type="news",
    )

    plugin = WebsiteContentNewsPlugin()

    with (
        patch(
            "news_events.etl.articles_news.delete_website_content_news_from_news",
            side_effect=DatabaseError("deadlock detected"),
        ),
        patch("news_events.plugins.transaction.on_commit") as mock_on_commit,
    ):
        plugin.website_content_unpublished(content)

        assert mock_on_commit.call_count == 1
        callback = mock_on_commit.call_args[0][0]

        with patch(
            "news_events.tasks.delete_website_content_from_news.delay"
        ) as mock_task:
            callback()

            mock_task.assert_called_once_with(content.id)


def test_website_content_unpublished_hook_skips_non_news():
    """Only news content has a feed entry, so other types are skipped"""
    user = UserFactory.create()
    content = WebsiteContent.objects.create(
        title="Test Article",
        content={},
        is_published=False,
        user=user,
        content_type="article",
    )

    plugin = WebsiteContentNewsPlugin()

    with patch("news_events.plugins.transaction.on_commit") as mock_on_commit:
        plugin.website_content_unpublished(content)

        assert not mock_on_commit.called
