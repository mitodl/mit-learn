"""Tests for authentication views"""

import json
from base64 import b64encode
from unittest.mock import MagicMock
from urllib.parse import urljoin

import pytest
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


@pytest.mark.parametrize(
    "test_params",
    [
        (True, "/search"),
        (True, None),
        (False, "/search"),
        (False, None),
    ],
)
def test_logout(mocker, client, user, test_params, settings):
    """User should be properly redirected and logged out"""
    has_apisix_header, next_url = test_params
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


@pytest.mark.parametrize("test_params", [(True, False)])
def test_next_logout(mocker, client, user, test_params, settings):
    """Test logout redirect cache assignment"""
    is_authenticated, has_next = test_params
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
    """Test CustomLoginView for an authenticated user who has never logged in before"""
    factory = RequestFactory()
    request = factory.get(
        reverse("login"),
        {"next": "/irrelevant", "signup_next": "/search?resource=184"},
    )
    request.user = MagicMock(is_anonymous=False)
    request.user.profile = MagicMock(has_logged_in=False)
    mocker.patch(
        "authentication.views.settings.MITOL_NEW_USER_LOGIN_URL", "/onboarding"
    )
    mocker.patch("authentication.views.decode_apisix_headers", return_value={})

    response = CustomLoginView().get(request)

    assert response.status_code == 302
    assert response.url == f"/onboarding?{urlencode({'next': '/search?resource=184'})}"


def test_custom_login_view_authenticated_user_skip_onboarding(mocker):
    """Test skip_onboarding flag skips redirect to onboarding"""
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
    request.user.profile = MagicMock(has_logged_in=False)

    response = CustomLoginView().get(request)

    # Verify has_logged_in was set to True and profile was saved
    assert request.user.profile.has_logged_in is True
    request.user.profile.save.assert_called_once()

    assert response.status_code == 302
    assert response.url == "/search?resource=184"


def test_custom_login_view_authenticated_user_who_has_logged_in_before(mocker):
    """Test that user who has logged in before is redirected to next url"""
    factory = RequestFactory()
    request = factory.get(
        reverse("login"), {"next": "/dashboard", "signup_next": "/irrelevant"}
    )
    request.user = MagicMock(is_anonymous=False)
    request.user.profile = MagicMock(has_logged_in=True)

    response = CustomLoginView().get(request)

    assert response.status_code == 302
    assert response.url == "/dashboard"


def test_custom_login_view_anonymous_user(mocker):
    """Test redirect for anonymous user"""
    factory = RequestFactory()
    request = factory.get(reverse("login"), {"next": "/some-url"})
    request.user = MagicMock(is_anonymous=True)

    response = CustomLoginView().get(request)

    assert response.status_code == 302
    assert response.url == "/some-url"


def test_custom_login_view_first_time_login_sets_has_logged_in(mocker):
    """Test that has_logged_in flag is set to True for first-time login with skip_onboarding"""
    factory = RequestFactory()
    request = factory.get("/login/", {"next": "/dashboard", "skip_onboarding": "1"})

    # Create a mock user with a profile that has has_logged_in=False
    mock_profile = MagicMock()
    mock_profile.has_logged_in = False

    mock_user = MagicMock()
    mock_user.is_anonymous = False
    mock_user.profile = mock_profile

    request.user = mock_user

    # Mock the redirect function to avoid URL resolution
    mock_redirect = mocker.patch("authentication.views.redirect")
    mock_redirect.return_value = MagicMock(status_code=302, url="/dashboard")
    mocker.patch("authentication.views.get_redirect_url", return_value="/dashboard")
    mocker.patch("authentication.views.decode_apisix_headers", return_value={})

    response = CustomLoginView().get(request)

    # Verify the response
    assert response.status_code == 302

    # Verify that has_logged_in was set to True and profile was saved
    assert mock_profile.has_logged_in is True
    mock_profile.save.assert_called_once()

    # Verify redirect was called with the correct URL
    mock_redirect.assert_called_once_with("/dashboard")


@pytest.mark.parametrize(
    "test_case",
    [
        (
            False,
            "/dashboard/organization/test-organization",
        ),  # First-time login → org dashboard
        (
            True,
            "/app",
        ),  # Subsequent login → normal app
    ],
)
def test_login_org_user_redirect(mocker, client, user, test_case, settings):
    """Test organization user redirect behavior - org users skip onboarding regardless of login history"""
    # Unpack test case
    has_logged_in, expected_url = test_case

    # Set up user profile based on test scenario
    user.profile.has_logged_in = has_logged_in
    user.profile.save()

    header_str = b64encode(
        json.dumps(
            {
                "preferred_username": user.username,
                "email": user.email,
                "sub": user.global_id,
                "organization": {
                    "Test Organization": {
                        "role": "member",
                        "id": "org-123",
                    }
                },
            }
        ).encode()
    )
    client.force_login(user)
    response = client.get(
        "/login/",
        follow=False,
        HTTP_X_USERINFO=header_str,
    )
    assert response.status_code == 302
    # Handle environment differences - in some envs it returns full URL, in others just path
    expected_full_url = urljoin(settings.APP_BASE_URL, expected_url)
    assert response.url in [expected_url, expected_full_url]

    # Verify that org users are never sent to onboarding
    # (onboarding URL would contain settings.MITOL_NEW_USER_LOGIN_URL)
    assert settings.MITOL_NEW_USER_LOGIN_URL not in response.url
