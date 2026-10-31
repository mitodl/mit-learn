"""Require the `scim` OAuth2 scope on SCIM requests"""

from django.http import HttpResponse
from django.urls import reverse

SCIM_SCOPE = "scim"


class SCIMScopeCheckMiddleware:
    """
    Reject SCIM requests unless the OAuth2 access token is unexpired, has the
    `scim` scope, and belongs to request.user.

    django-scim2 only passes `request.user` to its auth predicate, so scope
    can't be checked there. Must come after OAuth2ExtraTokenMiddleware (which
    sets request.access_token) and before SCIMAuthCheckMiddleware.

    OAuth2ExtraTokenMiddleware doesn't validate the token, and
    OAuth2TokenMiddleware keeps an existing session or APISIX user, so the
    expiry and owner checks stop a logged-in staff user from passing with an
    expired or someone else's `scim` token.
    """

    def __init__(self, get_response):
        """Store the next handler in the middleware chain"""
        self.get_response = get_response

    def __call__(self, request):
        """Return 401 for SCIM requests without a valid scim token"""
        if request.path.startswith(reverse("scim:root")):
            token = getattr(request, "access_token", None)
            user = getattr(request, "user", None)
            if (
                not token
                or not token.is_valid([SCIM_SCOPE])
                or token.user_id is None
                or token.user_id != getattr(user, "pk", None)
            ):
                return HttpResponse(status=401)
        return self.get_response(request)
