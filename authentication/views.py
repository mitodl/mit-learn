"""Authentication views"""

import logging

from django.conf import settings
from django.contrib.auth import logout
from django.shortcuts import redirect
from django.utils.http import url_has_allowed_host_and_scheme, urlencode
from django.views import View

from main.middleware.apisix_user import ApisixUserMiddleware, decode_apisix_headers

log = logging.getLogger(__name__)


def get_redirect_url(request, param_names):
    """
    Get the redirect URL from the request.

    Args:
        request: Django request object
        param_names: Names of the GET parameter or cookie to look for the redirect URL;
            first match will be used.

    Returns:
        str: Redirect URL
    """
    for param_name in param_names:
        next_url = request.GET.get(param_name)
        if next_url and url_has_allowed_host_and_scheme(
            next_url, allowed_hosts=settings.ALLOWED_REDIRECT_HOSTS
        ):
            return next_url

    return "/app"


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
        user_redirect_url = get_redirect_url(request, ["next"])
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

    header = "HTTP_X_USERINFO"

    def get(
        self,
        request,
        *args,  # noqa: ARG002
        **kwargs,  # noqa: ARG002
    ):
        """
        GET endpoint for logging a user in.
        """
        redirect_url = get_redirect_url(request, ["next"])
        signup_redirect_url = get_redirect_url(request, ["signup_next", "next"])
        should_skip_onboarding = request.GET.get("skip_onboarding", "0") != "0"
        if not request.user.is_anonymous:
            profile = request.user.profile

            apisix_header = decode_apisix_headers(request, self.header)

            # Check if user belongs to any organizations
            user_organizations = (
                apisix_header.get("organizations", {}) if apisix_header else {}
            )

            if user_organizations:
                should_skip_onboarding = True

            if not profile.has_logged_in:
                if should_skip_onboarding:
                    redirect_url = signup_redirect_url
                else:
                    params = urlencode({"next": signup_redirect_url})
                    redirect_url = f"{settings.MITOL_NEW_USER_LOGIN_URL}?{params}"
                    profile.save()

                profile.has_logged_in = True
                profile.save()

        return redirect(redirect_url)
