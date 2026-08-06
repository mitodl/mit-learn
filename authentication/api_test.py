"""API tests"""

from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import caches
from keycloak.exceptions import KeycloakError

from authentication import api
from authentication.api import fetch_keycloak_userinfo, sync_email_from_keycloak
from authentication.constants import AccountAction, parse_account_action
from main.factories import UserFactory
from profiles.models import Profile

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.mark.django_db
@pytest.mark.parametrize(
    "profile_data",
    [
        {"name": "My Name", "image": "http://localhost/image.jpg"},
        # None,
    ],
)
def test_create_user(profile_data):
    """Tests that a user and associated objects are created"""
    email = "email@localhost"
    username = "username"
    user = api.create_user(username, email, profile_data, {"first_name": "Bob"})

    assert isinstance(user, User)
    assert user.email == email
    assert user.username == username
    assert user.first_name == "Bob"

    if "name" in profile_data:
        assert user.profile.name == profile_data["name"]
    else:
        assert user.profile.name is None


@pytest.mark.parametrize(
    "mock_method",
    ["profiles.api.ensure_profile"],
)
def test_create_user_errors(mocker, mock_method):
    """Test that we don't end up in a partial state if there are errors"""
    mocker.patch(mock_method, side_effect=Exception("error"))

    with pytest.raises(Exception):  # noqa: B017, PT011
        api.create_user(
            "username",
            "email@localhost",
            {"name": "My Name", "image": "http://localhost/image.jpg"},
        )

    assert User.objects.all().count() == 0
    assert Profile.objects.count() == 0


@pytest.mark.parametrize("is_new", [True, False])
def test_user_created_actions(mocker, is_new):
    """
    Tests that user_created_actions creates a favorites list for new users only
    """
    user = UserFactory.create()
    kwargs = {
        "user": user,
        "is_new": is_new,
        "details": {},
    }

    api.user_created_actions(**kwargs)
    assert user.user_lists.count() == (1 if is_new else 0)


@pytest.fixture
def mock_keycloak_admin(mocker):
    """Mock the Keycloak admin client used for federated identity lookups"""
    mocker.patch(
        "authentication.api.keycloak_api.is_admin_client_configured",
        return_value=True,
    )
    return mocker.patch(
        "authentication.api.main_keycloak.get_admin_client"
    ).return_value


@pytest.fixture
def sso_cache(settings):
    """
    Give is_sso_user a working cache.

    conftest swaps the redis cache for a dummy backend so tests don't share
    state; the caching behaviour still needs somewhere real to write.
    """
    settings.CACHES = {
        **settings.CACHES,
        "redis": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "is-sso-user-test",
        },
    }
    cache = caches["redis"]
    cache.clear()
    return cache


@pytest.mark.parametrize(
    ("social_logins", "expected"),
    [
        ([{"identityProvider": "touchstone"}], True),
        ([], False),
    ],
)
def test_is_sso_user(mock_keycloak_admin, social_logins, expected):
    """Users with a federated identity in Keycloak are SSO users"""
    user = UserFactory.create(global_id=uuid4().hex)
    mock_keycloak_admin.get_user_social_logins.return_value = social_logins

    assert api.is_sso_user(user) is expected
    mock_keycloak_admin.get_user_social_logins.assert_called_once_with(user.global_id)


@pytest.mark.usefixtures("sso_cache")
def test_is_sso_user_is_cached(mock_keycloak_admin):
    """Keycloak should only be asked once per user"""
    user = UserFactory.create(global_id=uuid4().hex)
    mock_keycloak_admin.get_user_social_logins.return_value = [
        {"identityProvider": "touchstone"}
    ]

    assert api.is_sso_user(user) is True
    assert api.is_sso_user(user) is True
    assert mock_keycloak_admin.get_user_social_logins.call_count == 1


def test_is_sso_user_no_global_id(mock_keycloak_admin):
    """Users who have never been through Keycloak can't be SSO users"""
    user = UserFactory.create(global_id=None)

    assert api.is_sso_user(user) is False
    mock_keycloak_admin.get_user_social_logins.assert_not_called()


def test_is_sso_user_admin_client_unconfigured(mocker):
    """Without an admin client we can't tell, so we don't block the user"""
    mocker.patch(
        "authentication.api.keycloak_api.is_admin_client_configured",
        return_value=False,
    )
    get_admin_client = mocker.patch("authentication.api.main_keycloak.get_admin_client")
    user = UserFactory.create(global_id=uuid4().hex)

    assert api.is_sso_user(user) is False
    get_admin_client.assert_not_called()


def test_is_sso_user_keycloak_error(mock_keycloak_admin):
    """A Keycloak failure shouldn't take the settings page down with it"""
    user = UserFactory.create(global_id=uuid4().hex)
    mock_keycloak_admin.get_user_social_logins.side_effect = KeycloakError("boom")

    assert api.is_sso_user(user) is False


