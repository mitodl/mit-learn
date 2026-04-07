"""Tests for HubSpot proxy views."""

from urllib.parse import parse_qs, urlparse
from uuid import uuid4

from django.urls import reverse
from rest_framework import status

from main.factories import UserFactory


def _mock_hubspot_secret() -> str:
    return uuid4().hex


def _mock_recaptcha_secret() -> str:
    return uuid4().hex


def test_list_forms(client, settings, mocker):
    """List endpoint relays data from HubSpot API helper."""
    mock_secret = _mock_hubspot_secret()
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    client.force_login(UserFactory.create(is_superuser=True))
    list_url = reverse("ol_hubspot:v1:hubspot-forms-list")
    expected = {"results": [{"id": "abc"}]}
    get_stub = mocker.patch("ol_hubspot.views.list_forms")
    get_stub.return_value = mocker.Mock(to_dict=mocker.Mock(return_value=expected))

    response = client.get(f"{list_url}?limit=10&archived=false&form_types=hubspot")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == expected
    get_stub.assert_called_once_with(
        after=None,
        limit=10,
        archived=False,
        form_types=["hubspot"],
    )


def test_list_forms_multiple_form_types(client, settings, mocker):
    """List endpoint forwards repeated form_types values as a list."""
    mock_secret = _mock_hubspot_secret()
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    client.force_login(UserFactory.create(is_superuser=True))
    list_url = reverse("ol_hubspot:v1:hubspot-forms-list")
    expected = {"results": [{"id": "abc"}]}
    get_stub = mocker.patch("ol_hubspot.views.list_forms")
    get_stub.return_value = mocker.Mock(to_dict=mocker.Mock(return_value=expected))

    response = client.get(f"{list_url}?form_types=hubspot&form_types=captured")

    assert response.status_code == status.HTTP_200_OK
    get_stub.assert_called_once_with(
        after=None,
        limit=None,
        archived=None,
        form_types=["hubspot", "captured"],
    )


def test_list_forms_rewrites_next_paging_link(client, settings, mocker):
    """List endpoint rewrites HubSpot paging links to local proxy links."""
    mock_secret = _mock_hubspot_secret()
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    client.force_login(UserFactory.create(is_superuser=True))
    list_url = reverse("ol_hubspot:v1:hubspot-forms-list")
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
    assert query["after"] == ["MjA="]
    assert query["limit"] == ["10"]
    assert query["archived"] == ["false"]
    assert query["form_types"] == ["hubspot"]


