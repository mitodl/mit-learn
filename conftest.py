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
def sample_video_metadata():
    """Sample metadata for testing video shorts webhook"""
    return {
        "video_id": "k_AA4_fQIHc",
        "published_at": "2025-09-24T15:33:27Z",
        "title": "How far away is space?",
        "video_url": "/shorts/k_AA4_fQIHc/k_AA4_fQIHc.mp4",
        "thumbnail_small": {
            "url": "/shorts/k_AA4_fQIHc/k_AA4_fQIHc_small.jpg",
            "height": 480,
            "width": 270,
        },
        "thumbnail_large": {
            "url": "/shorts/k_AA4_fQIHc/k_AA4_fQIHc_large.jpg",
            "height": 1920,
            "width": 1080,
        },
    }
