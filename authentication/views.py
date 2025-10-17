# ruff: noqa: ARG001, F821, E501, TD002, TD003, FIX002, ERA001, SIM115, PTH123, T201, D401
"""Authentication views"""

import logging
from urllib.parse import urljoin

from django.contrib.auth import logout
from django.shortcuts import redirect, render
from django.utils.http import url_has_allowed_host_and_scheme, urlencode
from django.utils.text import slugify
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from lti_consumer.data import Lti1p3LaunchData

from main import settings
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
        next_url = request.GET.get(param_name) or request.COOKIES.get(param_name)
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
        if not request.user.is_anonymous:
            profile = request.user.profile

            apisix_header = decode_apisix_headers(request, self.header)

            # Check if user belongs to any organizations
            user_organizations = (
                apisix_header.get("organizations", {}) if apisix_header else {}
            )

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
            # first-time non-org users
            elif not profile.has_logged_in:
                if request.GET.get("skip_onboarding", "0") == "0":
                    params = urlencode({"next": signup_redirect_url})
                    redirect_url = f"{settings.MITOL_NEW_USER_LOGIN_URL}?{params}"
                    profile.save()
                else:
                    redirect_url = signup_redirect_url

            if not profile.has_logged_in:
                profile.has_logged_in = True
                profile.save()

        return redirect(redirect_url)


# lti_oidc_url = 'localhost:8000/oidc/initiate'
# lti_launch_url = 'localhost:8000/launch'
# client_id = 'learn-jupyter-notebooks'
# deployment_id = '0cb94445-2066-4295-9c03-4bfdc1d8aacb'

lti_oidc_url = "https://saltire.lti.app/tool"
lti_launch_url = "https://saltire.lti.app/tool"
redirect_uris = [lti_launch_url]
client_id = "learn-jupyter-notebooks"
deployment_id = "cb5fd9ae5c92eddbc5054e27fa010c5478d2f7c3"
platform_private_key_id = "JZOHScC4BQ"
platform_public_key = open("platform_id_rsa.pub").read()
platform_private_key = open("platform_id_rsa").read()
print(platform_public_key)
rsa_key = platform_private_key
rsa_key_id = platform_private_key_id
iss = "http://api.open.odl.local"
tool_public_key = None  # PEM tool public key, not required just to launch LTI

"""
# lti1p3platform - the only platform impl I could find packaged. Not well supported, no GH.
# Consider using https://github.com/academic-innovation/django-lti for client, though it's probably not gonna work OOTB
# Below is the OpenEdX impl. It's technically request agnostic, so we could vendor it in and just use pieces we care about
# https://github.com/openedx/xblock-lti-consumer/blob/92ea78f9fee5aa8551511db5f0587d1673e25159/lti_consumer/lti_1p3/README.md?plain=1
Render a view which starts an LTI negotiation
Take a notebook link as the next parameter
At the end of the negotiation, we want to end up on a page that shows our learn logged in user's info at minimum

"""


def lti_login(
    request,
    *args,
    **kwargs,
):
    """
    Render form taking relevant bits of info to start LTI negotiation
    """

    return lti_preflight_request(request)


@csrf_exempt
def lti_auth(
    request,
    *args,
    **kwargs,
):
    """
    Perform LTI negotiation and redirect to notebook URL
    """
    return lti_launch_endpoint(request)


def _get_lti1p3_consumer():
    """
    Returns an configured instance of LTI consumer.
    """
    from lti_consumer.lti_1p3.consumer import LtiConsumer1p3

    return LtiConsumer1p3(
        # Tool urls
        lti_oidc_url=lti_oidc_url,
        lti_launch_url=lti_launch_url,
        redirect_uris=redirect_uris,
        # Platform and deployment configuration
        iss=iss,  # Whatever the host is for the platform?
        client_id=client_id,
        deployment_id=deployment_id,
        # Platform key
        rsa_key=rsa_key,
        rsa_key_id=rsa_key_id,
        # Tool key
        # tool_key=tool_public_key,
    )


def public_keyset(request):
    """
    Return LTI Public Keyset url.

    This endpoint must be configured in the tool.
    """
    return JsonResponse(
        _get_lti1p3_consumer().get_public_keyset(), content_type="application/json"
    )


def lti_preflight_request(request):
    """
    Endpoint that'll render the initial OIDC authorization request form
    and submit it to the tool.

    The platform needs to know the tool OIDC endpoint.
    """
    lti_consumer = _get_lti1p3_consumer()
    # AFAICT, config_id and resource_link_id are pretty much used to get stuff out of cache later
    launch_data = Lti1p3LaunchData(
        # TODO: This doesn't work w/ anonymous users as they don't have a global_id. Shouldn't happen in practice, so just bail
        # user_id=request.user.global_id,
        # user_role="admin" if request.user.is_superuser else "student",
        user_id="test-user-id",
        user_role="staff",
        config_id=client_id,
        resource_link_id="link_id",
    )
    # This template should render a simple redirection to the URL
    # provided by the context through the `oidc_url` key above.
    # This can also be a redirect.
    return redirect(lti_consumer.prepare_preflight_url(launch_data))


def lti_launch_endpoint(request):
    """
    Platform endpoint that'll receive OIDC login request variables and generate launch request.
    """
    lti_consumer = _get_lti1p3_consumer()
    context = {}

    # Required user claim data
    # TODO: For some reason (CORS?) we're dropping our session after the redirect from the OIDC initiation endpoint.
    # This will need to be solved.
    lti_consumer.set_user_data(
        # user_id=request.user.global_id,
        # Pass django user role to library
        # role="admin" if request.user.is_superuser else "student",
        user_id="test-user-id",
        role="staff",
    )
    # TODO: Not sure what this is used for but it's required. Look it up later
    lti_consumer.set_resource_link_claim("link_id")

    context.update(
        {
            "preflight_response": dict(request.POST),
            "launch_request": lti_consumer.generate_launch_request(
                preflight_response=request.POST
            ),
        }
    )

    context.update({"launch_url": lti_consumer.launch_url})
    # This template should render a form, and then submit it to the tool's launch URL, as
    # described in http://www.imsglobal.org/spec/lti/v1p3/#lti-message-general-details
    return render(request, "lti_launch_request_form.html", context)
