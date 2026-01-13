"""Tests for news_events plugins"""

from unittest.mock import patch

import pytest

from articles.models import Article
from main.factories import UserFactory
from news_events.plugins import ArticleNewsPlugin

pytestmark = [pytest.mark.django_db]


def test_article_published_hook_calls_sync_task():
    """Test that article_published hook schedules the sync task on commit"""
    user = UserFactory.create()
    article = Article.objects.create(
        title="Test Article",
        content={},
        is_published=True,
        user=user,
    )

    plugin = ArticleNewsPlugin()

    with patch("news_events.plugins.transaction.on_commit") as mock_on_commit:
        plugin.article_published(article)

        # Verify that on_commit was called
        assert mock_on_commit.called
        assert mock_on_commit.call_count == 1

        # Get the callback function that was registered
        callback = mock_on_commit.call_args[0][0]

        # Now patch the Celery task and call the callback
        with patch("news_events.tasks.sync_article_to_news.delay") as mock_task:
            callback()

            # Verify the Celery task was called with the article ID
            mock_task.assert_called_once_with(article.id)


def test_article_published_hook_with_unpublished_article():
    """Test that the hook still registers callback even for unpublished articles"""
    user = UserFactory.create()
    article = Article.objects.create(
        title="Draft Article",
        content={},
        is_published=False,
        user=user,
    )

    plugin = ArticleNewsPlugin()

    with patch("news_events.plugins.transaction.on_commit") as mock_on_commit:
        plugin.article_published(article)

        # The hook itself doesn't check is_published, that's done in article_published_actions
        assert mock_on_commit.called


def test_article_published_hook_logging(caplog):
    """Test that the hook logs appropriate messages"""
    user = UserFactory.create()
    article = Article.objects.create(
        title="Logging Test Article",
        content={},
        is_published=True,
        user=user,
    )

    plugin = ArticleNewsPlugin()

    with patch("news_events.plugins.transaction.on_commit"), caplog.at_level("INFO"):
        plugin.article_published(article)

        # Check that the plugin logged the sync message
        assert any(
            "ArticleNewsPlugin: Syncing article to news feed" in record.message
            for record in caplog.records
        )
        assert any(str(article.id) in record.message for record in caplog.records)
        assert any(article.title in record.message for record in caplog.records)


def test_article_published_hook_captures_article_id():
    """Test that the callback captures the correct article ID"""
    user = UserFactory.create()
    article = Article.objects.create(
        title="ID Capture Test",
        content={},
        is_published=True,
        user=user,
    )

    plugin = ArticleNewsPlugin()

    with patch("news_events.plugins.transaction.on_commit") as mock_on_commit:
        plugin.article_published(article)

        callback = mock_on_commit.call_args[0][0]

        # Verify the callback uses the captured article ID
        with patch("news_events.tasks.sync_article_to_news.delay") as mock_task:
            callback()
            mock_task.assert_called_once_with(article.id)
