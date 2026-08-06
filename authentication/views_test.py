"""Tests for authentication views"""

import json
from base64 import b64encode
from typing import NamedTuple
from unittest.mock import MagicMock
from urllib.parse import parse_qs, quote, urljoin, urlparse

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
def test_get_redirect_url(mocker, param_names, expected_redirect, settings):
    """Next url should be respected if host is allowed"""
    GET = {
        "exists-a": "/url-a",
        "exists-b": "/url-b",
        "exists-c": "/url-c",
        "disallowed-a": "https://malicious.com/url-1",
        "allowed-2": "https://good.com/url-2",
    }
    settings.ALLOWED_REDIRECT_HOSTS = ["good.com"]

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
def test_custom_logout_view(mocker, client, user, is_authenticated, has_next, settings):  # noqa: PLR0913
    """Test logout redirect"""
    settings.ALLOWED_REDIRECT_HOSTS = ["ocw.mit.edu"]
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
    mock_send_welcome_email = mocker.patch(
        "authentication.views.send_welcome_email.delay"
    )

    response = CustomLoginView().get(request)

    assert response.status_code == 302

    if expect_onboarding:
        assert response.url == f"/onboarding?{urlencode({'next': expected_redirect})}"
    else:
        assert response.url == expected_redirect
    mock_send_welcome_email.assert_called_once_with(request.user.id)


def test_custom_login_view_authenticated_user_who_has_logged_in_before(mocker):
    """Test that user who has logged in before is redirected to next url"""
    factory = RequestFactory()
    request = factory.get(
        reverse("login"),
        {"next": "/should-be-redirect?foo", "signup_next": "/irrelevant"},
    )
    request.user = MagicMock(is_anonymous=False)
    request.user.profile = MagicMock(has_logged_in=True)
    mock_send_welcome_email = mocker.patch(
        "authentication.views.send_welcome_email.delay"
    )

    response = CustomLoginView().get(request)

    assert response.status_code == 302
    assert response.url == "/should-be-redirect?foo"
    mock_send_welcome_email.assert_not_called()


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
    mock_user.id = 123
    mock_user.profile = mock_profile

    request.user = mock_user
    mock_send_welcome_email = mocker.patch(
        "authentication.views.send_welcome_email.delay"
    )

    response = CustomLoginView().get(request)

    # Verify the response
    assert response.status_code == 302

    # Verify that has_logged_in was set to True and profile was saved
    assert mock_profile.has_logged_in is True
    mock_profile.save.assert_called_once()
    mock_send_welcome_email.assert_called_once_with(mock_user.id)


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
    mock_send_welcome_email = mocker.patch(
        "authentication.views.send_welcome_email.delay"
    )

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
    if has_logged_in:
        mock_send_welcome_email.assert_not_called()
    else:
        mock_send_welcome_email.assert_called_once_with(user.id)


@pytest.fixture
def mock_is_sso_user(mocker):
    """Mock the SSO lookup, which otherwise talks to the Keycloak admin API"""
    return mocker.patch("authentication.views.is_sso_user", return_value=False)


@pytest.fixture(autouse=True)
def account_action_settings(settings):
    """
    Pin the settings the account action flow reads.

    KEYCLOAK_CLIENT_ID has no default and MITOL_API_BASE_URL defaults to empty,
    so without this these tests assert against whatever the environment
    happens to provide — passing locally and failing in CI.
    """
    settings.KEYCLOAK_BASE_URL = "https://sso.example.edu"
    settings.KEYCLOAK_REALM_NAME = "olapps"
    settings.KEYCLOAK_CLIENT_ID = "ol-mitlearn-client"
    settings.KEYCLOAK_CLIENT_SECRET = "a-secret"  # noqa: S105
    settings.MITOL_API_BASE_URL = "https://api.example.edu"
    return settings


@pytest.mark.parametrize(
    ("action", "kc_action"),
    [
        ("update-email", "UPDATE_EMAIL"),
        ("update-password", "UPDATE_PASSWORD"),
    ],
)
@pytest.mark.usefixtures("mock_is_sso_user")
def test_account_action_start(settings, client, action, kc_action):
    """The start view should send the user to Keycloak with the right kc_action"""
    next_url = urljoin(settings.APP_BASE_URL, "/dashboard/settings")
    resp = client.get(
        f"{reverse('account-action-start', kwargs={'action': action})}"
        f"?next={quote(next_url)}"
    )

    assert resp.status_code == 302
    parsed = urlparse(resp.headers["Location"])

    assert (
        f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        == f"{settings.KEYCLOAK_BASE_URL.removesuffix('/')}/realms/"
        f"{settings.KEYCLOAK_REALM_NAME}/protocol/openid-connect/auth"
    )

    expected_callback = (
        f"{settings.MITOL_API_BASE_URL.removesuffix('/')}"
        f"{reverse('account-action-complete')}"
        f"?{urlencode({'next': next_url, 'account_action': action})}"
    )
    assert parse_qs(parsed.query) == {
        "kc_action": [kc_action],
        "scope": ["openid email"],
        "response_type": ["code"],
        "client_id": [settings.KEYCLOAK_CLIENT_ID],
        "redirect_uri": [expected_callback],
    }


