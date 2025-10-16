"""Tests for authentication views"""

import json
from base64 import b64encode
from typing import NamedTuple
from unittest.mock import MagicMock
from urllib.parse import urljoin

import pytest
from django.test import RequestFactory
from django.urls import reverse
from django.utils.http import urlencode

from authentication.views import CustomLoginView, get_redirect_url


@pytest.mark.parametrize(
    ("param_names", "expected_redirect"),
    [
        (["exists-a"], "/url-a"),
        (["exists-b"], "/url-b"),
        (["exists-a", "exists-b"], "/url-a"),
        (["exists-b", "exists-a"], "/url-b"),
        (["not-exists-x", "exists-a"], "/url-a"),
        (["not-exists-x", "not-exists-y"], "/app"),
        # With disallowed hosts in the params
        (["disallowed-1"], "/app"),
        (["not-exists-x", "disallowed-1"], "/app"),
        (["disallowed-1", "exists-a"], "/url-a"),
        (["allowed-2"], "https://good.com/url-2"),
    ],
)
def test_get_redirect_url(mocker, param_names, expected_redirect):
    """Next url should be respected if host is allowed"""
    GET = {
        "exists-a": "/url-a",
        "exists-b": "/url-b",
        "exists-c": "/url-c",
        "disallowed-a": "https://malicious.com/url-1",
        "allowed-2": "https://good.com/url-2",
    }
    mocker.patch(
        "authentication.views.settings.ALLOWED_REDIRECT_HOSTS",
        ["good.com"],
    )

    mock_request = mocker.MagicMock(GET=GET)
    assert get_redirect_url(mock_request, param_names) == expected_redirect


@pytest.mark.parametrize(
    "test_params",
    [
        # has_apisix_header, next_url
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


@pytest.mark.parametrize(
    (
        "req_data",
        "expected_redirect",
    ),
    [
        (
            {"next": "/irrelevant", "signup_next": "/this?after=signup"},
            "/this?after=signup",
        ),
        (
            {"next": "/redirect?here=ok"},  # falls back to next
            "/redirect?here=ok",
        ),
    ],
)
@pytest.mark.parametrize(
    ("skip_onboarding", "expect_onboarding"),
    [
        (None, True),  # default behavior is to do onboarding
        ("0", True),  # explicit skip_onboarding=0 means do onboarding
        ("1", False),  # explicit skip_onboarding=1 means skip onboarding
    ],
)
def test_custom_login_view_authenticated_user_needs_onboarding(
    mocker, req_data, expected_redirect, skip_onboarding, expect_onboarding
):
    """Test CustomLoginView for an authenticated user with incomplete onboarding"""
    factory = RequestFactory()
    if skip_onboarding is not None:
        req_data["skip_onboarding"] = skip_onboarding
    request = factory.get(reverse("login"), req_data)

    request.user = MagicMock(is_anonymous=False)
    request.user.profile = MagicMock(has_logged_in=False)
    mocker.patch(
        "authentication.views.settings.MITOL_NEW_USER_LOGIN_URL", "/onboarding"
    )
    mocker.patch("authentication.views.decode_apisix_headers", return_value={})

    response = CustomLoginView().get(request)

    assert response.status_code == 302

    if expect_onboarding:
        assert response.url == f"/onboarding?{urlencode({'next': expected_redirect})}"
    else:
        assert response.url == expected_redirect


def test_custom_login_view_authenticated_user_who_has_logged_in_before(mocker):
    """Test that user who has logged in before is redirected to next url"""
    factory = RequestFactory()
    request = factory.get(
        reverse("login"),
        {"next": "/should-be-redirect?foo", "signup_next": "/irrelevant"},
    )
    request.user = MagicMock(is_anonymous=False)
    request.user.profile = MagicMock(has_logged_in=True)

    response = CustomLoginView().get(request)

    assert response.status_code == 302
    assert response.url == "/should-be-redirect?foo"


def test_custom_login_view_anonymous_user(mocker):
    """Test redirect for anonymous user"""
    factory = RequestFactory()
    request = factory.get(
        reverse("login"), {"next": "/some-url", "signup_next": "/irrelevant"}
    )
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

    response = CustomLoginView().get(request)

    # Verify the response
    assert response.status_code == 302

    # Verify that has_logged_in was set to True and profile was saved
    assert mock_profile.has_logged_in is True
    mock_profile.save.assert_called_once()


class LoginOrgUserRedirectParams(NamedTuple):
    """Parameters for testing org user login redirect behavior"""

    has_logged_in: bool
    login_url: str
    expected_redirect: str


@pytest.mark.parametrize(
    "params",
    [
        LoginOrgUserRedirectParams(
            has_logged_in=False,
            login_url="/login/?next=/dashboard",
            expected_redirect="/dashboard",
        ),
        LoginOrgUserRedirectParams(
            has_logged_in=False,
            login_url="/login/?next=/dashboard&signup_next=/somewhere-else",
            expected_redirect="/somewhere-else",
        ),
        LoginOrgUserRedirectParams(
            has_logged_in=True,
            login_url="/login/?next=/dashboard&signup_next=/somewhere-else",
            expected_redirect="/dashboard",
        ),
    ],
)
def test_login_org_user_redirect(
    mocker,
    client,
    user,
    params,
    settings,
):
    """Test organization user redirect behavior - org users skip onboarding regardless of login history"""
    has_logged_in, login_url, expected_redirect = params

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
        login_url,
        follow=False,
        HTTP_X_USERINFO=header_str,
    )
    assert response.status_code == 302
    # Handle environment differences - in some envs it returns full URL, in others just path
    expected_full_redirect = urljoin(settings.APP_BASE_URL, expected_redirect)
    assert response.url in [expected_redirect, expected_full_redirect]

    # Verify that org users are never sent to onboarding
    # (onboarding URL would contain settings.MITOL_NEW_USER_LOGIN_URL)
    assert settings.MITOL_NEW_USER_LOGIN_URL not in response.url

    user.profile.refresh_from_db()
    assert user.profile.has_logged_in is True
