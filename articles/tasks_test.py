"""Tests for articles CDN purge tasks"""

from unittest.mock import MagicMock, Mock, patch

import pytest
from requests import Response

from articles.factories import ArticleFactory
from articles.tasks import (
    queue_fastly_full_purge,
    queue_fastly_purge_article,
    queue_fastly_purge_articles_list,
)
from main.utils import call_fastly_purge_api


@pytest.fixture
def mock_fastly_response():
    """Create a mock successful Fastly response"""
    response = MagicMock(spec=Response)
    response.status_code = 200
    response.json.return_value = {"status": "ok", "id": "123-456"}
    response.text = '{"status": "ok", "id": "123-456"}'
    return response


@pytest.fixture
def mock_fastly_error_response():
    """Create a mock error Fastly response"""
    response = MagicMock(spec=Response)
    response.status_code = 403
    response.reason = "Forbidden"
    response.text = '{"status": "error", "msg": "Invalid API key"}'
    return response


@pytest.mark.django_db
class TestCallFastlyPurgeApi:
    """Tests for call_fastly_purge_api function"""

    @patch("main.utils.requests.request")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    def test_call_fastly_purge_api_success(self, mock_request, mock_fastly_response):
        """Test successful Fastly API call"""
        mock_request.return_value = mock_fastly_response

        result = call_fastly_purge_api("/api/v1/articles/test-article/")

        assert result == {"status": "ok", "id": "123-456"}
        mock_request.assert_called_once()

        # Verify headers were set correctly
        call_kwargs = mock_request.call_args.kwargs
        assert call_kwargs["headers"]["fastly-key"] == "test-token"
        assert call_kwargs["timeout"] == 30

    @patch("main.utils.requests.request")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    def test_call_fastly_purge_api_full_purge(self, mock_request, mock_fastly_response):
        """Test full cache purge (wildcard)"""
        mock_request.return_value = mock_fastly_response

        result = call_fastly_purge_api("*")

        assert result == {"status": "ok", "id": "123-456"}

        # Verify soft-purge is NOT set for wildcard
        call_kwargs = mock_request.call_args.kwargs
        assert "fastly-soft-purge" not in call_kwargs["headers"]

    @patch("main.utils.requests.request")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_API_KEY", "")
    def test_call_fastly_purge_api_no_token(self, mock_request, mock_fastly_response):
        """Test API call without auth token - skips in dev"""
        mock_request.return_value = mock_fastly_response

        result = call_fastly_purge_api("/api/v1/news/test/")

        # Should skip purge when API key is empty (dev environment)
        assert result == {"status": "ok", "skipped": True}

        # Verify API was not called
        mock_request.assert_not_called()

    @patch("main.utils.requests.request")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    def test_call_fastly_purge_api_error(
        self, mock_request, mock_fastly_error_response
    ):
        """Test Fastly API error response"""
        mock_request.return_value = mock_fastly_error_response

        result = call_fastly_purge_api("/api/v1/news/test/")

        assert result is False


@pytest.mark.django_db
@patch("articles.tasks.queue_fastly_purge_articles_list.delay")
class TestQueueFastlyPurgeArticle:
    """Tests for queue_fastly_purge_article task"""

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    def test_purge_published_article(self, mock_request, _mock_fastly_response):  # noqa: PT019
        """Test purging a published article"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok"}
        mock_request.return_value = mock_response

        article = ArticleFactory(is_published=True)
        # Manually set slug since factory doesn't do it
        article.slug = "test-article"
        article.save()

        # Reset mock since signal was triggered during creation
        mock_request.reset_mock()

        result = queue_fastly_purge_article(article.id)

        assert result is True
        mock_request.assert_called_once()

    @patch("main.utils.requests.request")
    def test_purge_unpublished_article(self, mock_request, _mock_fastly_response):  # noqa: PT019
        """Test that unpublished articles are not purged"""
        article = ArticleFactory(is_published=False)
        article.slug = "test-article"
        article.save()

        result = queue_fastly_purge_article(article.id)

        assert result is False
        mock_request.assert_not_called()

    @patch("main.utils.requests.request")
    def test_purge_article_without_slug(self, mock_request, _mock_fastly_response):  # noqa: PT019
        """Test that articles without slug are not purged"""
        article = ArticleFactory(is_published=True)
        # Don't set slug, leave it None - reset it to None
        article.slug = None
        article.save()

        # Reset mock since signal was triggered during creation
        mock_request.reset_mock()

        result = queue_fastly_purge_article(article.id)

        assert result is False
        mock_request.assert_not_called()

    @patch("main.utils.requests.request")
    def test_purge_nonexistent_article(self, mock_request, _mock_fastly_response):  # noqa: PT019
        """Test purging a non-existent article"""
        result = queue_fastly_purge_article(99999)

        assert result is False
        mock_request.assert_not_called()

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    def test_purge_article_api_failure(self, mock_request, _mock_fastly_response):  # noqa: PT019
        """Test handling API failure"""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"status": "error"}
        mock_request.return_value = mock_response

        article = ArticleFactory(is_published=True)
        article.slug = "test-article"
        article.save()

        result = queue_fastly_purge_article(article.id)

        assert result is False

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    def test_purge_article_api_error_status(
        self,
        mock_request,
        _mock_fastly_response,  # noqa: PT019
    ):
        """Test handling API error status"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.json.return_value = {"status": "error"}
        mock_request.return_value = mock_response

        article = ArticleFactory(is_published=True)
        article.slug = "test-article"
        article.save()

        result = queue_fastly_purge_article(article.id)

        assert result is False


@pytest.mark.django_db
class TestQueueFastlyFullPurge:
    """Tests for queue_fastly_full_purge task"""

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    def test_full_purge_success(self, mock_request, mock_fastly_response):
        """Test successful full cache purge"""
        mock_request.return_value = mock_fastly_response

        result = queue_fastly_full_purge()

        assert result is True
        mock_request.assert_called_once()

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    def test_full_purge_failure(self, mock_request, mock_fastly_error_response):
        """Test failed full cache purge"""
        mock_request.return_value = mock_fastly_error_response

        result = queue_fastly_full_purge()

        assert result is False


@pytest.mark.django_db
class TestQueueFastlyPurgeArticlesList:
    """Tests for queue_fastly_purge_articles_list task"""

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    @patch("mitol.common.decorators.get_redis_connection")
    def test_purge_articles_list_success(
        self, mock_redis, mock_request, mock_fastly_response
    ):
        """Test successful articles list purge"""
        mock_request.return_value = mock_fastly_response
        mock_redis.return_value.get.return_value = None

        result = queue_fastly_purge_articles_list()

        assert result is True
        mock_request.assert_called_once()

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    @patch("mitol.common.decorators.get_redis_connection")
    def test_purge_articles_list_failure(
        self, mock_redis, mock_request, mock_fastly_error_response
    ):
        """Test failed articles list purge"""
        mock_request.return_value = mock_fastly_error_response
        mock_redis.return_value.get.return_value = None

        result = queue_fastly_purge_articles_list()

        assert result is False
