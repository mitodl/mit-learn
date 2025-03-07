"""APISIX Middleware for MIT Learn."""

import base64
import json
import logging

from django.contrib.auth import get_user_model, logout
from django.contrib.auth.middleware import RemoteUserMiddleware
from django.core.exceptions import ImproperlyConfigured

log = logging.getLogger(__name__)


def decode_apisix_headers(request, header):
    """
    Decode APISIX-specific headers and return the username as a dict.

    Returns: dict containing username from APISIX/Keycloak
    """
    x_userinfo = request.META[header]
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
    #return {"username": apisix_result.get("preferred_username", None)}
    return {
        modelKey: apisix_result[data_mapping[modelKey]]
        for modelKey in data_mapping
        if data_mapping[modelKey] in apisix_result
    }

def get_user_from_apisix_headers(request, decoded_headers):
    """Get a user based on the APISIX headers."""

    User = get_user_model()

    if not decoded_headers:
        return None

    global_id = decoded_headers.get("global_id", None)

    log.info("get_user_from_apisix_headers: Authenticating %s", global_id)

    user, created = User.objects.filter(global_id=global_id).get_or_create(
        defaults={
            "global_id": global_id,
            "username": decoded_headers.get("username", ""),
            "email": decoded_headers.get("email", ""),
            "name": decoded_headers.get("name", ""),
        }
    )

    if created:
        log.info(
            "get_user_from_apisix_headers: User %s not found, created new",
            global_id,
        )
        user.set_unusable_password()
        user.save()
    else:
        log.info(
            "get_user_from_apisix_headers: Found existing user for %s: %s",
            global_id,
            user,
        )

        user.name = decoded_headers.get("name", "")
        user.save()

    profile_data = decode_apisix_headers(request, "users_userprofile")

    if profile_data:
        log.info(
            "get_user_from_apisix_headers: Setting up additional profile for %s",
            global_id,
        )

        _, profile = user.profile.filter(user=user).get_or_create(defaults=profile_data)
        profile.save()
        user.refresh_from_db()

    return user


class ApisixUserMiddleware(RemoteUserMiddleware):
    """Checks for and processes APISIX-specific headers."""

    header = "HTTP_X_USERINFO"

    def process_request(self, request):
        """
        Modify the header to contaiin username, pass off to RemoteUserMiddleware
        """
        if request.META.get(self.header):
            new_header = decode_apisix_headers(request, self.header)
            log.info("APISIX User: %s", new_header)
            request.META["REMOTE_USER"] = new_header

            try:
                get_user_from_apisix_headers(request, new_header)
            except KeyError:
                if self.force_logout_if_no_header and request.user.is_authenticated:
                    log.debug("Forcing user logout due to missing APISIX headers.")
                    logout(request)
                return None
        return super().process_request(request)

        # if apisix_user:
        #     if request.user.is_authenticated and request.user != apisix_user:
        #         # The user is authenticated, but doesn't match the user we got
        #         # from APISIX. So, log them out so the APISIX user takes
        #         # precedence.
        #         log.debug(
        #             "Forcing user logout because request user doesn't match APISIX user"
        #         )
        #
        #         logout(request)
        #
        #     request.user = apisix_user
        #     login(
        #         request,
        #         apisix_user,
        #         backend="django.contrib.auth.backends.ModelBackend",
        #     )
