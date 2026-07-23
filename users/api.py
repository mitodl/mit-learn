"""Users API"""

import logging

from django.contrib.auth import get_user_model
from django.db import transaction
from keycloak.exceptions import KeycloakError

from profiles.api import sync_email_optin_to_keycloak
from users.utils import unsign_unsubscribe_token

log = logging.getLogger(__name__)
User = get_user_model()


def unsubscribe(token) -> bool:
    """Unsubscribe the user identified by token.

    Returns True on success, False if token is invalid/expired/unknown.
    """
    uuid_str = unsign_unsubscribe_token(token)
    if not uuid_str:
        return False
    user = User.objects.filter(unsubscribe_uuid=uuid_str).first()
    if not user:
        return False
    profile = user.profile
    try:
        with transaction.atomic():
            sync_email_optin_to_keycloak(user, email_optin=False)
            profile.email_optin = False
            profile.save(update_fields=["email_optin"])
    except KeycloakError:
        log.exception("Failed to sync email_optin to Keycloak for user %s", user.id)
        return False
    return True