@pytest.fixture
def mock_oidc_client(mocker, settings):
    """Mock the OIDC client used to exchange account action codes"""
    settings.KEYCLOAK_CLIENT_ID = "learn-client"
    settings.KEYCLOAK_CLIENT_SECRET = "learn-secret"  # noqa: S105
    client = mocker.patch("authentication.api.KeycloakOpenID").return_value
    client.token.return_value = {"access_token": "an-access-token"}
    return client


def test_fetch_keycloak_userinfo(mock_oidc_client):
    """The authorization code is exchanged for the user's claims"""
    mock_oidc_client.userinfo.return_value = {"sub": "abc", "email": "new@mit.edu"}

    assert fetch_keycloak_userinfo(code="a-code", redirect_uri="https://api/cb") == {
        "sub": "abc",
        "email": "new@mit.edu",
    }
    mock_oidc_client.token.assert_called_once_with(
        grant_type="authorization_code",
        code="a-code",
        redirect_uri="https://api/cb",
    )
    mock_oidc_client.userinfo.assert_called_once_with("an-access-token")


def test_fetch_keycloak_userinfo_unconfigured(mocker, settings):
    """Without client credentials we can't exchange the code"""
    settings.KEYCLOAK_CLIENT_ID = None
    settings.KEYCLOAK_CLIENT_SECRET = None
    oidc = mocker.patch("authentication.api.KeycloakOpenID")

    assert fetch_keycloak_userinfo(code="a-code", redirect_uri="https://api/cb") is None
    oidc.assert_not_called()


def test_fetch_keycloak_userinfo_exchange_fails(mock_oidc_client):
    """A rejected (replayed or expired) code is not an error"""
    mock_oidc_client.token.side_effect = KeycloakError("invalid_grant")

    assert fetch_keycloak_userinfo(code="a-code", redirect_uri="https://api/cb") is None


def test_sync_email_from_keycloak(mock_oidc_client):
    """The user is found via the `sub` claim and their email updated"""
    user = UserFactory.create(global_id=uuid4().hex, email="old@mit.edu")
    mock_oidc_client.userinfo.return_value = {
        "sub": user.global_id,
        "email": "new@mit.edu",
    }

    assert sync_email_from_keycloak(code="c", redirect_uri="https://api/cb") is True
    user.refresh_from_db()
    assert user.email == "new@mit.edu"


def test_sync_email_from_keycloak_needs_no_request_user(mock_oidc_client):
    """
    The sync must not depend on request.user.

    The APISIX middleware logs the Django user out on any request without an
    X-UserInfo header, which is the case on this callback when the gateway isn't
    in front of Django. Identifying the user from `sub` keeps that irrelevant.
    """
    user = UserFactory.create(global_id=uuid4().hex, email="old@mit.edu")
    mock_oidc_client.userinfo.return_value = {
        "sub": user.global_id,
        "email": "new@mit.edu",
    }

    # No user passed in, no request in scope at all.
    assert sync_email_from_keycloak(code="c", redirect_uri="https://api/cb") is True
    user.refresh_from_db()
    assert user.email == "new@mit.edu"


def test_sync_email_from_keycloak_unknown_user(mock_oidc_client):
    """Claims for a global_id we've never seen are ignored"""
    mock_oidc_client.userinfo.return_value = {
        "sub": uuid4().hex,
        "email": "new@mit.edu",
    }

    assert sync_email_from_keycloak(code="c", redirect_uri="https://api/cb") is False


@pytest.mark.parametrize(
    "userinfo",
    [
        pytest.param({"email": "x@mit.edu"}, id="no-sub"),
        pytest.param({"sub": "abc"}, id="no-email"),
        pytest.param({"sub": "abc", "email": ""}, id="blank-email"),
    ],
)
def test_sync_email_from_keycloak_incomplete_claims(mock_oidc_client, userinfo):
    """Nothing is written when Keycloak's claims are unusable"""
    mock_oidc_client.userinfo.return_value = userinfo

    assert sync_email_from_keycloak(code="c", redirect_uri="https://api/cb") is False


def test_sync_email_from_keycloak_unchanged(mock_oidc_client):
    """No write when the address already matches"""
    user = UserFactory.create(global_id=uuid4().hex, email="same@mit.edu")
    mock_oidc_client.userinfo.return_value = {
        "sub": user.global_id,
        "email": "same@mit.edu",
    }

    assert sync_email_from_keycloak(code="c", redirect_uri="https://api/cb") is False


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("update-email", AccountAction.UPDATE_EMAIL),
        ("update-password", AccountAction.UPDATE_PASSWORD),
        ("delete-account", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_account_action(value, expected):
    """
    A raw query-string value maps to its AccountAction, or None.

    Pins that a plain string is recognised: `value in AccountAction` only
    accepts values from Python 3.12 onwards and raises TypeError before that,
    so the reporting and email-sync branches of the callback depend on this.
    """
    assert parse_account_action(value) is expected
