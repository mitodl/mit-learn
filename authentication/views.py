"""Authentication views"""

import logging
import os
from urllib.parse import urljoin

from django.contrib.auth import logout
from django.core.cache import caches
from django.http import HttpRequest
from django.shortcuts import redirect
from django.utils.http import url_has_allowed_host_and_scheme
from django.views import View

from main import settings

log = logging.getLogger(__name__)


def get_redirect_url(request: HttpRequest) -> str:
    """
    Get the redirect URL from the request.

    Args:
        request(HttpRequest): Django request object

    Returns:
        str: Redirect URL
    """
    next_url = request.GET.get("next")
    return (
        next_url
        if next_url
        and url_has_allowed_host_and_scheme(
            next_url, allowed_hosts=settings.ALLOWED_REDIRECT_HOSTS
        )
        else "/app"
    )


def next_cache_key(username: str) -> str:
    """
    Return the cache key for the next URL for a user.

    Args:
        username: The User.username value

    Returns:
        str: User-specific cache key
    """
    return f"{username}_next_logout"


class NextLogoutView(View):
    """
    Set the next URL in the redis cache then redirect to actual logout url.
    """

    def get(
        self,
        request,
        *args,  # noqa: ARG002
        **kwargs,  # noqa: ARG002
    ):
        """
        GET endpoint for setting a next URL in the redis cache before logging out.
        """
        if request.GET.get("next", None) and request.user.is_authenticated:
            caches["redis"].set(
                next_cache_key(request.user.username),
                get_redirect_url(request),
                timeout=30,
            )
        return redirect(urljoin(os.environ.get("MITOL_API_BASE_URL"), "/logout/oidc"))


class CustomLogoutView(View):
    """
    Log out the user from django
    """

    def get(
        self,
        request,
        *args,  # noqa: ARG002
        **kwargs,  # noqa: ARG002
    ):
        """
        GET endpoint reached after logging a user out from Keycloak
        """
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            logout(request)
        try:
            next_url = caches["redis"].get(next_cache_key(user.username), None)
        except Exception as e:  # noqa: BLE001
            log.debug("The next url key could not be retrieved: %s", e)
            next_url = None
        return redirect(next_url or settings.LOGOUT_REDIRECT_URL)


class CustomLoginView(View):
    """
    Redirect the user after login.
    """

    def get(
        self,
        request,
        *args,  # noqa: ARG002
        **kwargs,  # noqa: ARG002
    ):
        """
        GET endpoint for logging a user in.
        """
        return redirect(get_redirect_url(request))
