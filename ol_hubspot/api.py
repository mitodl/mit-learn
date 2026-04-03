"""HubSpot API helpers."""

from http import HTTPStatus

import requests
from django.conf import settings
from hubspot import HubSpot
from hubspot.marketing.forms.exceptions import ApiException

HSFORMS_API_BASE_URL = "https://api.hsforms.com"


def get_hubspot_client() -> HubSpot:
    """Create an authenticated HubSpot SDK client."""
    return HubSpot(access_token=settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN)


def get_form(*, form_id: str, archived: bool | None = None):
    """Fetch a single HubSpot form definition."""
    client = get_hubspot_client()
    return client.marketing.forms.forms_api.get_by_id(
        form_id=form_id,
        archived=archived,
    )


def list_forms(
    *,
    after: str | None = None,
    limit: int | None = None,
    archived: bool | None = None,
    form_types: list[str] | None = None,
):
    """Fetch a page of HubSpot form definitions."""
    client = get_hubspot_client()
    return client.marketing.forms.forms_api.get_page(
        after=after,
        limit=limit,
        archived=archived,
        form_types=form_types,
    )


def submit_form(
    *,
    form_id: str,
    payload: dict,
):
    """Submit a form submission to HubSpot."""
    client = get_hubspot_client()
    account_response = client.api_request(
        {"path": "/integrations/v1/me", "method": "GET"}
    )
    portal_id = account_response.json()["portalId"]

    fields = payload.get("fields", [])
    hubspot_payload = {"fields": fields}

    # Build context object with all available context properties
    context = {}
    if page_uri := payload.get("page_uri"):
        context["pageUri"] = page_uri
    if hutk := payload.get("hutk"):
        context["hutk"] = hutk
    if page_title := payload.get("page_title"):
        context["pageTitle"] = page_title
    if user_agent := payload.get("user_agent"):
        context["userAgent"] = user_agent
    if timestamp := payload.get("timestamp"):
        context["timestamp"] = timestamp
    if locale := payload.get("locale"):
        context["locale"] = locale

    if context:
        hubspot_payload["context"] = context

    response = requests.post(
        f"{HSFORMS_API_BASE_URL}/submissions/v3/integration/secure/submit/{portal_id}/{form_id}",
        json=hubspot_payload,
        headers={
            "Authorization": f"Bearer {settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30,
    )
    if response.status_code >= HTTPStatus.BAD_REQUEST:
        raise ApiException(status=response.status_code, reason=response.text)

    return response.json() if response.content else None
