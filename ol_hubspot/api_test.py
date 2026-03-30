"""Tests for HubSpot API helper functions."""

from uuid import uuid4

from ol_hubspot.api import get_form, list_forms, submit_form


def test_get_form(mocker):
    """Test fetching a single form uses the SDK method and args."""
    mock_secret = uuid4().hex
    form_id = "form-123"
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value

    get_form(access_token=mock_secret, form_id=form_id, archived=True)

    hubspot_class.assert_called_once_with(access_token=mock_secret)
    client.marketing.forms.forms_api.get_by_id.assert_called_once_with(
        form_id=form_id,
        archived=True,
    )


def test_list_forms(mocker):
    """Test listing forms uses the SDK method and args."""
    mock_secret = uuid4().hex
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value

    list_forms(
        access_token=mock_secret,
        after="cursor",
        limit=25,
        archived=False,
        form_types=["hubspot"],
    )

    hubspot_class.assert_called_once_with(access_token=mock_secret)
    client.marketing.forms.forms_api.get_page.assert_called_once_with(
        after="cursor",
        limit=25,
        archived=False,
        form_types=["hubspot"],
    )


def test_submit_form(mocker):
    """Test submitting a form uses the SDK method and args."""
    mock_secret = uuid4().hex
    form_id = "form-456"
    payload = {"fields": [{"name": "email", "value": "test@example.com"}]}
    hubspot_class = mocker.patch("ol_hubspot.api.HubSpot", autospec=True)
    client = hubspot_class.return_value

    submit_form(access_token=mock_secret, form_id=form_id, payload=payload)

    hubspot_class.assert_called_once_with(access_token=mock_secret)
    client.marketing.forms.submissions_api.submit.assert_called_once_with(
        form_id=form_id,
        body=payload,
    )
