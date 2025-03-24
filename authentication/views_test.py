"""Tests for authentication views"""

import json
from base64 import b64encode

import pytest
from django.conf import settings

from authentication.views import get_redirect_url


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
        assert response.url == f"{settings.MITOL_API_BASE_URL.rstrip('/')}/logout/oidc"
    else:
        assert response.url == (next_url if next_url else "/app")
    mock_logout.assert_called_once()
