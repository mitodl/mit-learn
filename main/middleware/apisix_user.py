"""APISIX Middleware for MIT Learn."""

import base64
import json
import logging

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.middleware import PersistentRemoteUserMiddleware
from django.core.exceptions import ImproperlyConfigured

from authentication.pipeline.user import user_created_actions

User = get_user_model()


log = logging.getLogger(__name__)


def decode_x_header(request, header):
    """
    Decode an 'X-' header.

    For things that put some JSON-encoded data in a HTTP header, this will both
    base64 decode it and then JSON decode it, and return the resulting dict.
    (This is used for the APISIX code - it puts user data in X-User-Info in
    this format.)

    Args:
        request (HttpRequest): the HTTP request
        header (str): the name of the header to decode
    Returns:
    dict of decoded values, or None if the header isn't found
    """
    x_userinfo = request.META.get(header, False)

    if not x_userinfo:
        return None

    decoded_x_userinfo = base64.b64decode(x_userinfo)
    return json.loads(decoded_x_userinfo)


def decode_apisix_headers(request, model=settings.AUTH_USER_MODEL):
    """
    Decode the APISIX-specific headers.

    APISIX delivers user information via the X-User-Info header that it
    attaches to the request. This data can contain an arbitrary amount of
    information, so this returns just the data that we care about, normalized
    into a structure we expect (or rather ones that match Django objects).

    This mapping can be adjusted by changing the APISIX_USERDATA_MAP setting.
    This is a nested dict: the top level is the model that the mapping belongs
    to, and it is set to a dict of the mappings of model field names to APISIX
    field names. Model names are in app_model form (like the table name).

    Args:
    - request (Request): the current HTTP request object
    - model (string): the model data to retrieve (defaults to "auth_user")

    Returns: dict of applicable data or None if no data
    """

    if model not in settings.APISIX_USERDATA_MAP:
        error = "Model %s is invalid"
        raise ValueError(error, model)

    data_mapping = settings.APISIX_USERDATA_MAP[model]

    try:
        apisix_result = decode_x_header(request, "HTTP_X_USERINFO")
        if not apisix_result:
            log.debug(
                "decode_apisix_headers: No APISIX-specific header found",
            )
            return None
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


def get_user_from_apisix_headers(request):
    """Get a user based on the APISIX headers."""

    decoded_headers = decode_apisix_headers(request)

    if not decoded_headers:
        return None

    log.debug("decoded headers: %s", decoded_headers)

    email = decoded_headers.get("email", None)
    global_id = decoded_headers.get("global_id", None)
    username = decoded_headers.get("username", None)
    given_name = decoded_headers.get("given_name", "")
    family_name = decoded_headers.get("family_name", "")
    name = decoded_headers.get("name", None)

    log.debug("get_user_from_apisix_headers: Authenticating %s", global_id)

    user, created = User.objects.update_or_create(
        email=email,
        defaults={
            "username": username,
            "first_name": given_name,
            "last_name": family_name,
        },
    )

    if created:
        log.debug(
            "get_user_from_apisix_headers: User %s not found, created new",
            global_id,
        )
        user.set_unusable_password()
        user.is_active = True
        user.save()
    else:
        log.debug(
            "get_user_from_apisix_headers: Found existing user for %s: %s",
            global_id,
            user,
        )

        if not user.is_active:
            log.debug(
                "get_user_from_apisix_headers: User %s is inactive",
                global_id,
            )
            msg = "User is inactive"
            raise KeyError(msg)

    profile_data = decode_apisix_headers(request, "profiles.Profile")

    if profile_data:
        log.debug(
            "get_user_from_apisix_headers: Setting up additional profile for %s",
            global_id,
        )
    user_created_actions(user=user, details={"name": name, **profile_data})
    user.refresh_from_db()

    return user


class ApisixUserMiddleware(PersistentRemoteUserMiddleware):
    """Checks for and processes APISIX-specific headers."""

    def process_request(self, request):
        """
        Check the request for an authenticated user, or authenticate using the
        APISIX data if there isn't one.
        """

        if not hasattr(request, "user"):
            msg = "ApisixUserMiddleware requires the authentication middleware."
            raise ImproperlyConfigured(msg)

        try:
            apisix_user = get_user_from_apisix_headers(request)
        except KeyError:
            if self.force_logout_if_no_header and request.user.is_authenticated:
                log.debug("Forcing user logout due to missing APISIX headers.")
                logout(request)
            return None

        if apisix_user:
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

        request.api_gateway_userdata = decode_apisix_headers(request)

        return self.get_response(request)
