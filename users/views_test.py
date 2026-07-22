"""Tests for users.views"""

from urllib.parse import urlencode

import pytest
from django.urls import reverse
from keycloak.exceptions import KeycloakError

from main.factories import UserFactory
from users.utils import _get_unsubscribe_signer


def _make_token(uuid_str):
    return _get_unsubscribe_signer().sign(uuid_str)


def _unsubscribe_url(token):
    return reverse("users:v1:unsubscribe", kwargs={"token": token})


# ---------------------------------------------------------------------------
# GET tests (never unsubscribes, just hands the token to the frontend)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_unsubscribe_get_redirects_to_frontend_with_token(mocker, client, settings):
    """GET redirects to the frontend confirmation page with the token, without unsubscribing."""
    settings.APP_BASE_URL = "https://learn.example.com"
    sync_mock = mocker.patch("users.views.sync_email_optin_to_keycloak")
    user = UserFactory.create()
    user.profile.email_optin = True
    user.profile.save()

    token = _make_token(str(user.unsubscribe_uuid))
    resp = client.get(_unsubscribe_url(token))

    assert resp.status_code == 302
    params = urlencode({"token": token})
    assert resp["Location"] == f"https://learn.example.com/unsubscribe?{params}"
    user.profile.refresh_from_db()
    assert user.profile.email_optin is True
    sync_mock.assert_not_called()


@pytest.mark.django_db
def test_unsubscribe_get_invalid_token_redirects_with_token_anyway(client, settings):
    """GET redirects with the token even when it's invalid, since GET never validates it."""
    settings.APP_BASE_URL = "https://learn.example.com"
    resp = client.get(_unsubscribe_url("totally-invalid"))

    assert resp.status_code == 302
    assert (
        resp["Location"]
        == "https://learn.example.com/unsubscribe?token=totally-invalid"
    )


# ---------------------------------------------------------------------------
# POST tests (RFC 8058 one-click — returns JSON)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_unsubscribe_post_valid_token_returns_200(mocker, client):
    """Valid token returns 200 and sets email_optin=False."""
    sync_mock = mocker.patch("users.views.sync_email_optin_to_keycloak")
    user = UserFactory.create()
    user.profile.email_optin = True
    user.profile.save()

    token = _make_token(str(user.unsubscribe_uuid))
    resp = client.post(_unsubscribe_url(token))

    assert resp.status_code == 200
    user.profile.refresh_from_db()
    assert user.profile.email_optin is False
    sync_mock.assert_called_once_with(user, email_optin=False)


@pytest.mark.django_db
def test_unsubscribe_post_keycloak_sync_failure_returns_400(mocker, client):
    """A Keycloak sync failure returns 400 and does not update the profile."""
    mocker.patch(
        "users.views.sync_email_optin_to_keycloak",
        side_effect=KeycloakError("boom"),
    )
    user = UserFactory.create()
    user.profile.email_optin = True
    user.profile.save()

    token = _make_token(str(user.unsubscribe_uuid))
    resp = client.post(_unsubscribe_url(token))

    assert resp.status_code == 400
    user.profile.refresh_from_db()
    assert user.profile.email_optin is True


@pytest.mark.django_db
def test_unsubscribe_post_invalid_token_returns_400(client):
    """Invalid token returns 400."""
    resp = client.post(_unsubscribe_url("totally-invalid"))

    assert resp.status_code == 400
    assert resp.json() == {"error": "Invalid or expired token"}


@pytest.mark.django_db
def test_unsubscribe_post_unknown_uuid_returns_400(client):
    """Valid signature but unknown UUID returns 400."""
    import uuid

    token = _make_token(str(uuid.uuid4()))
    resp = client.post(_unsubscribe_url(token))

    assert resp.status_code == 400


@pytest.mark.django_db
def test_unsubscribe_post_expired_token_returns_400(client, settings):
    """Expired token returns 400."""
    settings.MITOL_UNSUBSCRIBE_TOKEN_MAX_AGE_SECONDS = 0
    user = UserFactory.create()
    token = _make_token(str(user.unsubscribe_uuid))

    resp = client.post(_unsubscribe_url(token))

    assert resp.status_code == 400
