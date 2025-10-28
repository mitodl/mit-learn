"""Project conftest"""

# pylint: disable=wildcard-import, unused-wildcard-import
from types import SimpleNamespace

import pytest

from fixtures.aws import *  # noqa: F403
from fixtures.common import *  # noqa: F403
from fixtures.opensearch import *  # noqa: F403
from fixtures.users import *  # noqa: F403
from main.exceptions import DoNotUseRequestException


@pytest.fixture(autouse=True)
def prevent_requests(mocker, request):
    """Patch requests to error on request by default"""
    if "mocked_responses" in request.fixturenames:
        return
    mocker.patch(
        "requests.sessions.Session.request",
        autospec=True,
        side_effect=DoNotUseRequestException,
    )


@pytest.fixture(autouse=True)
def _use_dummy_redis_cache_backend(settings):
    new_cache_settings = settings.CACHES.copy()
    new_cache_settings["redis"] = {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
    settings.CACHES = new_cache_settings


@pytest.fixture(autouse=True)
def mock_apsisix_auth(mocker):
    """Mock the Apisix header login/logout functions."""
    mock_login = mocker.patch("main.middleware.apisix_user.login")
    mock_logout = mocker.patch("main.middleware.apisix_user.logout")
    return SimpleNamespace(login=mock_login, logout=mock_logout)


@pytest.fixture
def sample_youtube_metadata():
    """Sample YouTube API v3 metadata for testing video shorts webhook"""
    return {
        "contentDetails": {
            "caption": "false",
            "contentRating": {},
            "definition": "hd",
            "dimension": "2d",
            "duration": "PT59S",
            "licensedContent": False,
            "projection": "rectangular",
        },
        "etag": "woYA2syI9y2lnDCE2QN4GAi7Rzs",
        "id": "k_AA4_fQIHc",
        "kind": "youtube#video",
        "snippet": {
            "categoryId": "27",
            "channelId": "UCN0QBfKk0ZSytyX_16M11fA",
            "channelTitle": "MIT Open Learning",
            "defaultAudioLanguage": "en",
            "defaultLanguage": "en",
            "description": (
                "The Kármán line is 100 kilometers above Earth's surface. "
                "For context,  that distance is shorter than a trip between "
                "Boston and New York City or London and Paris.\n\n"
                "Keep learning about spaceflight with MIT Prof. Jeff Hoffman "
                "on MIT Learn: https://learn.mit.edu/search?resource=2766"
            ),
            "liveBroadcastContent": "none",
            "localized": {
                "description": (
                    "The Kármán line is 100 kilometers above Earth's surface. "
                    "For context,  that distance is shorter than a trip between "
                    "Boston and New York City or London and Paris.\n\n"
                    "Keep learning about spaceflight with MIT Prof. Jeff Hoffman "
                    "on MIT Learn: https://learn.mit.edu/search?resource=2766"
                ),
                "title": "How far away is space?",
            },
            "publishedAt": "2025-09-24T15:33:27Z",
            "thumbnails": {
                "default": {
                    "height": 90,
                    "url": "https://i.ytimg.com/vi/k_AA4_fQIHc/default.jpg",
                    "width": 120,
                },
                "high": {
                    "height": 360,
                    "url": "https://i.ytimg.com/vi/k_AA4_fQIHc/hqdefault.jpg",
                    "width": 480,
                },
                "maxres": {
                    "height": 720,
                    "url": "https://i.ytimg.com/vi/k_AA4_fQIHc/maxresdefault.jpg",
                    "width": 1280,
                },
                "medium": {
                    "height": 180,
                    "url": "https://i.ytimg.com/vi/k_AA4_fQIHc/mqdefault.jpg",
                    "width": 320,
                },
                "standard": {
                    "height": 480,
                    "url": "https://i.ytimg.com/vi/k_AA4_fQIHc/sddefault.jpg",
                    "width": 640,
                },
            },
            "title": "How far away is space?",
        },
        "statistics": {
            "commentCount": "1",
            "favoriteCount": "0",
            "likeCount": "103",
            "viewCount": "3413",
        },
    }
