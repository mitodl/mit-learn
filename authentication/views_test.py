"""Tests for authentication views"""

import pytest
from django.core.cache import caches

from authentication.views import get_redirect_url, next_cache_key


@pytest.fixture(autouse=True)
def cache_settings(settings):
    """Use the memory cache as a substitute for the redis cache."""
    settings.CACHES["redis"] = {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }


@pytest.mark.parametrize(
    ("next_url", "allowed"),
    [
        ("/app", True),
        ("http://open.odl.local:8062/search", True),
        ("http://open.odl.local:8069/search", False),
        ("https://ocw.mit.edu", True),
        ("https://fake.fake.edu", False),
    ],
)
def test_custom_login(mocker, next_url, allowed):
    """Next url should be respected if host is allowed"""
    mock_request = mocker.MagicMock(GET={"next": next_url})
    assert get_redirect_url(mock_request) == (next_url if allowed else "/app")


@pytest.mark.parametrize("is_authenticated", [True, False])
@pytest.mark.parametrize("has_next", [True, False])
def test_next_logout(mocker, client, user, is_authenticated, has_next):
    """Test NextLogoutView"""
    next_url = "https://ocw.mit.edu"
    mock_request = mocker.MagicMock(GET={"next": next_url if has_next else None})
    if is_authenticated:
        mock_request.user = user
        client.force_login(user)
    url_params = f"?next={next_url}" if has_next else ""
    resp = client.get(f"/next_logout/{url_params}", request=mock_request)
    assert resp.status_code == 302
    assert (caches["redis"].get(f"{user.username}_next_logout") == next_url) is (
        is_authenticated and has_next
    )
    assert resp.url.endswith("/logout/oidc")


@pytest.mark.parametrize("is_authenticated", [True, False])
@pytest.mark.parametrize("has_next", [True, False])
def test_custom_logout_view(mocker, client, user, is_authenticated, has_next):
    """Test CustomLogoutView"""
    next_url = "https://ocw.mit.edu"
    if has_next:
        caches["redis"].set(next_cache_key(user.username), next_url, timeout=30)
    mock_request = mocker.MagicMock()
    if is_authenticated:
        mock_request.user = user
        client.force_login(user)
    resp = client.get("/logout/", request=mock_request)
    assert resp.url == (next_url if (has_next and is_authenticated) else "/app")
