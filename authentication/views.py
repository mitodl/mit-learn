"""Authentication views"""

import logging
import os
from urllib.parse import urljoin

from django.contrib.auth import logout
from django.core.cache import caches
from django.shortcuts import redirect
from django.utils.http import url_has_allowed_host_and_scheme
from django.views import View

from main import settings
from main.middleware.apisix_user import ApisixUserMiddleware

log = logging.getLogger(__name__)


def get_redirect_url(request):
    """
    Get the redirect URL from the request.

    Args:
        request: Django request object

    Returns:
        str: Redirect URL
    """
    next_url = request.GET.get("next")
    user =  request.user
    if user and user.is_authenticated and not next_url:
        next_url = caches["redis"].get(next_cache_key(user.username), None)
    return (
        next_url
        if next_url
        and url_has_allowed_host_and_scheme(
            next_url, allowed_hosts=settings.ALLOWED_REDIRECT_HOSTS
        )
        else "/app"
    )


def next_cache_key(username):
    """
    Get the cache key for the next URL for a user.

    Args:
        request: Django request object
    """
    return f"{username}_next_logout"

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
        # Temporarily cache the next parameter URL if present
        # next will not be present when redirected from APISIX/Keycloak
        if request.GET.get("next", None) and user.is_authenticated:
            caches["redis"].set(
                next_cache_key(user.username),
                get_redirect_url(request),
                timeout=30,
            )
        user_redirect_url = redirect(get_redirect_url(request))        
        if user and user.is_authenticated:
            logout(request)
        if request.META.get(ApisixUserMiddleware.header):
            # Still logged in via Apisix/Keycloak, so log out there as well
            return redirect(settings.OIDC_LOGOUT_URL)
        else:
            return user_redirect_url


class CustomLoginView(View):
    """
    Redirect the user to the appropriate url after login
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
