"""Require the `scim` OAuth2 scope on SCIM requests"""

from django.http import HttpResponse
from django.urls import reverse

SCIM_SCOPE = "scim"


class SCIMScopeCheckMiddleware:
    """
    Reject SCIM requests whose OAuth2 access token lacks the `scim` scope.

    django-scim2 only passes `request.user` to its auth predicate, so scope
    can't be checked there. Must come after OAuth2ExtraTokenMiddleware (which
    sets request.access_token) and before SCIMAuthCheckMiddleware.
    """

    def __init__(self, get_response):
        """Store the next handler in the middleware chain"""
        self.get_response = get_response

    def __call__(self, request):
        """Return 401 for SCIM requests without the scim scope"""
        if request.path.startswith(reverse("scim:root")):
            token = getattr(request, "access_token", None)
            if not token or SCIM_SCOPE not in token.scope.split():
                return HttpResponse(status=401)
        return self.get_response(request)
