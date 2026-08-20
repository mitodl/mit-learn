"""
Base utility views. Handles errors and feature list views.
"""

from django.core.exceptions import BadRequest, PermissionDenied, SuspiciousOperation
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from main.features import get_all_feature_flags, is_enabled


@api_view(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"])
@permission_classes([AllowAny])
def handle_error(
    request,  # noqa: ARG001
    exception=None,
):
    """Render the 400/403/404 handlers as JSON, preserving the real status."""

    # Every method in Django's View.http_method_names has to be spelled out
    # above: api_view() defaults to GET-only, so any POST that raised
    # PermissionDenied or BadRequest was answered `405 Method Not Allowed,
    # Allow: GET, OPTIONS` and the actual reason never reached the caller.
    if isinstance(exception, PermissionDenied):
        status_code = status.HTTP_403_FORBIDDEN
        error_type = "PermissionDenied"
        detail = "You do not have permission to perform this action."
    elif isinstance(exception, BadRequest | SuspiciousOperation):
        status_code = status.HTTP_400_BAD_REQUEST
        error_type = "BadRequest"
        detail = "The request could not be processed."
    else:
        status_code = status.HTTP_404_NOT_FOUND
        error_type = "Http404"
        detail = "The specified resource was not found."

    return Response(
        {"detail": detail, "error_type": error_type},
        status=status_code,
    )


class FeaturesViewSet(ViewSet):
    """
    View for getting the currently available feature flags
    """

    def list(self, request):  # noqa: ARG002
        """
        Return a list of all feature flags.
        """
        return Response(get_all_feature_flags())

    def retrieve(self, request, pk=None):  # noqa: ARG002
        """
        Return a single feature_flag, specified by its ID.
        """
        return Response(is_enabled(pk))
