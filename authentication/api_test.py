"""API tests"""

from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import caches
from keycloak.exceptions import KeycloakError

from authentication import api
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
    return mocker.patch("authentication.api.keycloak_api.get_admin_client").return_value


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
    get_admin_client = mocker.patch("authentication.api.keycloak_api.get_admin_client")
    user = UserFactory.create(global_id=uuid4().hex)

    assert api.is_sso_user(user) is False
    get_admin_client.assert_not_called()


def test_is_sso_user_keycloak_error(mock_keycloak_admin):
    """A Keycloak failure shouldn't take the settings page down with it"""
    user = UserFactory.create(global_id=uuid4().hex)
    mock_keycloak_admin.get_user_social_logins.side_effect = KeycloakError("boom")

    assert api.is_sso_user(user) is False


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
    so the callback's reporting branch depends on this.
    """
    assert parse_account_action(value) is expected
