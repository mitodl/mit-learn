"""Authentication views"""

import logging
from urllib.parse import urlparse, urlunparse

from django.conf import settings
from django.contrib.auth import logout
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme, urlencode
from django.views import View
from django.views.generic.base import RedirectView

from authentication.api import is_sso_user
from authentication.constants import (
    ACCOUNT_ACTION_PARAM,
    ACCOUNT_ACTION_STATUS_PARAM,
    KEYCLOAK_ACTION_STATUSES,
    KEYCLOAK_ACTIONS,
    AccountActionStatus,
    parse_account_action,
)
from main.middleware.apisix_user import ApisixUserMiddleware, decode_apisix_headers
from profiles.tasks import send_welcome_email

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

                send_welcome_email.delay(request.user.id)
                profile.has_logged_in = True
                profile.save()

        return redirect(redirect_url)


ACCOUNT_SETTINGS_PATH = "/dashboard/settings"
KEYCLOAK_ACTION_STATUS_PARAM = "kc_action_status"


def get_account_action_redirect_url(request):
    """
    Get the frontend URL to return the user to once an account action finishes.

    Defaults to the dashboard settings page, where the action was started from.
    """
    next_url = request.GET.get("next")
    if next_url and url_has_allowed_host_and_scheme(
        next_url, allowed_hosts=settings.ALLOWED_REDIRECT_HOSTS
    ):
        return next_url

    return f"{settings.APP_BASE_URL.removesuffix('/')}{ACCOUNT_SETTINGS_PATH}"


def with_query_params(url, params):
    """Return url with params merged into its query string"""
    parsed = urlparse(url)
    query = f"{parsed.query}&{urlencode(params)}" if parsed.query else urlencode(params)
    return urlunparse(parsed._replace(query=query))


def build_account_action_callback_url(request, *, next_url, action):
    """
    Build the callback URL Keycloak returns the user to.

    Both legs of the flow must produce a byte-identical string: it is sent as
    `redirect_uri` in the authorization request, and again when exchanging the
    authorization code, where Keycloak requires an exact match.

    Keycloak returns the user to the API domain, which is where APISIX (and so
    the OIDC client's registered redirect URIs) lives.
    """
    callback_path = reverse("account-action-complete")
    base_url = (
        f"{settings.MITOL_API_BASE_URL.removesuffix('/')}{callback_path}"
        if settings.MITOL_API_BASE_URL
        else request.build_absolute_uri(callback_path)
    )
    return with_query_params(base_url, {"next": next_url, ACCOUNT_ACTION_PARAM: action})


class AccountActionStartView(RedirectView):
    """
    Send the user to Keycloak to update their email or password.

    Keycloak calls these "application initiated actions": we start a normal
    authorization code flow with a `kc_action` param, Keycloak walks the user
    through the relevant form, and then returns them to our callback.
    """

    def get_redirect_url(self, *args, **kwargs):  # noqa: ARG002
        """Get the Keycloak URL for the requested action"""
        action = kwargs["action"]
        next_url = get_account_action_redirect_url(self.request)

        if action not in KEYCLOAK_ACTIONS:
            log.error("Received unexpected account action: %s", action)
            return with_query_params(
                next_url,
                {
                    ACCOUNT_ACTION_PARAM: action,
                    ACCOUNT_ACTION_STATUS_PARAM: AccountActionStatus.ERROR,
                },
            )

        if not settings.KEYCLOAK_CLIENT_ID:
            # Nothing to build an authorization request with. Send the user back
            # with an error rather than raising: KEYCLOAK_CLIENT_ID has no
            # default, so an environment that hasn't set it would otherwise
            # 500 on every click.
            log.error(
                "KEYCLOAK_CLIENT_ID is not configured; cannot start account action %s",
                action,
            )
            return with_query_params(
                next_url,
                {
                    ACCOUNT_ACTION_PARAM: action,
                    ACCOUNT_ACTION_STATUS_PARAM: AccountActionStatus.ERROR,
                },
            )

        if self.request.user.is_authenticated and is_sso_user(self.request.user):
            # SSO users have no local Keycloak credentials to change. The UI
            # hides these actions from them, so this is the backstop for a
            # hand-crafted or stale URL.
            return with_query_params(
                next_url,
                {
                    ACCOUNT_ACTION_PARAM: action,
                    ACCOUNT_ACTION_STATUS_PARAM: AccountActionStatus.UNAVAILABLE,
                },
            )

        callback_url = build_account_action_callback_url(
            self.request, next_url=next_url, action=action
        )

        qs = {
            "client_id": settings.KEYCLOAK_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": callback_url,
            # `email` is requested explicitly so the code we exchange on the
            # callback can read the updated address. It is one of Keycloak's
            # default client scopes, but relying on that being true of every
            # environment's client would fail silently and confusingly.
            "scope": "openid email",
            "kc_action": KEYCLOAK_ACTIONS[action],
        }

        return "".join(
            [
                settings.KEYCLOAK_BASE_URL.removesuffix("/"),
                "/realms/",
                settings.KEYCLOAK_REALM_NAME,
                "/protocol/openid-connect/auth?",
                urlencode(qs),
            ]
        )


class AccountActionCompleteView(RedirectView):
    """
    Land the user back on the frontend after a Keycloak account action.

    Keycloak appends `kc_action_status`, which tells us whether the action
    succeeded so the frontend can show an alert. Getting a changed address into
    Learn is Keycloak's job, pushed over SCIM.
    """

    def get_redirect_url(self, *args, **kwargs):  # noqa: ARG002
        """Get the frontend URL, annotated with the outcome of the action"""
        next_url = get_account_action_redirect_url(self.request)
        raw_action = self.request.GET.get(ACCOUNT_ACTION_PARAM)
        keycloak_status = self.request.GET.get(KEYCLOAK_ACTION_STATUS_PARAM)

        action = parse_account_action(raw_action)
        status = KEYCLOAK_ACTION_STATUSES.get(keycloak_status)

        if action is None or status is None:
            # Not something we can report on, so redirect without an alert
            # rather than guess at an outcome.
            log.warning(
                "Account action callback with unusable params: action=%s, %s=%s "
                "(params present: %s)",
                raw_action,
                KEYCLOAK_ACTION_STATUS_PARAM,
                keycloak_status,
                # Names only — these carry authorization codes and addresses.
                ",".join(sorted(self.request.GET.keys())),
            )
            return next_url

        return with_query_params(
            next_url,
            {
                ACCOUNT_ACTION_PARAM: action,
                ACCOUNT_ACTION_STATUS_PARAM: status,
            },
        )
