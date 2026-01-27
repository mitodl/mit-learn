"""Tests for articles signals"""

from unittest.mock import patch

import pytest

from articles.factories import ArticleFactory
from articles.models import Article
from articles.signals import purge_article_on_save


@pytest.mark.django_db
class TestPurgeArticleOnSave:
    """Tests for purge_article_on_save signal"""

    @patch("articles.tasks.queue_fastly_purge_article")
    @patch("articles.tasks.queue_fastly_purge_articles_list")
    def test_purge_on_published_article_save(self, mock_purge_list, mock_purge_article):
        """Test that CDN purge is triggered when a published article is saved"""
        article = ArticleFactory(is_published=True)

        # The signal should have been triggered during ArticleFactory creation
        mock_purge_article.delay.assert_called_once_with(article.id)
        mock_purge_list.delay.assert_called_once()

    @patch("articles.tasks.queue_fastly_purge_article")
    @patch("articles.tasks.queue_fastly_purge_articles_list")
    def test_no_purge_on_unpublished_article_save(
        self, mock_purge_list, mock_purge_article
    ):
        """Test that CDN purge is NOT triggered for unpublished articles"""
        ArticleFactory(is_published=False)

        mock_purge_article.delay.assert_not_called()
        mock_purge_list.delay.assert_not_called()

    @patch("articles.tasks.queue_fastly_purge_article")
    @patch("articles.tasks.queue_fastly_purge_articles_list")
    def test_no_purge_on_article_without_slug(
        self, mock_purge_list, mock_purge_article
    ):
        """Test that CDN purge is NOT triggered for articles without slug"""
        # Create article unpublished first
        article = ArticleFactory(is_published=False)
        mock_purge_article.delay.reset_mock()
        mock_purge_list.delay.reset_mock()

        # Directly update slug to None and bypass model save logic
        Article.objects.filter(pk=article.id).update(is_published=True, slug=None)
        article.refresh_from_db()

        # Manually trigger the signal
        from django.db.models.signals import post_save

        post_save.send(sender=Article, instance=article, created=False)

        # Should not be called since slug is None
        mock_purge_article.delay.assert_not_called()
        mock_purge_list.delay.assert_not_called()

    @patch("articles.tasks.queue_fastly_purge_article")
    @patch("articles.tasks.queue_fastly_purge_articles_list")
    def test_purge_on_article_update(self, mock_purge_list, mock_purge_article):
        """Test that CDN purge is triggered when an article is updated"""
        # Create unpublished article first
        article = ArticleFactory(is_published=False)

        # Reset mocks
        mock_purge_article.reset_mock()
        mock_purge_list.reset_mock()

        # Now publish it
        article.is_published = True
        article.save()

        # Should trigger purge
        mock_purge_article.delay.assert_called_once_with(article.id)
        mock_purge_list.delay.assert_called_once()

    @patch("articles.tasks.queue_fastly_purge_article")
    @patch("articles.tasks.queue_fastly_purge_articles_list")
    def test_signal_handler_directly(self, mock_purge_list, mock_purge_article):
        """Test calling the signal handler directly"""
        article = ArticleFactory.build(is_published=True, slug="test-article")
        article.save()

        purge_article_on_save(sender=article.__class__, instance=article, created=True)

        # Should be called twice: once from save, once from direct call
        assert mock_purge_article.delay.call_count == 2
        assert mock_purge_list.delay.call_count == 2
