"""Tests for bounded Keycloak Admin API access"""

import pytest
from mitol.keycloak.data_models import UserAttributes

from main import keycloak


@pytest.fixture
def keycloak_settings(settings):
    """Configure the admin client settings"""
    settings.MITOL_KEYCLOAK_BASE_URL = "https://sso.example.edu"
    settings.MITOL_KEYCLOAK_REALM_NAME = "olapps"
    settings.MITOL_KEYCLOAK_ADMIN_CLIENT_ID = "mitlearn-admin-client"
    settings.MITOL_KEYCLOAK_ADMIN_CLIENT_SECRET = "a-secret"  # noqa: S105
    settings.MITOL_KEYCLOAK_ADMIN_CLIENT_NO_VERIFY_SSL = False
    return settings


@pytest.mark.usefixtures("keycloak_settings")
def test_get_admin_client_sets_a_timeout(mocker):
    """
    The client must not inherit python-keycloak's 60 second default.

    Every caller runs inside a request, so an unresponsive Keycloak would
    otherwise hang a page load or a profile save for a full minute.
    """
    connection = mocker.patch("main.keycloak.KeycloakOpenIDConnection")
    mocker.patch("main.keycloak.KeycloakAdmin")

    keycloak.get_admin_client()

    kwargs = connection.call_args.kwargs
    assert kwargs["timeout"] == keycloak.ADMIN_TIMEOUT_SECONDS
    assert kwargs["timeout"] < 60
    assert kwargs["server_url"] == "https://sso.example.edu"
    assert kwargs["realm_name"] == "olapps"
    assert kwargs["client_id"] == "mitlearn-admin-client"
    assert kwargs["verify"] is True


@pytest.mark.usefixtures("keycloak_settings")
def test_get_admin_client_honours_no_verify_ssl(mocker, settings):
    """MITOL_KEYCLOAK_ADMIN_CLIENT_NO_VERIFY_SSL inverts into `verify`"""
    settings.MITOL_KEYCLOAK_ADMIN_CLIENT_NO_VERIFY_SSL = True
    connection = mocker.patch("main.keycloak.KeycloakOpenIDConnection")
    mocker.patch("main.keycloak.KeycloakAdmin")

    keycloak.get_admin_client()

    assert connection.call_args.kwargs["verify"] is False


def test_update_user_attributes_merges_onto_current_user(mocker):
    """
    Keycloak only offers PUT for users, so the payload must be read, merged and
    written back rather than sent as a partial update.
    """
    client = mocker.patch("main.keycloak.get_admin_client").return_value
    client.get_user.return_value = {
        "id": "a-uuid",
        "username": "learner",
        "attributes": {"existing": "kept"},
    }

    keycloak.update_user_attributes("a-uuid", attributes=UserAttributes(email_optin=1))

    client.get_user.assert_called_once_with("a-uuid")
    uuid, payload = client.update_user.call_args.args
    assert uuid == "a-uuid"
    assert payload["username"] == "learner"
    assert payload["attributes"]["existing"] == "kept"
    # Keycloak attributes are multi-valued, and the model aliases the field
    assert payload["attributes"]["emailOptIn"] == [True]


def test_update_user_attributes_strips_readonly_fields(mocker):
    """Keycloak rejects a PUT that echoes back its read-only fields"""
    from mitol.keycloak.constants import READONLY_USER_ATTRIBUTES

    client = mocker.patch("main.keycloak.get_admin_client").return_value
    client.get_user.return_value = {
        "username": "learner",
        **dict.fromkeys(READONLY_USER_ATTRIBUTES, "should-be-dropped"),
    }

    keycloak.update_user_attributes("a-uuid", attributes=UserAttributes(email_optin=0))

    _, payload = client.update_user.call_args.args
    for attr in READONLY_USER_ATTRIBUTES:
        assert attr not in payload
