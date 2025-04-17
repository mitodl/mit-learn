"""Authentication views"""

import logging

from django.contrib.auth import logout
from django.shortcuts import redirect
from django.utils.http import url_has_allowed_host_and_scheme, urlencode
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
    next_url = request.GET.get("next") or request.COOKIES.get("next")
    return (
        next_url
        if next_url
        and url_has_allowed_host_and_scheme(
            next_url, allowed_hosts=settings.ALLOWED_REDIRECT_HOSTS
        )
        else "/app"
    )


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
        user_redirect_url = get_redirect_url(request)
        if user and user.is_authenticated:
            logout(request)
        if request.META.get(ApisixUserMiddleware.header):
            # Still logged in via Apisix/Keycloak, so log out there as well
            return redirect(settings.OIDC_LOGOUT_URL)
        else:
            return redirect(user_redirect_url)


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
        redirect_url = get_redirect_url(request)
        if not request.user.is_anonymous:
            profile = request.user.profile
            if (
                not profile.completed_onboarding
                and request.GET.get("skip_onboarding", "0") != "1"
            ):
                params = urlencode({"next": redirect_url})
                redirect_url = f"{settings.MITOL_NEW_USER_LOGIN_URL}?{params}"
            profile.completed_onboarding = True
            profile.save()
        return redirect(redirect_url)
