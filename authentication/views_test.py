"""Tests for authentication views"""

import json
from base64 import b64encode
from re import M

import pytest
from django.conf import settings
from django.core.cache import caches

from authentication.views import get_redirect_url, next_cache_key
from main.middleware.apisix_user import ApisixUserMiddleware


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


@pytest.mark.parametrize("has_apisix_header", [True, False])
@pytest.mark.parametrize("next_url", ["/search", None])
def test_logout(mocker, next_url, client, user, has_apisix_header):
    """User should be properly redirected and logged out"""
    header_str = b64encode(
        json.dumps(
            {
                "username": user.username,
                "email": user.email,
                "global_id": user.global_id,
            }
        ).encode()
    )
    mock_logout = mocker.patch("authentication.views.logout")
    client.force_login(user)
    response = client.get(
        f"/logout/?next={next_url or ''}",
        follow=False,
        HTTP_X_USERINFO=header_str if has_apisix_header else None,
    )
    if has_apisix_header:
        assert response.url == settings.OIDC_LOGOUT_URL
    else:
        assert response.url == (next_url if next_url else "/app")
    mock_logout.assert_called_once()


@pytest.mark.parametrize("is_authenticated", [True])
@pytest.mark.parametrize("has_next", [False])
def test_next_logout(mocker, client, user, is_authenticated, has_next):
    """Test logout redirect cache assignment"""
    next_url = "https://ocw.mit.edu"
    mock_request = mocker.MagicMock(
        GET={"next": next_url if has_next else None},
    )
    if is_authenticated:
        client.force_login(user)
        mock_request.user = user
        mock_request.META = {
            "HTTP_X_USERINFO": b64encode(json.dumps({"username": user.username, "email": user.email, "global_id": user.global_id}).encode()),
        }
    url_params = f"?next={next_url}" if has_next else ""
    resp = client.get(f"/logout/{url_params}", request=mock_request,  follow=False, HTTP_X_USERINFO=b64encode(json.dumps({"username": user.username, "email": user.email, "global_id": user.global_id}).encode()))
    assert resp.status_code == 302
    assert (caches["redis"].get(f"{user.username}_next_logout") == next_url) is (
        is_authenticated and has_next
    )
    if is_authenticated:
        # APISIX header is present, so user should be logged out there
        assert resp.url == settings.OIDC_LOGOUT_URL
    else:
        assert resp.url.endswith(next_url if has_next else "/app")


@pytest.mark.parametrize("is_authenticated", [True, False])
@pytest.mark.parametrize("has_next", [True, False])
def test_custom_logout_view(mocker, client, user, is_authenticated, has_next):
    """Test logout redirect"""
    next_url = "https://ocw.mit.edu"
    if has_next:
        caches["redis"].set(next_cache_key(user.username), next_url, timeout=30)
        assert caches["redis"].get(next_cache_key(user.username)) == next_url
    mock_request = mocker.MagicMock(user=user, META={})
    if is_authenticated:
        mock_request.user = user
        client.force_login(user)
    resp = client.get("/logout/", request=mock_request)
    assert resp.url == (next_url if (has_next and is_authenticated) else "/app")

