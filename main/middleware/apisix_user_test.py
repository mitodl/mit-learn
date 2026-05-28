"""Tests for apisix middleware."""

import json
from base64 import b64encode
from datetime import timedelta
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections

from main.factories import UserFactory
from main.middleware.apisix_user import ApisixUserMiddleware

User = get_user_model()

apisix_user_info = {
    "sub": uuid4().hex,
    "preferred_username": "testuser",
    "email": "testuser@test.edu",
    "given_name": "test",
    "family_name": "user",
    "name": "test user fullname",
    "emailOptIn": 0,
}


@pytest.fixture
def mock_login(mocker):
    """Mock the login function."""
    return mocker.patch("main.middleware.apisix_user.login")


@pytest.fixture(autouse=True)
def setup_test_database():
    """
    Ensure clean database state for each test.
    Avoids a strange database wrapper error.
    """
    close_old_connections()


@pytest.fixture
def synced_user(mocker, mock_login):
    """Run an initial APISIX request to create the user, then return it."""
    header = b64encode(json.dumps(apisix_user_info).encode())
    ApisixUserMiddleware(mocker.Mock()).process_request(
        mocker.Mock(META={"HTTP_X_USERINFO": header}, user=AnonymousUser())
    )
    return User.objects.get(global_id=apisix_user_info["sub"])


@pytest.mark.django_db(transaction=True)
def test_get_request(mocker, mock_login, settings):
    """Test that a valid request creates a new user."""
    close_old_connections()
    settings.POSTHOG_PROJECT_API_KEY = "fake-key"
    mock_posthog_cls = mocker.patch("main.middleware.apisix_user.Posthog")
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=AnonymousUser(),
    )
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    mock_login.assert_called_once()
    user = User.objects.get(email=apisix_user_info["email"])
    assert user.username == apisix_user_info["preferred_username"]
    assert user.first_name == apisix_user_info["given_name"]
    assert user.last_name == apisix_user_info["family_name"]
    assert user.profile.name == apisix_user_info["name"]
    assert user.profile.email_optin == apisix_user_info["emailOptIn"]
    assert user.global_id == apisix_user_info["sub"]
    mock_posthog_cls.assert_called_once()
    mock_posthog_cls.return_value.capture.assert_called_once()


@pytest.mark.django_db(transaction=True)
def test_get_request_no_posthog_key(mocker, mock_login, settings):
    """Test that PostHog is not called when POSTHOG_PROJECT_API_KEY is empty."""
    close_old_connections()
    settings.POSTHOG_PROJECT_API_KEY = ""
    mock_posthog_cls = mocker.patch("main.middleware.apisix_user.Posthog")
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=AnonymousUser(),
    )
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    mock_login.assert_called_once()
    mock_posthog_cls.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_get_request_existing_user_no_globalid(mocker, mock_login):
    """Test that a valid request updates existing user with same email, no global_id."""
    close_old_connections()
    user = UserFactory.create(email=apisix_user_info["email"], global_id=None)
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=AnonymousUser(),
    )
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    mock_login.assert_called_once()
    user.refresh_from_db()
    assert user.username == apisix_user_info["preferred_username"]
    assert user.email == apisix_user_info["email"]
    assert user.global_id == apisix_user_info["sub"]


@pytest.mark.django_db(transaction=True)
def test_get_request_existing_user_with_global_id_diff_email(mocker, mock_login):
    """Test that a valid request updates email of user with same global_id"""
    close_old_connections()
    user = UserFactory.create(
        email="old_email@test.edu", global_id=apisix_user_info["sub"]
    )
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=AnonymousUser(),
    )
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    user.refresh_from_db()
    assert user.username == apisix_user_info["preferred_username"]
    assert user.global_id == apisix_user_info["sub"]
    assert user.email == apisix_user_info["email"]


