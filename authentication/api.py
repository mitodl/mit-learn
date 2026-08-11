"""Authentication api"""

import logging

from django.contrib.auth import get_user_model
from django.db import transaction
from keycloak.exceptions import KeycloakError
from mitol.keycloak import api as keycloak_api
from requests.exceptions import RequestException

from authentication.hooks import get_plugin_manager
from profiles import api as profile_api

User = get_user_model()

log = logging.getLogger()


def create_user(username, email, profile_data=None, user_extra=None):
    """
    Ensures the user exists

    Args:
        email (str): the user's email
        profile (dic): the profile data for the user

    Returns:
        User: the user
    """  # noqa: D401
    defaults = {}

    if user_extra is not None:
        defaults.update(user_extra)

    # this takes priority over a passed in value
    defaults.update({"username": username})

    with transaction.atomic():
        user, _ = User.objects.get_or_create(email=email, defaults=defaults)
        profile_api.ensure_profile(user, profile_data=profile_data)

    return user


def is_sso_user(user) -> bool:
    """
    Return True if the user signs in through an external identity provider.

    Such users have no local Keycloak credentials, so they can't change their
    email or password here — that lives with their institution.

    The answer lives on `User.is_sso_user`, which starts null and is filled in
    the first time it is needed. Once set it is authoritative and Keycloak is
    not consulted again: the value effectively never changes on its own, and
    keeping it editable means someone can be granted local credentials — for
    instance to keep their account after leaving the organization that provided
    their identity — by clearing the flag.

    Determining it requires the Keycloak admin client. When that isn't
    configured (e.g. local development) we can't tell, so we report False
    without storing anything and let Keycloak be the final arbiter.
    """
    stored = getattr(user, "is_sso_user", None)
    if stored is not None:
        return stored

    global_id = getattr(user, "global_id", None)
    if not global_id:
        return False

    if not keycloak_api.is_admin_client_configured():
        log.debug(
            "Keycloak admin client is not configured; cannot determine whether "
            "user %s is an SSO user",
            user.id,
        )
        return False

    try:
        admin_client = keycloak_api.get_admin_client()
        is_sso = bool(admin_client.get_user_social_logins(global_id))
    except (KeycloakError, RequestException):
        # Leave the field null so the next read tries again, rather than
        # recording a guess.
        log.exception("Failed to fetch federated identities for user %s", user.id)
        return False

    user.is_sso_user = is_sso
    user.save(update_fields=["is_sso_user", "updated_on"])
    return is_sso


def user_created_actions(*, user, details, **kwargs):
    """
    Trigger plugins when a user is created
    """
    if kwargs.get("is_new"):
        pm = get_plugin_manager()
        hook = pm.hook
        hook.user_created(user=user, user_data={"profile": details})
    else:
        profile_api.ensure_profile(user=user, profile_data=details)
