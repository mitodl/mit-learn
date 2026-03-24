"""Tests for HubSpot proxy views."""

from urllib.parse import parse_qs, urlparse
from uuid import uuid4

from django.urls import reverse
from rest_framework import status

from main.factories import UserFactory


def _mock_hubspot_secret() -> str:
    return uuid4().hex


def test_list_forms(client, settings, mocker):
    """List endpoint relays data from HubSpot API helper."""
    mock_secret = _mock_hubspot_secret()
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    client.force_login(UserFactory.create(is_superuser=True))
    list_url = reverse("hubspot-forms-list")
    expected = {"results": [{"id": "abc"}]}
    get_stub = mocker.patch("ol_hubspot.views.list_forms")
    get_stub.return_value = mocker.Mock(to_dict=mocker.Mock(return_value=expected))

    response = client.get(f"{list_url}?limit=10&archived=false&form_types=hubspot")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == expected
    get_stub.assert_called_once_with(
        access_token=mock_secret,
        after=None,
        limit=10,
        archived=False,
        form_types=["hubspot"],
    )


def test_list_forms_rewrites_next_paging_link(client, settings, mocker):
    """List endpoint rewrites HubSpot paging links to local proxy links."""
    mock_secret = _mock_hubspot_secret()
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    client.force_login(UserFactory.create(is_superuser=True))
    list_url = reverse("hubspot-forms-list")
    expected = {
        "results": [{"id": "abc"}],
        "paging": {
            "next": {
                "link": "https://api.hubapi.com/marketing/forms/v3/?after=MjA%3D",
                "after": "MjA%3D",
            }
        },
    }
    get_stub = mocker.patch("ol_hubspot.views.list_forms")
    get_stub.return_value = mocker.Mock(to_dict=mocker.Mock(return_value=expected))

    response = client.get(f"{list_url}?limit=10&archived=false&form_types=hubspot")

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    parsed = urlparse(payload["paging"]["next"]["link"])
    query = parse_qs(parsed.query)
    assert parsed.path == list_url
    assert query["after"] == ["MjA%3D"]
    assert query["limit"] == ["10"]
    assert query["archived"] == ["false"]
    assert query["form_types"] == ["hubspot"]


def test_get_form_detail(client, settings, mocker):
    """Detail endpoint relays data from HubSpot API helper."""
    mock_secret = _mock_hubspot_secret()
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    client.force_login(UserFactory.create())
    detail_url = reverse("hubspot-forms-detail", kwargs={"form_id": "abc"})
    expected = {"id": "abc", "name": "Test Form"}
    get_stub = mocker.patch("ol_hubspot.views.get_form")
    get_stub.return_value = mocker.Mock(to_dict=mocker.Mock(return_value=expected))

    response = client.get(detail_url)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == expected
    get_stub.assert_called_once_with(
        access_token=mock_secret,
        form_id="abc",
        archived=None,
    )


def test_missing_token_returns_503(client, settings):
    """Endpoints return 503 if token is not configured."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = None

    client.force_login(UserFactory.create(is_superuser=True))
    list_response = client.get(reverse("hubspot-forms-list"))

    client.force_login(UserFactory.create())
    detail_response = client.get(
        reverse("hubspot-forms-detail", kwargs={"form_id": "abc"})
    )

    assert list_response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert detail_response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_invalid_limit_returns_400(client, settings):
    """List endpoint validates limit query param."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    client.force_login(UserFactory.create(is_superuser=True))
    list_url = reverse("hubspot-forms-list")

    response = client.get(f"{list_url}?limit=abc")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {"limit": ["Must be an integer."]}


def test_list_forms_requires_superuser(client, settings):
    """List endpoint is restricted to superusers."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    list_url = reverse("hubspot-forms-list")

    client.force_login(UserFactory.create())
    response = client.get(list_url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_detail_requires_authenticated_user(client, settings):
    """Detail endpoint requires authentication."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    detail_url = reverse("hubspot-forms-detail", kwargs={"form_id": "abc"})

    response = client.get(detail_url)

    assert response.status_code == status.HTTP_403_FORBIDDEN
