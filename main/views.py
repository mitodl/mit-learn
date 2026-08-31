"""
Base utility views. Handles errors and feature list views.
"""

from django.http import JsonResponse
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from main.constants import PERMISSION_DENIED_ERROR_TYPE
from main.features import get_all_feature_flags, is_enabled

# Django only calls these when a DRF view has already declined the exception
# (it isn't an APIException Http404, or PermissionDenied DRF recognizes) or
# the error happened outside a DRF view entirely (URL resolution, middleware,
# Django admin, oauth2_provider). By that point DRF's request pipeline
# (content negotiation, versioning, authentication) is irrelevant, so these
# are plain Django handlers rather than `@api_view`-wrapped ones - wrapping
# them in DRF can only reintroduce that pipeline on a request DRF has already
# proven isn't DRF's to handle.


def _error_response(status_code, error_type, detail):
    return JsonResponse(
        {"detail": detail, "error_type": error_type}, status=status_code
    )


def handle_400(request, exception=None):  # noqa: ARG001
    """Render Django's handler400 as JSON."""
    return _error_response(400, "BadRequest", "The request could not be processed.")


def handle_403(request, exception=None):  # noqa: ARG001
    """Render Django's handler403 as JSON."""
    return _error_response(
        403,
        PERMISSION_DENIED_ERROR_TYPE,
        "You do not have permission to perform this action.",
    )


def handle_404(request, exception=None):  # noqa: ARG001
    """Render Django's handler404 as JSON."""
    return _error_response(404, "Http404", "The specified resource was not found.")


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