@pytest.mark.usefixtures("mock_is_sso_user")
def test_account_action_start_unknown_action(settings, client):
    """An unrecognized action should bounce back to settings with an error"""
    resp = client.get(
        reverse("account-action-start", kwargs={"action": "delete-account"})
    )

    assert resp.status_code == 302
    expected_params = urlencode(
        {"account_action": "delete-account", "account_action_status": "error"}
    )
    settings_url = f"{settings.APP_BASE_URL.removesuffix('/')}/dashboard/settings"
    assert resp.headers["Location"] == f"{settings_url}?{expected_params}"


def test_account_action_start_sso_user(settings, client, user, mock_is_sso_user):
    """SSO users should never be sent to Keycloak to change their credentials"""
    mock_is_sso_user.return_value = True
    client.force_login(user)

    resp = client.get(
        reverse("account-action-start", kwargs={"action": "update-email"})
    )

    assert resp.status_code == 302
    expected_params = urlencode(
        {"account_action": "update-email", "account_action_status": "unavailable"}
    )
    settings_url = f"{settings.APP_BASE_URL.removesuffix('/')}/dashboard/settings"
    assert resp.headers["Location"] == f"{settings_url}?{expected_params}"


@pytest.mark.parametrize("kc_action_status", ["success", "cancelled", "error"])
def test_account_action_complete(settings, client, mock_sync_email, kc_action_status):
    """The callback should hand the action's outcome back to the frontend"""
    # A confirmed change, so "success" is reported as-is rather than downgraded.
    mock_sync_email.return_value = True
    next_url = urljoin(settings.APP_BASE_URL, "/dashboard/settings")
    callback_params = urlencode(
        {
            "next": next_url,
            "account_action": "update-email",
            "kc_action_status": kc_action_status,
            "code": "ignored-authorization-code",
        }
    )
    resp = client.get(f"{reverse('account-action-complete')}?{callback_params}")

    expected_params = urlencode(
        {
            "account_action": "update-email",
            "account_action_status": kc_action_status,
        }
    )
    assert resp.status_code == 302
    assert resp.headers["Location"] == f"{next_url}?{expected_params}"


@pytest.mark.parametrize(
    ("action", "kc_action_status"),
    [
        # Keycloak didn't report an outcome
        ("update-email", None),
        ("update-email", "who-knows"),
        # Not an action we started
        ("delete-account", "success"),
        (None, "success"),
    ],
)
def test_account_action_complete_unusable_params(
    settings, client, action, kc_action_status
):
    """Without a usable outcome the user is returned without an alert"""
    next_url = urljoin(settings.APP_BASE_URL, "/dashboard/settings")
    params = {"next": next_url}
    if action is not None:
        params["account_action"] = action
    if kc_action_status is not None:
        params["kc_action_status"] = kc_action_status

    resp = client.get(f"{reverse('account-action-complete')}?{urlencode(params)}")

    assert resp.status_code == 302
    assert resp.headers["Location"] == next_url


@pytest.mark.usefixtures("mock_is_sso_user")
def test_account_action_disallowed_next(settings, client):
    """A `next` pointing off-site falls back to the settings page"""
    resp = client.get(
        f"{reverse('account-action-complete')}?"
        f"{urlencode({'next': 'https://malicious.com/phish'})}"
    )

    assert resp.status_code == 302
    assert (
        resp.headers["Location"]
        == f"{settings.APP_BASE_URL.removesuffix('/')}/dashboard/settings"
    )


@pytest.fixture
def mock_sync_email(mocker):
    """Mock the Keycloak email sync so tests don't reach the token endpoint"""
    return mocker.patch("authentication.views.sync_email_from_keycloak")


