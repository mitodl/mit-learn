"""Authentication api"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import caches
from django.db import transaction
from keycloak import KeycloakOpenID
from keycloak.exceptions import KeycloakError
from mitol.keycloak import api as keycloak_api
from requests.exceptions import RequestException

from authentication.hooks import get_plugin_manager
from main import keycloak as main_keycloak
from profiles import api as profile_api

User = get_user_model()

log = logging.getLogger()

SSO_USER_CACHE_PREFIX = "authentication.is_sso_user:"
SSO_USER_CACHE_TIMEOUT = 60 * 60  # 1 hour


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

    Requires the Keycloak admin client to be configured. When it isn't (e.g.
    local development) we can't tell, so we report False and let Keycloak be
    the final arbiter.

    The answer is cached because it is read on every request for the current
    user, and a user's federated identity links effectively never change.
    """
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

    cache = caches["redis"]
    cache_key = f"{SSO_USER_CACHE_PREFIX}{global_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        admin_client = main_keycloak.get_admin_client()
        is_sso = bool(admin_client.get_user_social_logins(global_id))
    except (KeycloakError, RequestException):
        log.exception("Failed to fetch federated identities for user %s", user.id)
        return False

    cache.set(cache_key, is_sso, SSO_USER_CACHE_TIMEOUT)
    return is_sso


def fetch_keycloak_userinfo(*, code: str, redirect_uri: str) -> dict | None:
    """
    Exchange an account action authorization code for the user's claims.

    Keycloak hands us an authorization code when an account action finishes. We
    trade it for tokens purely to read fresh claims: the API gateway caches
    userinfo for the life of its session (14 days in deployed environments), so
    its X-UserInfo header still carries the pre-change values.

    Returns None if the exchange isn't possible or fails; callers should treat
    that as "unknown" rather than an error.
    """
    if not settings.KEYCLOAK_CLIENT_ID or not settings.KEYCLOAK_CLIENT_SECRET:
        log.warning(
            "Cannot read updated details from Keycloak: "
            "KEYCLOAK_CLIENT_ID/KEYCLOAK_CLIENT_SECRET are not configured"
        )
        return None

    oidc_client = KeycloakOpenID(
        server_url=settings.KEYCLOAK_BASE_URL,
        realm_name=settings.KEYCLOAK_REALM_NAME,
        client_id=settings.KEYCLOAK_CLIENT_ID,
        client_secret_key=settings.KEYCLOAK_CLIENT_SECRET,
    )

    try:
        token = oidc_client.token(
            grant_type="authorization_code",
            code=code,
            redirect_uri=redirect_uri,
        )
        return oidc_client.userinfo(token["access_token"])
    except (KeycloakError, KeyError):
        # The code is single use and short lived, so this is plausible on a
        # replayed or stale callback. Nothing to recover here.
        log.exception("Failed to exchange the account action code with Keycloak")
        return None


def sync_email_from_keycloak(*, code: str, redirect_uri: str) -> bool:
    """
    Bring the stored email in line with Keycloak after an email change.

    The user is identified from the token exchange itself (the `sub` claim)
    rather than from the request. `request.user` is not dependable here: the
    APISIX middleware logs the Django user out whenever a request arrives
    without an X-UserInfo header, which is exactly the case on this callback in
    setups where the gateway isn't in front of Django.

    Trusting `sub` is sound — the code is single use, and exchanging it requires
    our client secret, so the claims come from Keycloak rather than the caller.

    Returns True if the stored email changed.
    """
    userinfo = fetch_keycloak_userinfo(code=code, redirect_uri=redirect_uri)
    if not userinfo:
        return False

    global_id = userinfo.get("sub")
    email = userinfo.get("email")
    if not global_id or not email:
        log.warning(
            "Keycloak returned no sub/email for the account action; "
            "cannot update the stored email"
        )
        return False

    user = User.objects.filter(global_id=global_id).first()
    if user is None:
        log.warning("No user matches the global_id from the account action callback")
        return False

    if user.email == email:
        return False

    log.info("Updating email for user %s from Keycloak", user.id)
    user.email = email
    user.save(update_fields=["email", "updated_on"])
    return True


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
