"""APISIX Middleware for MIT Learn."""

import base64
import json
import logging

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.middleware import RemoteUserMiddleware
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q
from posthog import Posthog

from authentication.api import user_created_actions
from main.constants import PostHogEvents
from profiles.models import filter_profile_props

log = logging.getLogger(__name__)

# User fields synced from the APISIX user headers (defaults match update_or_create).
USER_SYNC_FIELDS = ("global_id", "email", "username", "first_name", "last_name")


def user_fields_from_headers(decoded_headers):
    """Map the decoded user headers to the synced User fields."""
    return {
        "global_id": decoded_headers.get("global_id"),
        "email": decoded_headers.get("email", ""),
        "username": decoded_headers.get("username", ""),
        "first_name": decoded_headers.get("first_name", ""),
        "last_name": decoded_headers.get("last_name", ""),
    }


def user_needs_update(user, user_fields):
    """Return True if any synced User field differs from the headers."""
    return any(getattr(user, field) != user_fields[field] for field in USER_SYNC_FIELDS)


def profile_needs_update(user, profile_data):
    """Return True if the profile is missing or any synced field differs."""
    try:
        profile = user.profile
    except ObjectDoesNotExist:
        return True
    props = filter_profile_props(profile_data) if profile_data else {}
    return any(getattr(profile, key) != value for key, value in props.items())


def decode_apisix_headers(request, header, model=settings.AUTH_USER_MODEL):
    """
    Decode APISIX-specific headers and return the username as a dict.

    Args:
        request: Django request object
        header: Header to decode
        model: Model to decode the header for (user or profile)

    Returns:
        dict containing model attributes from APISIX/Keycloak
    """
    if model not in settings.APISIX_USERDATA_MAP:
        error = f"Model {model} is invalid"
        raise ValueError(error, model)

    data_mapping = settings.APISIX_USERDATA_MAP[model]

    x_userinfo = request.META.get(header, None)
    if not x_userinfo:
        return None

    try:
        apisix_result = json.loads(base64.b64decode(x_userinfo))
        if not apisix_result:
            err_msg = "decode_apisix_headers: No APISIX-specific header found"
            raise KeyError(err_msg)
    except json.JSONDecodeError:
        log.debug(
            "decode_apisix_headers: Got bad APISIX-specific header: %s",
            request.META.get("HTTP_X_USERINFO", ""),
        )

        return None

    log.debug("decode_apisix_headers: Got %s", apisix_result)
    return {
        modelKey: apisix_result[data_mapping[modelKey]]
        for modelKey in data_mapping
        if data_mapping[modelKey] in apisix_result
    }


def get_user_from_apisix_headers(request, decoded_headers, original_header):
    """
    Get a user based on the APISIX headers, create user/profile if needed.

    Args:
        request: Django request object
        decoded_headers: Decoded APISIX headers
        original_header: Original header

    Returns:
        User object

    """

    User = get_user_model()

    if not decoded_headers:
        return None

    global_id = decoded_headers.get("global_id")
    if not global_id:
        log.error("No global_id found in APISIX headers")
        return None
    email = decoded_headers.get("email", "")

    profile_data = decode_apisix_headers(
        request, original_header, model="profiles.Profile"
    )
    user_fields = user_fields_from_headers(decoded_headers)

    if (
        request.user
        and request.user.is_authenticated
        and request.user.global_id == global_id
    ):
        user = request.user
        created = False
    else:
        user, created = (
            User.objects.filter(
                Q(global_id=global_id) | Q(global_id__isnull=True, email=email)
            )
            .select_related("profile")
            .get_or_create(defaults=user_fields)
        )

    if created:
        log.info(
            "get_user_from_apisix_headers: User %s not found, created new",
            global_id,
        )
        # Send user creation event to PostHog
        if settings.POSTHOG_PROJECT_API_KEY:
            posthog = Posthog(
                settings.POSTHOG_PROJECT_API_KEY, host=settings.POSTHOG_API_HOST
            )
            posthog.capture(
                user.id,
                event=PostHogEvents.ACCOUNT_CREATED.value,
                properties={
                    "$current_url": request.build_absolute_uri(),
                    "global_id": global_id,
                    "email": email,
                    "first_name": decoded_headers.get("first_name", ""),
                    "last_name": decoded_headers.get("last_name", ""),
                },
            )

        user.set_unusable_password()
        user.is_active = True
        user.save()
    elif user_needs_update(user, user_fields):
        for field, value in user_fields.items():
            setattr(user, field, value)
        user.save(update_fields=[*user_fields, "updated_on"])

    if created:
        user_created_actions(user=user, is_new=True, details=profile_data)
        user = User.objects.select_related("profile").get(pk=user.pk)
    elif profile_needs_update(user, profile_data):
        log.debug(
            "get_user_from_apisix_headers: Updating profile for %s",
            global_id,
        )
        user_created_actions(user=user, is_new=False, details=profile_data)
        user = User.objects.select_related("profile").get(pk=user.pk)

    return user


class ApisixUserMiddleware(RemoteUserMiddleware):
    """Checks for and processes APISIX-specific headers."""

    header = "HTTP_X_USERINFO"

    def process_request(self, request):
        """
        Modify the header to contain username, pass off to RemoteUserMiddleware
        """
        if settings.DISABLE_APISIX_USER_MIDDLEWARE:
            return super().process_request(request)
        apisix_user = None
        if request.META.get(self.header):
            new_header = decode_apisix_headers(
                request, self.header, model=settings.AUTH_USER_MODEL
            )
            request.META["REMOTE_USER"] = new_header

            try:
                apisix_user = get_user_from_apisix_headers(
                    request, new_header, self.header
                )
            except KeyError:
                if self.force_logout_if_no_header and request.user.is_authenticated:
                    log.debug("Forcing user logout because no APISIX user was found")
                    logout(request)
                return None
        if apisix_user:
            if request.user.is_authenticated and request.user == apisix_user:
                # Already logged in as this user: skip login() so we don't cycle
                # the session and write last_login on every request.
                request.user = apisix_user
                return self.get_response(request)

            if request.user.is_authenticated and request.user != apisix_user:
                # The user is authenticated, but doesn't match the user we got
                # from APISIX. So, log them out so the APISIX user takes
                # precedence.
                log.debug(
                    "Forcing user logout because request user doesn't match APISIX user"
                )
                logout(request)

            request.user = apisix_user
            login(
                request,
                apisix_user,
                backend="django.contrib.auth.backends.ModelBackend",
            )

        if not apisix_user and request.user.is_authenticated:
            # If we didn't get a user from APISIX, but the user is still
            # authenticated, log them out.
            log.debug("Forcing user logout because no APISIX user was found")
            logout(request)

        return self.get_response(request)