@pytest.mark.django_db(transaction=True)
def test_get_request_ambiguous_identity_fails_closed(mocker, mock_login):
    """An ambiguous APISIX identity match should not silently pick a user."""
    close_old_connections()
    legacy_user = UserFactory.create(email=apisix_user_info["email"], global_id=None)
    exact_user = UserFactory.create(
        email="old_email@test.edu", global_id=apisix_user_info["sub"]
    )
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=AnonymousUser(),
    )
    mock_get_response = mocker.Mock(return_value="response")
    apisix_middleware = ApisixUserMiddleware(mock_get_response)

    assert apisix_middleware.process_request(mock_request) == "response"

    mock_login.assert_not_called()
    mock_get_response.assert_called_once_with(mock_request)
    legacy_user.refresh_from_db()
    exact_user.refresh_from_db()
    assert legacy_user.global_id is None
    assert exact_user.email == "old_email@test.edu"


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_user", [False, True])
def test_get_request_different_user_logout(mocker, client, same_user):
    """Test that a request with mismatched users logs user out"""
    other_user = UserFactory.create()
    api_sixuser = UserFactory.create(
        username=apisix_user_info["preferred_username"],
        global_id=apisix_user_info["sub"],
        email=apisix_user_info["email"],
    )
    client.force_login(api_sixuser if same_user else other_user)
    mock_request = mocker.Mock(
        META={
            "HTTP_X_USERINFO": b64encode(json.dumps(apisix_user_info).encode()),
        },
        user=(api_sixuser if same_user else other_user),
    )
    mocker.patch("main.middleware.apisix_user.login")
    mock_logout = mocker.patch("main.middleware.apisix_user.logout")
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    assert mock_logout.call_count == (0 if same_user else 1)


@pytest.mark.django_db(transaction=True)
def test_get_request_logged_in_no_header(mocker, client, user):
    """Test that an authenticated user without apisix header gets logged out."""
    close_old_connections()
    client.force_login(user)
    mock_request = mocker.Mock(
        META={},
        user=user,
    )
    mock_logout = mocker.patch("main.middleware.apisix_user.logout")
    apisix_middleware = ApisixUserMiddleware(mocker.Mock())
    apisix_middleware.process_request(mock_request)
    mock_logout.assert_called_once()


@pytest.mark.django_db(transaction=True)
def test_unchanged_identity_skips_writes(mocker, mock_login, synced_user):
    """A repeat request with an unchanged identity issues no writes or re-login."""
    header = b64encode(json.dumps(apisix_user_info).encode())
    mock_login.reset_mock()
    mock_save = mocker.patch.object(User, "save")
    mock_actions = mocker.patch("main.middleware.apisix_user.user_created_actions")
    ApisixUserMiddleware(mocker.Mock()).process_request(
        mocker.Mock(META={"HTTP_X_USERINFO": header}, user=synced_user)
    )
    mock_save.assert_not_called()
    mock_actions.assert_not_called()
    mock_login.assert_not_called()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    ("changed_field", "new_value", "get_attr"),
    [
        ("family_name", "changed", lambda u: u.last_name),
        ("name", "New Name", lambda u: u.profile.name),
    ],
)
def test_changed_field_triggers_update(
    mocker, synced_user, changed_field, new_value, get_attr
):
    """A changed header field updates the synced user or profile."""
    changed_header = b64encode(
        json.dumps({**apisix_user_info, changed_field: new_value}).encode()
    )
    mock_request = mocker.Mock(
        META={"HTTP_X_USERINFO": changed_header}, user=synced_user
    )
    ApisixUserMiddleware(mocker.Mock()).process_request(mock_request)
    assert get_attr(mock_request.user) == new_value


@pytest.mark.django_db(transaction=True)
def test_user_update_bumps_updated_on(mocker, synced_user):
    """A user-field change should advance updated_on."""
    User.objects.filter(pk=synced_user.pk).update(
        updated_on=synced_user.updated_on - timedelta(days=1)
    )
    synced_user.refresh_from_db()
    original_updated_on = synced_user.updated_on

    changed_header = b64encode(
        json.dumps({**apisix_user_info, "family_name": "changed"}).encode()
    )
    ApisixUserMiddleware(mocker.Mock()).process_request(
        mocker.Mock(META={"HTTP_X_USERINFO": changed_header}, user=synced_user)
    )
    synced_user.refresh_from_db()
    assert synced_user.updated_on > original_updated_on
