"""HubSpot API helpers."""

from http import HTTPStatus

import requests
from django.conf import settings
from hubspot import HubSpot
from hubspot.marketing.forms.exceptions import ApiException

HSFORMS_API_BASE_URL = "https://api.hsforms.com"
RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


def get_hubspot_client() -> HubSpot:
    """Create an authenticated HubSpot SDK client."""
    return HubSpot(access_token=settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN)


def get_form(*, form_id: str, archived: bool | None = None):
    """Fetch a single HubSpot form definition, preserving raw JSON shape."""
    client = get_hubspot_client()
    query_params = {}
    if archived is not None:
        query_params["archived"] = str(archived).lower()
    response = client.api_request(
        {
            "path": f"/marketing/v3/forms/{form_id}",
            "method": "GET",
            "query_params": query_params,
        }
    )
    if response.status_code >= HTTPStatus.BAD_REQUEST:
        raise ApiException(status=response.status_code, reason=response.text)
    return response.json() if response.content else {}


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


def verify_recaptcha(response_token: str, remote_ip: str | None = None) -> bool:
    """Validate a reCAPTCHA token with Google."""
    if not settings.RECAPTCHA_SECRET_KEY:
        return False

    payload = {
        "secret": settings.RECAPTCHA_SECRET_KEY,
        "response": response_token,
    }
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        response = requests.post(
            RECAPTCHA_VERIFY_URL,
            data=payload,
            timeout=30,
        )
        if response.status_code >= HTTPStatus.BAD_REQUEST:
            return False
        body = response.json() if response.content else {}
    except (requests.RequestException, ValueError):
        return False

    return bool(body.get("success"))


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

    raw_fields = payload.get("fields", [])
    fields = [
        {
            **f,
            "value": ";".join(f["value"])
            if isinstance(f.get("value"), list)
            else f.get("value"),
        }
        for f in raw_fields
    ]
    hubspot_payload = {"fields": fields}

    # Build context object using documented HubSpot keys.
    context = {}
    if page_uri := payload.get("page_uri"):
        context["pageUri"] = page_uri
    if hutk := payload.get("hutk"):
        context["hutk"] = hutk
    if page_name := payload.get("page_name"):
        context["pageName"] = page_name
    if ip_address := payload.get("ip_address"):
        context["ipAddress"] = ip_address

    if context:
        hubspot_payload["context"] = context

    submitted_at = payload.get("submitted_at")
    if submitted_at is not None:
        hubspot_payload["submittedAt"] = submitted_at

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
