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
        GET endpoint for logging a user out.
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
        GET endpoint for logging a user out.
        """
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            logout(request)
        return redirect(
            caches["redis"].get(next_cache_key(user.username), None)
            or settings.LOGOUT_REDIRECT_URL
        )


class CustomLoginView(View):
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
        GET endpoint for logging a user in.
        """
        return redirect(get_redirect_url(request))
