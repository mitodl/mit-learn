"""Tests for HubSpot API helper functions."""

from uuid import uuid4

import pytest
import requests
from hubspot.crm.properties.exceptions import ApiException as CrmPropertiesApiException
from hubspot.marketing.forms.exceptions import ApiException

from ol_hubspot.api import (
    create_contact_property,
    get_contact_property,
    get_form,
    list_forms,
    submit_form,
    update_contact_property_choices,
    verify_recaptcha,
)


def test_get_form(mocker, settings):
    """Test fetching a single form uses SDK api_request and returns JSON."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = uuid4().hex
    form_id = "form-123"
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value
    response = mocker.Mock()
    response.status_code = 200
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
    """Test fetching a single form raises ApiException for non-2xx HTTP responses."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = uuid4().hex
    form_id = "form-123"
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value
    response = mocker.Mock()
    response.status_code = 404
    response.text = '{"message":"Not Found"}'
    client.api_request.return_value = response

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


def test_get_contact_property(mocker, settings, faker):
    """Test fetching a contact property via CRM properties core API."""
    property_name = faker.slug().replace("-", "_")
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = uuid4().hex
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value
    expected = mocker.Mock()
    client.crm.properties.core_api.get_by_name.return_value = expected

    result = get_contact_property(property_name=property_name)

    hubspot_class.assert_called_once_with(
        access_token=settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN
    )
    client.crm.properties.core_api.get_by_name.assert_called_once_with(
        "contacts", property_name
    )
    assert result is expected


def test_create_contact_property(mocker, settings, faker):
    """Test creating a contact property with enumeration options."""
    property_name = faker.slug().replace("-", "_")
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = uuid4().hex
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value

    create_contact_property(
        property_name=property_name,
        label=faker.sentence(nb_words=3),
        options=[
            {"label": "Course A", "value": "course-a"},
            {"label": "Program B", "value": "program-b"},
        ],
        group_name="contactinformation",
        field_type="checkbox",
        description="Products a learner is interested in.",
        form_field=True,
    )

    client.crm.properties.core_api.create.assert_called_once()
    args = client.crm.properties.core_api.create.call_args.args
    assert args[0] == "contacts"
    payload = args[1]
    assert payload.name == property_name
    assert payload.group_name == "contactinformation"
    assert payload.type == "enumeration"
    assert payload.field_type == "checkbox"
    assert payload.form_field is True
    assert [option.label for option in payload.options] == ["Course A", "Program B"]
    assert [option.value for option in payload.options] == ["course-a", "program-b"]


def test_update_contact_property_choices(mocker, settings, faker):
    """Test updating options for an existing contact property."""
    property_name = faker.slug().replace("-", "_")
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = uuid4().hex
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value

    update_contact_property_choices(
        property_name=property_name,
        options=[
            {"label": "Course A", "value": "course-a"},
            {"label": "Program B", "value": "program-b"},
        ],
    )

    client.crm.properties.core_api.update.assert_called_once()
    args = client.crm.properties.core_api.update.call_args.args
    assert args[0] == "contacts"
    assert args[1] == property_name
    payload = args[2]
    assert [option.label for option in payload.options] == ["Course A", "Program B"]
    assert [option.value for option in payload.options] == ["course-a", "program-b"]


def test_get_contact_property_propagates_sdk_error(mocker, settings, faker):
    """Test CRM properties errors propagate from the SDK helper."""
    property_name = faker.slug().replace("-", "_")
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = uuid4().hex
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value
    client.crm.properties.core_api.get_by_name.side_effect = CrmPropertiesApiException(
        status=404, reason="Not Found"
    )

    with pytest.raises(CrmPropertiesApiException) as exc_info:
        get_contact_property(property_name=property_name)

    assert exc_info.value.status == 404


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
