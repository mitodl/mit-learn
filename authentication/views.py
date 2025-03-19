"""Authentication views"""

import logging

from django.contrib.auth import logout, views
from django.shortcuts import redirect
from django.utils.http import url_has_allowed_host_and_scheme

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


class CustomLogoutView(views.LogoutView):
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
        return redirect(get_redirect_url(request))


class CustomLoginView(views.LoginView):
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
