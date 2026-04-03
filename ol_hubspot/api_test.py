"""Tests for HubSpot API helper functions."""

from uuid import uuid4

import pytest
from hubspot.marketing.forms.exceptions import ApiException

from ol_hubspot.api import get_form, list_forms, submit_form


def test_get_form(mocker, settings):
    """Test fetching a single form uses the SDK method and args."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = uuid4().hex
    form_id = "form-123"
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value

    get_form(form_id=form_id, archived=True)

    hubspot_class.assert_called_once_with(
        access_token=settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN
    )

    client.marketing.forms.forms_api.get_by_id.assert_called_once_with(
        form_id=form_id,
        archived=True,
    )


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
        "page_title": "MIT Learn - Test Program",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "timestamp": timestamp_ms,
        "locale": "en-US",
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
                "pageTitle": "MIT Learn - Test Program",
                "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "timestamp": timestamp_ms,
                "locale": "en-US",
            },
        },
        headers={
            "Authorization": f"Bearer {mock_secret}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30,
    )
