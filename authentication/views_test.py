"""Tests for authentication views"""

import json
from base64 import b64encode
from unittest.mock import MagicMock

import pytest
from django.conf import settings
from django.test import RequestFactory
from django.urls import reverse
from django.utils.http import urlencode

from authentication.views import CustomLoginView, get_redirect_url


@pytest.mark.parametrize(
    ("next_url", "allowed", "param_name"),
    [
        ("/app", True, "next"),
        ("http://open.odl.local:8062/search", True, "next"),
        ("http://open.odl.local:8069/search", False, "next"),
        ("https://ocw.mit.edu", True, "next"),
        ("https://fake.fake.edu", False, "next"),
        ("/app", True, "signup_next"),
        ("http://open.odl.local:8062/search", True, "signup_next"),
        ("http://open.odl.local:8069/search", False, "signup_next"),
        ("https://ocw.mit.edu", True, "signup_next"),
        ("https://fake.fake.edu", False, "signup_next"),
    ],
)
def test_get_redirect_url(mocker, next_url, allowed, param_name):
    """Next url should be respected if host is allowed"""
    mock_request = mocker.MagicMock(GET={param_name: next_url})
    assert get_redirect_url(mock_request, param_name=param_name) == (
        next_url if allowed else "/app"
    )


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
            "HTTP_X_USERINFO": b64encode(
                json.dumps(
                    {
                        "username": user.username,
                        "email": user.email,
                        "global_id": user.global_id,
                    }
                ).encode()
            ),
        }
    url_params = f"?next={next_url}" if has_next else ""
    resp = client.get(
        f"/logout/{url_params}",
        request=mock_request,
        follow=False,
        HTTP_X_USERINFO=b64encode(
            json.dumps(
                {
                    "username": user.username,
                    "email": user.email,
                    "global_id": user.global_id,
                }
            ).encode()
        ),
    )
    assert resp.status_code == 302
    if is_authenticated:
        # APISIX header is present, so user should be logged out there
        assert resp.url == settings.OIDC_LOGOUT_URL
    else:
        assert resp.url.endswith(next_url if has_next else "/app")


@pytest.mark.parametrize("is_authenticated", [True, False])
@pytest.mark.parametrize("has_next", [True, False])
def test_custom_logout_view(mocker, client, user, is_authenticated, has_next):
    """Test logout redirect"""
    next_url = "https://ocw.mit.edu" if has_next else ""
    mock_request = mocker.MagicMock(user=user, META={})
    if is_authenticated:
        mock_request.user = user
        client.force_login(user)
    resp = client.get(f"/logout/?next={next_url}", request=mock_request)
    assert resp.url == (next_url if has_next else "/app")


def test_custom_login_view_authenticated_user_with_onboarding(mocker):
    """Test CustomLoginView for an authenticated user with incomplete onboarding"""
    factory = RequestFactory()
    request = factory.get(
        reverse("login"),
        {"next": "/irrelevant", "signup_next": "/search?resource=184"},
    )
    request.user = MagicMock(is_anonymous=False)
    request.user.profile = MagicMock(completed_onboarding=False)
    mocker.patch(
        "authentication.views.settings.MITOL_NEW_USER_LOGIN_URL", "/onboarding"
    )

    response = CustomLoginView().get(request)

    assert response.status_code == 302
    assert response.url == f"/onboarding?{urlencode({'next': '/search?resource=184'})}"


def test_custom_login_view_authenticated_user_skip_onboarding(mocker):
    """Test skip_onboarding flag skips redirect to onboarding and sets completed_onboarding"""
    factory = RequestFactory()
    request = factory.get(
        reverse("login"),
        {
            "next": "/irrelevant",
            "signup_next": "/search?resource=184",
            "skip_onboarding": "1",
        },
    )
    request.user = MagicMock(is_anonymous=False)
    request.user.profile = MagicMock(completed_onboarding=False)

    response = CustomLoginView().get(request)
    request.user.profile.refresh_from_db()
    # user should not be marked as completed onboarding
    assert request.user.profile.completed_onboarding is False

    assert response.status_code == 302
    assert response.url == "/search?resource=184"


def test_custom_login_view_authenticated_user_with_completed_onboarding(mocker):
    """Test test that user who has completed onboarding is redirected to next url"""
    factory = RequestFactory()
    request = factory.get(
        reverse("login"), {"next": "/dashboard", "signup_next": "/irrelevant"}
    )
    request.user = MagicMock(is_anonymous=False)
    request.user.profile = MagicMock(completed_onboarding=True)

    response = CustomLoginView().get(request)

    assert response.status_code == 302
    assert response.url == "/dashboard"


def test_custom_login_view_anonymous_user(mocker):
    """Test redirect for anonymous user"""
    factory = RequestFactory()
    request = factory.get(reverse("login"), {"next": "/dashboard"})
    request.user = MagicMock(is_anonymous=True)
    mocker.patch("authentication.views.get_redirect_url", return_value="/dashboard")

    response = CustomLoginView().get(request)

    assert response.status_code == 302
    assert response.url == "/dashboard"
