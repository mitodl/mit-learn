"""Authentication views"""

import json
import logging
from http import HTTPStatus
from urllib.parse import urlencode as urlencode_qs
from urllib.parse import urlparse, urlunparse

from django.conf import settings
from django.contrib.auth import logout
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.utils.http import url_has_allowed_host_and_scheme, urlencode
from django.views import View
from django.views.decorators.clickjacking import xframe_options_exempt
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
from main.middleware.apisix_user import decode_apisix_headers
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


def _origin(url):
    """Reduce a URL to its scheme://host[:port] origin, for CSP source lists."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


class LogoutCompleteView(View):
    """
    Signal that the cross-application logout fan-out has finished.

    Open edX's logout page navigates itself here once it has framed every
    application in its ``IDA_LOGOUT_URI_LIST``.  This lives on Learn's own
    origin precisely so that the interstitial framing that page can tell it
    happened: a cross-origin frame's location is unreadable, a same-origin one
    is not.  Nothing here needs to render -- the parent only watches where the
    frame ended up.
    """

    @method_decorator(xframe_options_exempt)
    def dispatch(self, request, *args, **kwargs):
        """Allow this to be framed; it is only ever loaded inside one."""
        return super().dispatch(request, *args, **kwargs)

    def get(
        self,
        request,  # noqa: ARG002
        *args,  # noqa: ARG002
        **kwargs,  # noqa: ARG002
    ):
        """Return an empty 204; the parent frame reads the URL, not the body."""
        return HttpResponse(status=HTTPStatus.NO_CONTENT)


class CustomLogoutView(View):
    """
    Log the user out of Learn, and of the applications that share its identity.

    Learn, MITx Online, studio and Open edX each hold a separate APISIX gateway
    session on a separate parent domain, so clearing Learn's cookie leaves the
    others asserting the previous user for as long as their cached access tokens
    last (hq#12763).  Open edX already maintains the list of applications to
    notify (``IDA_LOGOUT_URI_LIST``) and fans a logout out to it by rendering an
    iframe per application, so this hands off to that rather than keeping a
    second copy of the list.

    The gateway hop comes last, because it ends the Keycloak SSO session that the
    siblings' token refreshes depend on.

    Three entry points:

    ``?no_redirect=1``
        Learn is itself one of the applications in that list, so Open edX frames
        this view during a logout started anywhere else.  That branch logs out
        and hands straight to the gateway, with no interstitial -- rendering one
        would frame Open edX's page inside Open edX's own fan-out, recursively.

    Returning from Keycloak
        The gateway's ``post_logout_redirect_uri`` points back at this same view,
        so the return leg has to be distinguishable from a fresh request or the
        two would redirect to each other forever.  It is marked by a short-lived
        cookie set on the way out, which also carries `next` across the hop --
        ``post_logout_redirect_uri`` is fixed configuration and cannot.

    Everything else
        The user clicked "log out" on Learn.  Render the interstitial, which
        frames Open edX's page and then continues to the gateway logout.
    """

    @method_decorator(xframe_options_exempt)
    def dispatch(self, request, *args, **kwargs):
        """Permit Open edX to frame this view as one of its logout targets.

        Django would otherwise send ``X-Frame-Options: DENY`` here, which has no
        way to name an allowed origin, so Open edX's iframe is refused and
        Learn's session is quietly left alone.  The narrower
        ``frame-ancestors`` restriction is applied in place of it below.
        """
        response = super().dispatch(request, *args, **kwargs)
        if settings.OPENEDX_LOGOUT_URL:
            openedx_origin = _origin(settings.OPENEDX_LOGOUT_URL)
            response["Content-Security-Policy"] = (
                f"frame-ancestors 'self' {openedx_origin}"
            )
        return response

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

        returning_from_keycloak = settings.LOGOUT_RETURN_COOKIE_NAME in request.COOKIES
        if returning_from_keycloak:
            # Keycloak has ended the SSO session and sent the browser back here.
            # Everything is torn down; deliver the user to wherever they were
            # headed and drop the marker so a later logout starts clean.
            target = request.COOKIES[settings.LOGOUT_RETURN_COOKIE_NAME]
            if not url_has_allowed_host_and_scheme(
                target, allowed_hosts=settings.ALLOWED_REDIRECT_HOSTS
            ):
                target = "/app"
            response = redirect(target)
            response.delete_cookie(settings.LOGOUT_RETURN_COOKIE_NAME)
            return response

        # Hand off to the gateway even when the request carries no APISIX header.
        # The old behaviour keyed on that header, which meant a lapsed Learn
        # gateway session skipped Keycloak entirely -- leaving the SSO session
        # running, and the siblings refreshing the previous user's tokens against
        # it for the full 14-day session rather than the few minutes an access
        # token lasts.
        if not settings.OIDC_LOGOUT_URL:
            return redirect(get_redirect_url(request, ["next"]))

        framed = request.GET.get("no_redirect") == "1"
        if framed or not settings.OPENEDX_LOGOUT_URL:
            response = redirect(settings.OIDC_LOGOUT_URL)
        else:
            response = render(
                request,
                "authentication/logout_interstitial.html",
                {"logout_config": json.dumps(self._interstitial_config(request))},
            )

        response.set_cookie(
            settings.LOGOUT_RETURN_COOKIE_NAME,
            get_redirect_url(request, ["next"]),
            max_age=settings.LOGOUT_RETURN_COOKIE_TTL,
            secure=request.is_secure(),
            httponly=True,
            samesite="Lax",
        )
        return response

    @staticmethod
    def _interstitial_config(request):
        """Build the values the interstitial's script needs."""
        complete_path = reverse("logout-complete")
        complete_url = request.build_absolute_uri(complete_path)
        query = urlencode_qs({"redirect_url": complete_url})
        return {
            "openedxLogoutUrl": f"{settings.OPENEDX_LOGOUT_URL}?{query}",
            "completePath": complete_path,
            "oidcLogoutUrl": settings.OIDC_LOGOUT_URL,
            "timeoutMs": settings.LOGOUT_INTERSTITIAL_TIMEOUT_MS,
        }


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
