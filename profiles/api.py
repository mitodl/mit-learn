"""Profile API"""

import tldextract
from mitol.keycloak import api as keycloak_api

from profiles.models import (
    PERSONAL_SITE_TYPE,
    SITE_TYPE_OPTIONS,
    Profile,
    filter_profile_props,
)


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


def get_site_type_from_url(url):
    """
    Gets a site type (as defined in profiles.models) from the given URL

    Args:
        url (str): A URL

    Returns:
        str: A string indicating the site type
    """  # noqa: D401
    no_fetch_extract = tldextract.TLDExtract(suffix_list_urls=False)
    extract_result = no_fetch_extract(url)
    domain = extract_result.domain.lower()
    if domain in SITE_TYPE_OPTIONS:
        return domain
    return PERSONAL_SITE_TYPE


PROFILE_TO_KEYCLOAK_ATTR_MAP = {"name": "full_name"}


def sync_to_keycloak(profile: Profile, update_fields: list[str]):
    """
    Sync a profile to Keycloak
    """
    raw_attrs = {
        PROFILE_TO_KEYCLOAK_ATTR_MAP[key]: value
        for key, value in update_fields.list()
        if key in PROFILE_TO_KEYCLOAK_ATTR_MAP
    }

    if not raw_attrs:
        # no attributes that need to be updated in keycloak
        return

    attributes = UserAttributes(**raw_attrs)

    keycloak_api.update_user(profile.user.global_id, attributes)
