"""Tests for articles models"""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from articles.models import Article

User = get_user_model()


@pytest.mark.django_db
@patch("articles.tasks.queue_fastly_purge_articles_list.delay")
@patch("articles.tasks.queue_fastly_purge_article.delay")
class TestArticleModel:
    """Tests for Article model"""

    def test_get_url_with_slug(self, _mock_queue_purge, _mock_queue_list):  # noqa: PT019
        """Test that get_url returns the correct URL for an article with a slug"""
        user = User.objects.create_user(username="testuser", email="test@example.com")
        article = Article.objects.create(
            title="Test Article",
            content={"type": "doc", "content": []},
            is_published=True,
            user=user,
        )

        assert article.get_url() == f"/news/{article.slug}"

    def test_get_url_without_slug(self, _mock_queue_purge, _mock_queue_list):  # noqa: PT019
        """Test that get_url returns None for an article without a slug"""
        user = User.objects.create_user(username="testuser2", email="test2@example.com")
        article = Article.objects.create(
            title="Draft Article",
            content={"type": "doc", "content": []},
            is_published=False,
            user=user,
        )

        assert article.get_url() is None

    def test_get_url_with_different_slugs(self, _mock_queue_purge, _mock_queue_list):  # noqa: PT019
        """Test that get_url returns different URLs for different slugs"""
        user = User.objects.create_user(username="testuser3", email="test3@example.com")
        article1 = Article.objects.create(
            title="First Article",
            content={"type": "doc", "content": []},
            is_published=True,
            user=user,
        )
        article2 = Article.objects.create(
            title="Second Article",
            content={"type": "doc", "content": []},
            is_published=True,
            user=user,
        )

        assert article1.get_url() == f"/news/{article1.slug}"
        assert article2.get_url() == f"/news/{article2.slug}"
        assert article1.get_url() != article2.get_url()

    def test_slug_generation_on_publish(self, _mock_queue_purge, _mock_queue_list):  # noqa: PT019
        """Test that slug is generated when article is published"""
        user = User.objects.create_user(username="testuser4", email="test4@example.com")
        article = Article.objects.create(
            title="Test Article Title",
            content={"type": "doc", "content": []},
            is_published=False,
            user=user,
        )

        # Initially no slug since not published
        assert article.slug is None

        # Publish the article
        article.is_published = True
        article.save()

        # Now should have a slug
        assert article.slug is not None
        assert article.slug == "test-article-title"
        assert article.get_url() == "/news/test-article-title"