def test_account_action_complete_syncs_email(settings, client, user, mock_sync_email):
    """A successful email change pulls the new address from Keycloak"""
    client.force_login(user)
    next_url = urljoin(settings.APP_BASE_URL, "/dashboard/settings")
    params = urlencode(
        {
            "next": next_url,
            "account_action": "update-email",
            "kc_action_status": "success",
            "code": "an-authorization-code",
        }
    )

    resp = client.get(f"{reverse('account-action-complete')}?{params}")

    assert resp.status_code == 302
    mock_sync_email.assert_called_once()
    kwargs = mock_sync_email.call_args.kwargs
    assert kwargs["code"] == "an-authorization-code"
    # redirect_uri must match what the start view sent, or Keycloak rejects it
    assert kwargs["redirect_uri"] == (
        f"{settings.MITOL_API_BASE_URL.removesuffix('/')}"
        f"{reverse('account-action-complete')}"
        f"?{urlencode({'next': next_url, 'account_action': 'update-email'})}"
    )


@pytest.mark.parametrize(
    "callback_params",
    [
        pytest.param(
            {
                "account_action": "update-password",
                "kc_action_status": "success",
                "code": "c",
            },
            id="password-change",
        ),
        pytest.param(
            {
                "account_action": "update-email",
                "kc_action_status": "cancelled",
                "code": "c",
            },
            id="cancelled",
        ),
        pytest.param(
            {
                "account_action": "update-email",
                "kc_action_status": "error",
                "code": "c",
            },
            id="failed",
        ),
        pytest.param(
            {"account_action": "update-email", "kc_action_status": "success"},
            id="no-code",
        ),
    ],
)
def test_account_action_complete_does_not_sync_email(
    settings, client, user, mock_sync_email, callback_params
):
    """Only a successful email change triggers the Keycloak lookup"""
    client.force_login(user)
    params = urlencode(
        {
            "next": urljoin(settings.APP_BASE_URL, "/dashboard/settings"),
            **callback_params,
        }
    )

    resp = client.get(f"{reverse('account-action-complete')}?{params}")

    assert resp.status_code == 302
    mock_sync_email.assert_not_called()


def test_account_action_complete_syncs_without_session(
    settings, client, mock_sync_email
):
    """
    The sync runs even with no authenticated Django user.

    The APISIX middleware logs the user out on any request lacking an
    X-UserInfo header, which is the case on this callback when the gateway isn't
    in front of Django. The user is identified from Keycloak's `sub` instead.
    """
    params = urlencode(
        {
            "next": urljoin(settings.APP_BASE_URL, "/dashboard/settings"),
            "account_action": "update-email",
            "kc_action_status": "success",
            "code": "a-code",
        }
    )

    resp = client.get(f"{reverse('account-action-complete')}?{params}")

    assert resp.status_code == 302
    mock_sync_email.assert_called_once()


@pytest.mark.usefixtures("mock_is_sso_user")
def test_account_action_start_unconfigured_client(settings, client):
    """
    An environment without KEYCLOAK_CLIENT_ID must not 500.

    The setting has no default, and urlencode raises TypeError on None, so
    without a guard every click on Change Email would be a server error.
    """
    settings.KEYCLOAK_CLIENT_ID = None

    resp = client.get(
        reverse("account-action-start", kwargs={"action": "update-email"})
    )

    assert resp.status_code == 302
    expected_params = urlencode(
        {"account_action": "update-email", "account_action_status": "error"}
    )
    settings_url = f"{settings.APP_BASE_URL.removesuffix('/')}/dashboard/settings"
    assert resp.headers["Location"] == f"{settings_url}?{expected_params}"


def test_account_action_complete_pending_when_email_unchanged(
    settings, client, mock_sync_email
):
    """
    Keycloak's "success" means accepted, not applied.

    Realms with verify_email on — which is all deployed environments — email a
    confirmation link and only change the address once it is clicked. Reporting
    success there would tell the user their email changed when it has not, so
    the status is downgraded to pending when reading Keycloak back shows the
    address is unchanged.
    """
    mock_sync_email.return_value = False
    params = urlencode(
        {
            "next": urljoin(settings.APP_BASE_URL, "/dashboard/settings"),
            "account_action": "update-email",
            "kc_action_status": "success",
            "code": "a-code",
        }
    )

    resp = client.get(f"{reverse('account-action-complete')}?{params}")

    assert resp.status_code == 302
    assert "account_action_status=pending" in resp.headers["Location"]
    assert "account_action_status=success" not in resp.headers["Location"]


def test_account_action_complete_password_never_pending(
    settings, client, mock_sync_email
):
    """A password change applies immediately, so it is never downgraded"""
    params = urlencode(
        {
            "next": urljoin(settings.APP_BASE_URL, "/dashboard/settings"),
            "account_action": "update-password",
            "kc_action_status": "success",
            "code": "a-code",
        }
    )

    resp = client.get(f"{reverse('account-action-complete')}?{params}")

    assert resp.status_code == 302
    assert "account_action_status=success" in resp.headers["Location"]
    mock_sync_email.assert_not_called()
