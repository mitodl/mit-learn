"""Authentication views"""

import hashlib
import logging
import secrets
from base64 import urlsafe_b64encode
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
    ACCOUNT_SETTINGS_PATH,
    KEYCLOAK_ACTION_STATUS_PARAM,
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
        if request.user.is_anonymous and request.path != settings.LOGIN_URL:
            # The gateway always requires authentication on LOGIN_URL, but not
            # on every variant of it (the local APISIX config passes /login/
            # through unauthenticated). Send the user through the gateway's
            # login path rather than on to `next` without logging them in.
            # LOGIN_URL itself is excluded because sending an anonymous user
            # there again would only loop back here.
            query = request.GET.urlencode()
            return redirect(
                f"{settings.LOGIN_URL}?{query}" if query else settings.LOGIN_URL
            )

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
                    # Onboarding normally reports the new account; tell the
                    # destination page instead.
                    redirect_url = with_query_params(
                        signup_redirect_url, {"is_new_user": "1"}
                    )
                else:
                    params = urlencode(
                        {"next": signup_redirect_url, "is_new_user": "1"}
                    )
                    redirect_url = f"{settings.MITOL_NEW_USER_LOGIN_URL}?{params}"
                    profile.save()

                send_welcome_email.delay(request.user.id)
                profile.has_logged_in = True
                profile.save()

        return redirect(redirect_url)


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

    It is sent as `redirect_uri` in the authorization request, and Keycloak
    checks it against the client's registered redirect URIs.

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


def build_keycloak_authorize_url(params):
    """
    Build an authorization request to Keycloak for KEYCLOAK_CLIENT_ID.

    Keycloak's pkce-enforcer client policy rejects an authorization request
    without an S256 challenge, so each URL gets a fresh one. Our callers never
    redeem the code, so the verifier isn't kept.
    """
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = (
        urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest())
        .decode()
        .rstrip("=")
    )
    qs = {
        "client_id": settings.KEYCLOAK_CLIENT_ID,
        "response_type": "code",
        **params,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
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

        # The callback never redeems the code (it only reads kc_action_status).
        return build_keycloak_authorize_url(
            {
                "redirect_uri": callback_url,
                "scope": "openid email",
                "kc_action": KEYCLOAK_ACTIONS[action],
            }
        )


class PartnerLoginView(RedirectView):
    """
    Send a partner's learner straight to their institution's login.

    Partners link here instead of to Keycloak's authorize endpoint, so the
    request carries a PKCE challenge and the link stays valid if the Keycloak
    side changes. Keycloak signs the learner in through the IdP named by
    kc_idp_hint, then returns them to the gateway's /login, which starts its
    own login and completes it from the Keycloak session without a prompt.
    The code from this request is never redeemed. An alias Keycloak doesn't
    know shows its normal login page.
    """

    def get_redirect_url(self, *args, **kwargs):  # noqa: ARG002
        """Get the Keycloak authorize URL hinting at the partner's IdP"""
        login_path = reverse("login")
        gateway_login_url = (
            f"{settings.MITOL_API_BASE_URL.removesuffix('/')}{login_path}"
            if settings.MITOL_API_BASE_URL
            else self.request.build_absolute_uri(login_path)
        )

        if not settings.KEYCLOAK_CLIENT_ID:
            log.error(
                "KEYCLOAK_CLIENT_ID is not configured; sending partner login for "
                "%s to the gateway login",
                kwargs["idp_alias"],
            )
            return gateway_login_url

        # organization:* matches the links partners were given, so the session
        # Keycloak starts carries every organization the learner belongs to.
        return build_keycloak_authorize_url(
            {
                "redirect_uri": gateway_login_url,
                "scope": "openid profile email organization:*",
                "kc_idp_hint": kwargs["idp_alias"],
            }
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
