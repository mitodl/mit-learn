"""Tests for users.views"""

from urllib.parse import urlencode

import pytest
from django.urls import reverse

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
    unsubscribe_mock = mocker.patch("users.views.unsubscribe")
    user = UserFactory.create()
    user.profile.email_optin = True
    user.profile.save()

    token = _make_token(str(user.unsubscribe_uuid))
    resp = client.get(_unsubscribe_url(token))

    assert resp.status_code == 302
    params = urlencode({"token": token})
    assert resp["Location"] == f"https://learn.example.com/unsubscribe?{params}"
    unsubscribe_mock.assert_not_called()


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
#
# The view just delegates to users.api.unsubscribe(), so these tests mock
# that function and assert the view's response handling. The unsubscribe
# logic itself is tested in users/api_test.py.
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_unsubscribe_post_success_returns_200(mocker, client):
    """When users.api.unsubscribe() succeeds, POST returns 200."""
    mocker.patch("users.views.unsubscribe", return_value=True)
    token = _make_token("some-uuid")
    resp = client.post(_unsubscribe_url(token))

    assert resp.status_code == 200
    assert resp.json() == {}


@pytest.mark.django_db
def test_unsubscribe_post_failure_returns_400(mocker, client):
    """When users.api.unsubscribe() fails, POST returns 400."""
    mocker.patch("users.views.unsubscribe", return_value=False)
    token = _make_token("some-uuid")
    resp = client.post(_unsubscribe_url(token))

    assert resp.status_code == 400
    assert resp.json() == {"error": "Invalid or expired token"}
