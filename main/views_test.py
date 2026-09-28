"""Tests for the utility views"""

import uuid

import pytest


def test_anon_error(client):
    """Test that we get an error as we expect from a nonsense URL with an anonymous session."""

    response = client.get(f"/{uuid.uuid4()}")

    assert response.status_code == 404


def test_authed_error(user_client):
    """Test that we get an error as we expect from a nonsense URL with a session."""

    response = user_client.get(f"/{uuid.uuid4()}")

    assert response.status_code == 404


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete", "trace"])
def test_unmatched_api_route_is_404_for_any_method(client, method):
    """An unmatched API route is a 404 regardless of the request method.

    handle_error used to be wrapped in `@api_view()`, which defaults to
    GET-only and turned every non-GET client error into a misleading
    `405 Method Not Allowed`.
    """

    response = getattr(client, method)(f"/api/v1/{uuid.uuid4()}/")

    assert response.status_code == 404
    assert response.json()["error_type"] == "Http404"


def test_permission_denied_is_403(client, mocker):
    """A view raising PermissionDenied reports 403, not 404 or 405."""

    mocker.patch(
        "webhooks.decorators.validate_webhook_signature",
        return_value=False,
    )

    response = client.post(
        "/api/v1/webhooks/content_files/",
        data="{}",
        content_type="application/json",
    )

    assert response.status_code == 403
    assert response.json()["error_type"] == "PermissionDenied"


def test_bad_request_is_400(client, mocker):
    """A view raising BadRequest reports 400, not 404 or 405."""

    mocker.patch(
        "webhooks.decorators.validate_webhook_signature",
        return_value=True,
    )

    response = client.post(
        "/api/v1/webhooks/content_files/",
        data="{}",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["error_type"] == "BadRequest"


def test_redirect_route(settings, user_client):
    """
    Simple Test that checks that we have a catch all redirect view
    so that is not accidently removed
    """
    response = user_client.get("/app", follow=True)
    assert response.redirect_chain[0][0] == settings.APP_BASE_URL
    assert response.redirect_chain[0][1] == 302
