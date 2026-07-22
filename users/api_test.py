"""Tests for users.api"""

import uuid

import pytest
from keycloak.exceptions import KeycloakError

from main.factories import UserFactory
from users.api import unsubscribe
from users.utils import _get_unsubscribe_signer


def _make_token(uuid_str):
    return _get_unsubscribe_signer().sign(uuid_str)


@pytest.mark.django_db
def test_unsubscribe_valid_token_returns_true(mocker):
    """Valid token unsubscribes the user and returns True."""
    sync_mock = mocker.patch("users.api.sync_email_optin_to_keycloak")
    user = UserFactory.create()
    user.profile.email_optin = True
    user.profile.save()

    token = _make_token(str(user.unsubscribe_uuid))

    assert unsubscribe(token) is True
    user.profile.refresh_from_db()
    assert user.profile.email_optin is False
    sync_mock.assert_called_once_with(user, email_optin=False)


@pytest.mark.django_db
def test_unsubscribe_keycloak_sync_failure_returns_false(mocker):
    """A Keycloak sync failure returns False and does not update the profile."""
    mocker.patch(
        "users.api.sync_email_optin_to_keycloak",
        side_effect=KeycloakError("boom"),
    )
    user = UserFactory.create()
    user.profile.email_optin = True
    user.profile.save()

    token = _make_token(str(user.unsubscribe_uuid))

    assert unsubscribe(token) is False
    user.profile.refresh_from_db()
    assert user.profile.email_optin is True


@pytest.mark.django_db
def test_unsubscribe_invalid_token_returns_false():
    """Invalid token returns False."""
    assert unsubscribe("totally-invalid") is False


@pytest.mark.django_db
def test_unsubscribe_unknown_uuid_returns_false():
    """Valid signature but unknown UUID returns False."""
    token = _make_token(str(uuid.uuid4()))
    assert unsubscribe(token) is False


@pytest.mark.django_db
def test_unsubscribe_expired_token_returns_false(settings):
    """Expired token returns False."""
    settings.MITOL_UNSUBSCRIBE_TOKEN_MAX_AGE_SECONDS = 0
    user = UserFactory.create()
    token = _make_token(str(user.unsubscribe_uuid))

    assert unsubscribe(token) is False
