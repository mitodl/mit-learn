"""Profile API"""

import logging

from mitol.keycloak import api as keycloak_api
from mitol.keycloak.data_models import UserAttributes

from profiles.models import Profile, filter_profile_props

log = logging.getLogger(__name__)


def ensure_profile(user, profile_data=None):
    """
    Ensures the user has a profile

    Args:
        user (User): the user to ensure a profile for
        profile_data (dict): the profile data for the user

    Returns:
        Profile: the user's profile
    """  # noqa: D401
    defaults = filter_profile_props(profile_data) if profile_data else {}

    profile, _ = Profile.objects.update_or_create(user=user, defaults=defaults)

    return profile


def sync_email_optin_to_keycloak(user, *, email_optin):
    """Push the user's email opt-in preference to their Keycloak account"""
    if not keycloak_api.is_admin_client_configured():
        return

    if not user.global_id:
        log.warning(
            "Cannot sync email_optin to Keycloak for user %s: no global_id", user.id
        )
        return

    keycloak_api.update_user(
        user.global_id, attributes=UserAttributes(email_optin=1 if email_optin else 0)
    )
