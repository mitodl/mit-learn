"""Tests for HubSpot API helper functions."""

from uuid import uuid4

import pytest
import requests
from hubspot.marketing.forms.exceptions import ApiException

from ol_hubspot.api import get_form, list_forms, submit_form, verify_recaptcha


def test_get_form(mocker, settings):
    """Test fetching a single form uses SDK api_request and returns JSON."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = uuid4().hex
    form_id = "form-123"
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value
    response = mocker.Mock()
    response.content = b'{"id":"form-123"}'
    response.json.return_value = {"id": "form-123"}
    client.api_request.return_value = response

    result = get_form(form_id=form_id, archived=True)

    hubspot_class.assert_called_once_with(
        access_token=settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN
    )
    client.api_request.assert_called_once_with(
        {
            "path": f"/marketing/v3/forms/{form_id}",
            "method": "GET",
            "query_params": {"archived": "true"},
        }
    )
    assert result == {"id": "form-123"}


def test_get_form_raises_api_exception_for_error_response(mocker, settings):
    """Test fetching a single form passes through SDK ApiException."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = uuid4().hex
    form_id = "form-123"
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value
    client.api_request.side_effect = ApiException(
        status=404, reason='{"message":"Not Found"}'
    )

    with pytest.raises(ApiException) as exc_info:
        get_form(form_id=form_id, archived=False)

    assert exc_info.value.status == 404
    assert exc_info.value.reason == '{"message":"Not Found"}'


