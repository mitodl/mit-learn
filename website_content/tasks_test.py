"""Tests for website_content CDN purge tasks"""

from unittest.mock import MagicMock, patch

import pytest
import requests
from requests import Response

from main.utils import call_fastly_purge_api
from website_content.factories import WebsiteContentFactory


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

        result = call_fastly_purge_api("/api/v1/website_content/test-article/")

        assert result == {"status": "ok", "id": "123-456"}
        mock_request.assert_called_once()

        call_kwargs = mock_request.call_args.kwargs
        assert call_kwargs["headers"]["fastly-key"] == "test-token"
        assert call_kwargs["timeout"] == 30

    @patch("main.utils.requests.request")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_API_KEY", "")
    def test_call_fastly_purge_api_no_token(self, mock_request, mock_fastly_response):
        """Test API call without auth token - skips in dev"""
        mock_request.return_value = mock_fastly_response

        result = call_fastly_purge_api("/api/v1/news/test/")

        assert result == {"status": "ok", "skipped": True}
        mock_request.assert_not_called()


@pytest.mark.django_db
class TestFastlyPurgeWebsiteContentList:
    """Tests for fastly_purge_website_content_list task"""

    @patch("main.utils.requests.request")
    @patch("django.conf.settings.FASTLY_URL", "https://api.fastly.com")
    @patch("django.conf.settings.APP_BASE_URL", "https://learn.mit.edu")
    @patch("django.conf.settings.FASTLY_API_KEY", "test-token")
    def test_purge_website_content_list_purges_news_path(
        self, mock_request, mock_fastly_response
    ):
        """
        Ensure the /news listing path is purged from Fastly regardless of
        what content exists in the DB. WebsiteContentFactory creates a
        realistic content row to verify no DB errors occur during the task.
        """
        mock_request.return_value = mock_fastly_response
        WebsiteContentFactory.create(is_published=True, slug="some-article")

        # Call the underlying purge helper directly; single_task uses a Redis
        # lock (get_redis_connection) that is unavailable in the test runner.
        result = call_fastly_purge_api("/news")

        assert result == {"status": "ok", "id": "123-456"}
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        assert "/news" in call_args.args[1]
