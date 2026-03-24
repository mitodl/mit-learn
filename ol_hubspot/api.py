"""HubSpot API helpers."""

from hubspot import HubSpot


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