def test_list_forms_rewrites_next_paging_link_with_encoded_after_only(
    client, settings, mocker
):
    """List endpoint decodes next.after before generating the local paging link."""
    mock_secret = _mock_hubspot_secret()
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    client.force_login(UserFactory.create(is_superuser=True))
    list_url = reverse("ol_hubspot:v1:hubspot-forms-list")
    expected = {
        "results": [{"id": "abc"}],
        "paging": {
            "next": {
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
    assert query["after"] == ["MjA="]
    assert query["limit"] == ["10"]
    assert query["archived"] == ["false"]
    assert query["form_types"] == ["hubspot"]


def test_get_form_detail(client, settings, mocker):
    """Detail endpoint relays data from HubSpot API helper."""
    mock_secret = _mock_hubspot_secret()
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    client.force_login(UserFactory.create())
    detail_url = reverse(
        "ol_hubspot:v1:hubspot-forms-detail", kwargs={"form_id": "abc"}
    )
    expected = {"id": "abc", "name": "Test Form"}
    get_stub = mocker.patch("ol_hubspot.views.get_form")
    get_stub.return_value = mocker.Mock(to_dict=mocker.Mock(return_value=expected))

    response = client.get(detail_url)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == expected
    get_stub.assert_called_once_with(
        form_id="abc",
        archived=None,
    )


def test_missing_token_returns_503(client, settings):
    """Endpoints return 503 if token is not configured."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = None

    client.force_login(UserFactory.create(is_superuser=True))
    list_response = client.get(reverse("ol_hubspot:v1:hubspot-forms-list"))

    client.force_login(UserFactory.create())
    detail_response = client.get(
        reverse("ol_hubspot:v1:hubspot-forms-detail", kwargs={"form_id": "abc"})
    )

    assert list_response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert detail_response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_invalid_limit_returns_400(client, settings):
    """List endpoint validates limit query param."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    client.force_login(UserFactory.create(is_superuser=True))
    list_url = reverse("ol_hubspot:v1:hubspot-forms-list")

    response = client.get(f"{list_url}?limit=abc")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {"limit": ["Must be an integer."]}


def test_list_forms_requires_superuser(client, settings):
    """List endpoint is restricted to superusers."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    list_url = reverse("ol_hubspot:v1:hubspot-forms-list")

    client.force_login(UserFactory.create())
    response = client.get(list_url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_detail_allows_anonymous_user(client, settings, mocker):
    """Detail endpoint allows anonymous access."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    detail_url = reverse(
        "ol_hubspot:v1:hubspot-forms-detail", kwargs={"form_id": "abc"}
    )
    expected = {"id": "abc", "name": "Test Form"}
    get_stub = mocker.patch("ol_hubspot.views.get_form")
    get_stub.return_value = mocker.Mock(to_dict=mocker.Mock(return_value=expected))

    response = client.get(detail_url)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == expected


def test_submit_form_success(client, settings, mocker):
    """Submit endpoint successfully submits form data."""
    mock_secret = _mock_hubspot_secret()
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    settings.RECAPTCHA_SECRET_KEY = ""
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    payload = {
        "fields": [
            {"name": "email", "value": "test@example.com"},
            {"name": "agree", "value": True},
            {"name": "tags", "value": ["tag1", "tag2"]},
        ],
        "page_uri": "https://learn.mit.edu/programs/test-program/",
    }
    mocker.patch("ol_hubspot.views._extract_client_ip", return_value="1.2.3.4")
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "submitted"}
    submit_stub.assert_called_once_with(
        form_id="form-123",
        payload={
            **payload,
            "ip_address": "1.2.3.4",
        },
    )


def test_submit_form_uses_referer_when_page_uri_missing(client, settings, mocker):
    """Submit endpoint falls back to Referer when page_uri is not provided."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    settings.RECAPTCHA_SECRET_KEY = ""
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    payload = {"fields": [{"name": "email", "value": "test@example.com"}]}
    mocker.patch("ol_hubspot.views._extract_client_ip", return_value="1.2.3.4")
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")

    response = client.post(
        submit_url,
        payload,
        format="json",
        HTTP_REFERER="https://learn.mit.edu/programs/from-referer/",
    )

    assert response.status_code == status.HTTP_200_OK
    submit_stub.assert_called_once_with(
        form_id="form-123",
        payload={
            "fields": [{"name": "email", "value": "test@example.com"}],
            "page_uri": "https://learn.mit.edu/programs/from-referer/",
            "ip_address": "1.2.3.4",
        },
    )


def test_submit_form_uses_hutk_cookie_when_payload_missing(client, settings, mocker):
    """Submit endpoint falls back to hubspotutk cookie when hutk is omitted."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    settings.RECAPTCHA_SECRET_KEY = ""
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    payload = {"fields": [{"name": "email", "value": "test@example.com"}]}
    mocker.patch("ol_hubspot.views._extract_client_ip", return_value="1.2.3.4")
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")
    client.cookies["hubspotutk"] = "abc123def456"

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_200_OK
    submit_stub.assert_called_once_with(
        form_id="form-123",
        payload={
            "fields": [{"name": "email", "value": "test@example.com"}],
            "hutk": "abc123def456",
            "ip_address": "1.2.3.4",
        },
    )


def test_extract_client_ip_uses_x_real_ip_fallback(client, settings, mocker):
    """Submit endpoint uses X-Real-IP when ipware returns no IP."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    settings.RECAPTCHA_SECRET_KEY = ""
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    payload = {"fields": [{"name": "email", "value": "test@example.com"}]}
    mocker.patch("ol_hubspot.views.get_client_ip", return_value=(None, False))
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")

    response = client.post(
        submit_url,
        payload,
        format="json",
        HTTP_X_REAL_IP="203.0.113.9",
    )

    assert response.status_code == status.HTTP_200_OK
    submit_stub.assert_called_once_with(
        form_id="form-123",
        payload={
            "fields": [{"name": "email", "value": "test@example.com"}],
            "ip_address": "203.0.113.9",
        },
    )


def test_submit_form_with_all_context_properties(client, settings, mocker):
    """Submit endpoint successfully includes all context properties."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    settings.RECAPTCHA_SECRET_KEY = ""
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    timestamp = 1701234567890
    payload = {
        "fields": [{"name": "email", "value": "test@example.com"}],
        "page_uri": "https://learn.mit.edu/programs/test-program/",
        "hutk": "abc123def456",
        "page_name": "MIT Learn - Test Program",
        "submitted_at": timestamp,
    }
    mocker.patch("ol_hubspot.views._extract_client_ip", return_value="1.2.3.4")
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "submitted"}
    submit_stub.assert_called_once_with(
        form_id="form-123",
        payload={
            **payload,
            "ip_address": "1.2.3.4",
        },
    )


