"""Keycloak Admin API access with a bounded request timeout"""

import logging

from django.conf import settings
from keycloak import KeycloakAdmin
from keycloak.openid_connection import KeycloakOpenIDConnection
from mitol.keycloak.constants import READONLY_USER_ATTRIBUTES
from mitol.keycloak.data_models import UserAttributes

log = logging.getLogger(__name__)

# Every caller of the Admin API here runs inside a request: reading a user's
# federated identities happens while serializing the current user, and pushing
# the email opt-in happens on a profile PATCH and on one-click unsubscribe.
# python-keycloak defaults to a 60 second timeout, which would hand a user a
# minute-long hang whenever Keycloak is slow or misconfigured.
ADMIN_TIMEOUT_SECONDS = 5


def get_admin_client() -> KeycloakAdmin:
    """
    Return a Keycloak admin client that gives up quickly.

    mitol.keycloak.api.get_admin_client() builds the same client but does not
    expose a timeout, so it inherits python-keycloak's 60 second default.
    """
    connection = KeycloakOpenIDConnection(
        server_url=settings.MITOL_KEYCLOAK_BASE_URL,
        realm_name=settings.MITOL_KEYCLOAK_REALM_NAME,
        client_id=settings.MITOL_KEYCLOAK_ADMIN_CLIENT_ID,
        client_secret_key=settings.MITOL_KEYCLOAK_ADMIN_CLIENT_SECRET,
        verify=not settings.MITOL_KEYCLOAK_ADMIN_CLIENT_NO_VERIFY_SSL,
        timeout=ADMIN_TIMEOUT_SECONDS,
    )
    return KeycloakAdmin(connection=connection)


def update_user_attributes(uuid: str, *, attributes: UserAttributes) -> None:
    """
    Merge attributes onto a Keycloak user.

    Mirrors mitol.keycloak.api.update_user, but through the timeout-bounded
    client above. Keycloak has no PATCH for users, only a PUT that overwrites,
    so the current representation is read first and the attributes merged onto
    it — minus the fields Keycloak rejects as read-only.
    """
    client = get_admin_client()

    payload = client.get_user(uuid)
    for attr in READONLY_USER_ATTRIBUTES:
        payload.pop(attr, None)

    payload.setdefault("attributes", {}).update(
        attributes.model_dump(exclude_none=True)
    )

    client.update_user(uuid, payload)
