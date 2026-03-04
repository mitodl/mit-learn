"""Tests for articles CDN purge tasks"""

from unittest.mock import MagicMock, patch

import pytest
import requests
from requests import Response

from articles.factories import ArticleFactory
from articles.tasks import (
    fastly_full_purge,
    fastly_purge_articles_list,
    fastly_purge_relative_url,
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
    response.raise_for_status.side_effect = requests.HTTPError("403 Forbidden")
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

        with pytest.raises(requests.HTTPError):
            call_fastly_purge_api("/api/v1/news/test/")


@pytest.mark.django_db
class TestFastlyPurgeRelativeUrl:
    """Tests for fastly_purge_relative_url task"""

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    def test_purge_url_success(self, mock_request, mock_fastly_response):
        """Test purging a URL successfully"""
        mock_request.return_value = mock_fastly_response

        article = ArticleFactory(is_published=True, slug="test-article")
        article_url = article.get_url()

        result = fastly_purge_relative_url(article_url)

        assert result["status"] == "ok"
        mock_request.assert_called_once()

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    def test_purge_url_api_failure(self, mock_request, mock_fastly_error_response):
        """Test handling API failure"""
        mock_request.return_value = mock_fastly_error_response

        with pytest.raises(requests.HTTPError):
            fastly_purge_relative_url("/news/test-article/")

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    def test_purge_url_with_timeout(self, mock_request, mock_fastly_response):
        """Test purging with custom timeout"""
        mock_request.return_value = mock_fastly_response

        result = fastly_purge_relative_url("/news/test/", timeout=5)

        assert result["status"] == "ok"
        call_kwargs = mock_request.call_args.kwargs
        assert call_kwargs["timeout"] == 5


@pytest.mark.django_db
class TestFastlyFullPurge:
    """Tests for fastly_full_purge task"""

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    def test_full_purge_success(self, mock_request, mock_fastly_response):
        """Test successful full cache purge"""
        mock_request.return_value = mock_fastly_response

        result = fastly_full_purge()

        assert result["status"] == "ok"
        mock_request.assert_called_once()

    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("main.utils.requests.request")
    def test_full_purge_failure(self, mock_request, mock_fastly_error_response):
        """Test failed full cache purge"""
        mock_request.return_value = mock_fastly_error_response

        with pytest.raises(requests.HTTPError):
            fastly_full_purge()


@pytest.mark.django_db
class TestFastlyPurgeArticlesList:
    """Tests for fastly_purge_articles_list task"""

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

        result = fastly_purge_articles_list()

        assert result["status"] == "ok"
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

        with pytest.raises(requests.HTTPError):
            fastly_purge_articles_list()