def test_submit_form_verifies_recaptcha_before_forwarding(client, settings, mocker):
    """Submit endpoint verifies reCAPTCHA and does not forward the raw token."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    settings.RECAPTCHA_SECRET_KEY = _mock_recaptcha_secret()
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    payload = {
        "fields": [{"name": "email", "value": "test@example.com"}],
        "recaptcha_token": "captcha-token",
    }
    mocker.patch("ol_hubspot.views._extract_client_ip", return_value="1.2.3.4")
    verify_stub = mocker.patch("ol_hubspot.views.verify_recaptcha", return_value=True)
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_200_OK
    verify_stub.assert_called_once_with("captcha-token", remote_ip="1.2.3.4")
    submit_stub.assert_called_once_with(
        form_id="form-123",
        payload={
            "fields": [{"name": "email", "value": "test@example.com"}],
            "ip_address": "1.2.3.4",
        },
    )


def test_submit_form_rejects_failed_recaptcha(client, settings, mocker):
    """Submit endpoint returns 400 when reCAPTCHA verification fails."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    settings.RECAPTCHA_SECRET_KEY = _mock_recaptcha_secret()
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    payload = {
        "fields": [{"name": "email", "value": "test@example.com"}],
        "recaptcha_token": "captcha-token",
    }
    mocker.patch("ol_hubspot.views._extract_client_ip", return_value="1.2.3.4")
    mocker.patch("ol_hubspot.views.verify_recaptcha", return_value=False)
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {"recaptcha_token": ["reCAPTCHA verification failed."]}
    submit_stub.assert_not_called()


def test_submit_form_rejects_missing_token_when_secret_configured(
    client, settings, mocker
):
    """Submissions without a token are rejected when RECAPTCHA_SECRET_KEY is set."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    settings.RECAPTCHA_SECRET_KEY = _mock_recaptcha_secret()
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    payload = {"fields": [{"name": "email", "value": "anon@example.com"}]}
    mocker.patch("ol_hubspot.views._extract_client_ip", return_value="1.2.3.4")
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {"recaptcha_token": ["reCAPTCHA verification failed."]}
    submit_stub.assert_not_called()


def test_submit_form_rejects_invalid_token_when_secret_configured(
    client, settings, mocker
):
    """Invalid tokens are still rejected when secret is configured."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    settings.RECAPTCHA_SECRET_KEY = _mock_recaptcha_secret()
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    payload = {
        "fields": [{"name": "email", "value": "test@example.com"}],
        "recaptcha_token": "invalid-token",
    }
    mocker.patch("ol_hubspot.views._extract_client_ip", return_value="1.2.3.4")
    mocker.patch("ol_hubspot.views.verify_recaptcha", return_value=False)
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {"recaptcha_token": ["reCAPTCHA verification failed."]}
    submit_stub.assert_not_called()


def test_submit_form_invalid_payload(client, settings):
    """Submit endpoint returns 400 for invalid payload."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    # Missing required "fields" key
    payload = {}

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "fields" in response.json()


def test_submit_form_invalid_field_value_type(client, settings):
    """Submit endpoint validates field value types."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    # Invalid value type (dict instead of string/bool/array)
    payload = {"fields": [{"name": "email", "value": {"nested": "obj"}}]}

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_submit_form_rejects_empty_recaptcha_token(client, settings):
    """Submit endpoint rejects blank recaptcha_token strings."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    # Empty string should be rejected by serializer
    payload = {
        "fields": [{"name": "email", "value": "test@example.com"}],
        "recaptcha_token": "",
    }

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "recaptcha_token" in response.json()


def test_submit_form_missing_token_returns_503(client, settings):
    """Submit endpoint returns 503 if token is not configured."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = None
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    payload = {"fields": []}

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_submit_form_allows_anonymous_user(client, settings, mocker):
    """Submit endpoint allows anonymous access."""
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = _mock_hubspot_secret()
    settings.RECAPTCHA_SECRET_KEY = ""
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    mocker.patch("ol_hubspot.views._extract_client_ip", return_value="1.2.3.4")
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")

    response = client.post(
        submit_url,
        {"fields": [{"name": "email", "value": "anon@example.com"}]},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    submit_stub.assert_called_once()


def test_submit_form_hubspot_failure(client, settings, mocker):
    """Submit endpoint passes through HubSpot API failures."""
    from hubspot.marketing.forms.exceptions import ApiException

    mock_secret = _mock_hubspot_secret()
    settings.MITOL_HUBSPOT_API_PRIVATE_TOKEN = mock_secret
    settings.RECAPTCHA_SECRET_KEY = ""
    client.force_login(UserFactory.create())
    submit_url = reverse(
        "ol_hubspot:v1:hubspot-forms-submit", kwargs={"form_id": "form-123"}
    )
    payload = {"fields": [{"name": "email", "value": "test@example.com"}]}
    submit_stub = mocker.patch("ol_hubspot.views.submit_form")
    submit_stub.side_effect = ApiException(status=400)

    response = client.post(submit_url, payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {"detail": "HubSpot request failed"}