def test_list_forms(mocker, settings):
    """Test listing forms uses the SDK method and args."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = uuid4().hex
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value

    list_forms(
        after="cursor",
        limit=25,
        archived=False,
        form_types=["hubspot"],
    )

    hubspot_class.assert_called_once_with(
        access_token=settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN
    )

    client.marketing.forms.forms_api.get_page.assert_called_once_with(
        after="cursor",
        limit=25,
        archived=False,
        form_types=["hubspot"],
    )


def test_submit_form(mocker, settings):
    """Test submitting a form uses the account lookup and hsforms endpoint."""
    mock_secret = uuid4().hex
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    form_id = "form-456"
    payload = {
        "fields": [{"name": "email", "value": "test@example.com"}],
        "page_uri": "https://learn.mit.edu/programs/test-program/",
    }
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value
    client.api_request.return_value.json.return_value = {"portalId": 23128026}
    response = mocker.Mock()
    response.status_code = 200
    response.content = b'{"inlineMessage":""}'
    response.json.return_value = {"inlineMessage": ""}
    post = mocker.patch("ol_hubspot.api.requests.post", return_value=response)

    submit_form(form_id=form_id, payload=payload)

    client.api_request.assert_called_once_with(
        {"path": "/integrations/v1/me", "method": "GET"}
    )
    post.assert_called_once_with(
        f"https://api.hsforms.com/submissions/v3/integration/secure/submit/23128026/{form_id}",
        json={
            "fields": [{"name": "email", "value": "test@example.com"}],
            "context": {"pageUri": "https://learn.mit.edu/programs/test-program/"},
        },
        headers={
            "Authorization": f"Bearer {mock_secret}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30,
    )


def test_submit_form_raises_api_exception_for_error_response(mocker, settings):
    """Test submitting a form raises ApiException for non-2xx responses."""
    mock_secret = uuid4().hex
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    form_id = "form-456"
    payload = {"fields": [{"name": "email", "value": "test@example.com"}]}
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value
    client.api_request.return_value.json.return_value = {"portalId": 23128026}
    response = mocker.Mock()
    response.status_code = 400
    response.text = '{"message":"Bad Request"}'
    mocker.patch("ol_hubspot.api.requests.post", return_value=response)

    with pytest.raises(ApiException) as exc_info:
        submit_form(form_id=form_id, payload=payload)

    assert exc_info.value.status == 400
    assert exc_info.value.reason == '{"message":"Bad Request"}'


def test_submit_form_without_page_uri_omits_context(mocker, settings):
    """Test submitting a form without page_uri sends only fields to HubSpot."""
    mock_secret = uuid4().hex
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    form_id = "form-456"
    payload = {"fields": [{"name": "email", "value": "test@example.com"}]}
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value
    client.api_request.return_value.json.return_value = {"portalId": 23128026}
    response = mocker.Mock()
    response.status_code = 200
    response.content = b"{}"
    response.json.return_value = {}
    post = mocker.patch("ol_hubspot.api.requests.post", return_value=response)

    submit_form(form_id=form_id, payload=payload)

    post.assert_called_once_with(
        f"https://api.hsforms.com/submissions/v3/integration/secure/submit/23128026/{form_id}",
        json={"fields": [{"name": "email", "value": "test@example.com"}]},
        headers={
            "Authorization": f"Bearer {mock_secret}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30,
    )


def test_submit_form_with_all_context_properties(mocker, settings):
    """Test submitting a form with all context properties includes them in HubSpot payload."""
    mock_secret = uuid4().hex
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    form_id = "form-456"
    timestamp_ms = 1701234567890
    payload = {
        "fields": [{"name": "email", "value": "test@example.com"}],
        "page_uri": "https://learn.mit.edu/programs/test-program/",
        "hutk": "abc123def456",
        "page_name": "MIT Learn - Test Program",
        "ip_address": "1.2.3.4",
        "submitted_at": timestamp_ms,
    }
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value
    client.api_request.return_value.json.return_value = {"portalId": 23128026}
    response = mocker.Mock()
    response.status_code = 200
    response.content = b'{"inlineMessage":""}'
    response.json.return_value = {"inlineMessage": ""}
    post = mocker.patch("ol_hubspot.api.requests.post", return_value=response)

    submit_form(form_id=form_id, payload=payload)

    post.assert_called_once_with(
        f"https://api.hsforms.com/submissions/v3/integration/secure/submit/23128026/{form_id}",
        json={
            "fields": [{"name": "email", "value": "test@example.com"}],
            "context": {
                "pageUri": "https://learn.mit.edu/programs/test-program/",
                "hutk": "abc123def456",
                "pageName": "MIT Learn - Test Program",
                "ipAddress": "1.2.3.4",
            },
            "submittedAt": timestamp_ms,
        },
        headers={
            "Authorization": f"Bearer {mock_secret}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30,
    )


def test_verify_recaptcha_success(mocker, settings):
    """ReCAPTCHA verification returns True when Google accepts the token."""
    settings.RECAPTCHA_SECRET_KEY = uuid4().hex
    response = mocker.Mock()
    response.status_code = 200
    response.content = b'{"success": true}'
    response.json.return_value = {"success": True}
    post = mocker.patch("ol_hubspot.api.requests.post", return_value=response)

    assert verify_recaptcha("captcha-token", remote_ip="1.2.3.4") is True
    post.assert_called_once_with(
        "https://www.google.com/recaptcha/api/siteverify",
        data={
            "secret": settings.RECAPTCHA_SECRET_KEY,
            "response": "captcha-token",
            "remoteip": "1.2.3.4",
        },
        timeout=30,
    )


def test_verify_recaptcha_failure_without_secret(settings):
    """ReCAPTCHA verification returns False when no secret is configured."""
    settings.RECAPTCHA_SECRET_KEY = ""

    assert verify_recaptcha("captcha-token") is False


def test_verify_recaptcha_returns_false_on_network_error(mocker, settings):
    """ReCAPTCHA verification fails closed when the request raises a network error."""
    settings.RECAPTCHA_SECRET_KEY = uuid4().hex
    mocker.patch(
        "ol_hubspot.api.requests.post",
        side_effect=requests.RequestException("timeout"),
    )

    assert verify_recaptcha("captcha-token") is False


def test_verify_recaptcha_returns_false_on_invalid_json(mocker, settings):
    """ReCAPTCHA verification fails closed when Google returns malformed JSON."""
    settings.RECAPTCHA_SECRET_KEY = uuid4().hex
    response = mocker.Mock()
    response.status_code = 200
    response.content = b"not-json"
    response.json.side_effect = ValueError("No JSON")
    mocker.patch("ol_hubspot.api.requests.post", return_value=response)

    assert verify_recaptcha("captcha-token") is False
