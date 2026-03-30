"""HubSpot API helpers."""

from http import HTTPStatus

import requests
from hubspot import HubSpot
from hubspot.marketing.forms.exceptions import ApiException

HSFORMS_API_BASE_URL = "https://api.hsforms.com"


def get_hubspot_client(access_token: str) -> HubSpot:
    """Create an authenticated HubSpot SDK client."""
    return HubSpot(access_token=access_token)


def get_form(*, access_token: str, form_id: str, archived: bool | None = None):
    """Fetch a single HubSpot form definition."""
    client = get_hubspot_client(access_token)
    return client.marketing.forms.forms_api.get_by_id(
        form_id=form_id,
        archived=archived,
    )


def list_forms(
    *,
    access_token: str,
    after: str | None = None,
    limit: int | None = None,
    archived: bool | None = None,
    form_types: list[str] | None = None,
):
    """Fetch a page of HubSpot form definitions."""
    client = get_hubspot_client(access_token)
    return client.marketing.forms.forms_api.get_page(
        after=after,
        limit=limit,
        archived=archived,
        form_types=form_types,
    )


def submit_form(
    *,
    access_token: str,
    form_id: str,
    payload: dict,
):
    """Submit a form submission to HubSpot."""
    client = get_hubspot_client(access_token)
    account_response = client.api_request(
        {"path": "/integrations/v1/me", "method": "GET"}
    )
    portal_id = account_response.json()["portalId"]

    response = requests.post(
        f"{HSFORMS_API_BASE_URL}/submissions/v3/integration/secure/submit/{portal_id}/{form_id}",
        json=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30,
    )
    if response.status_code >= HTTPStatus.BAD_REQUEST:
        raise ApiException(status=response.status_code, reason=response.text)

    return response.json() if response.content else None
