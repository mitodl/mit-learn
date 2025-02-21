"""APISIX Middleware for MIT Learn."""

import base64
import json
import logging

from django.contrib.auth.middleware import RemoteUserMiddleware

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
    return {"username": apisix_result.get("preferred_username", None)}


class ApisixUserMiddleware(RemoteUserMiddleware):
    """Checks for and processes APISIX-specific headers."""

    header = "HTTP_X_USERINFO"

    def process_request(self, request):
        """
        Modify the header to contaiin username, pass off to RemoteUserMiddleware
        """
        if request.META.get(self.header):
            new_header = decode_apisix_headers(request, self.header)
            request.META["REMOTE_USER"] = new_header

        return super().process_request(request)
