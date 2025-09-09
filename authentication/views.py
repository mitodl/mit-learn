"""Authentication views"""

import logging
from urllib.parse import urljoin, urlparse

from django.contrib.auth import logout
from django.shortcuts import redirect
from django.utils.http import url_has_allowed_host_and_scheme, urlencode
from django.utils.text import slugify
from django.views import View

from main import settings
from main.constants import B2B_ATTACH_URL_PATTERN
from main.middleware.apisix_user import ApisixUserMiddleware, decode_apisix_headers

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
        redirect_url = get_redirect_url(request)
        if not request.user.is_anonymous:
            profile = request.user.profile

            apisix_header = decode_apisix_headers(request, self.header)

            # Check if user belongs to any organizations
            user_organizations = (
                apisix_header.get("organizations", {}) if apisix_header else {}
            )

            # Check if the next URL is for B2B attach page (should skip onboarding)
            next_path = urlparse(
                request.GET.get("next") or request.COOKIES.get("next")
            ).path
            is_attach_url = next_path and next_path.startswith(B2B_ATTACH_URL_PATTERN)

            if user_organizations:
                # First-time login for org user: redirect to org dashboard
                if not profile.has_logged_in:
                    first_org_name = next(iter(user_organizations.keys()))
                    org_slug = slugify(first_org_name)

                    log.info(
                        "User %s belongs to organization: %s (slug: %s)",
                        request.user.email,
                        first_org_name,
                        org_slug,
                    )

                    redirect_url = urljoin(
                        settings.APP_BASE_URL, f"/dashboard/organization/{org_slug}"
                    )
            elif (
                not profile.has_logged_in
                and request.GET.get("skip_onboarding", "0") == "0"
                and not is_attach_url
            ):
                params = urlencode({"next": redirect_url})
                redirect_url = f"{settings.MITOL_NEW_USER_LOGIN_URL}?{params}"

            if not profile.has_logged_in:
                profile.has_logged_in = True
                profile.save()

        return redirect(redirect_url)
