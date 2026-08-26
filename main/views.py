"""
Base utility views. Handles errors and feature list views.
"""

from django.http import JsonResponse
import asyncio
from functools import wraps
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from main.constants import PERMISSION_DENIED_ERROR_TYPE
from main.features import get_all_feature_flags, is_enabled
from main.utils import db_sync_to_async


class AsyncAPIView(APIView):
    """
    A DRF APIView whose handlers may be coroutines.

    DRF dispatches synchronously, so an async handler needs both an async
    `dispatch` and a view function Django recognizes as async -- otherwise
    Django runs it in a thread and the coroutine is never awaited.

    Handlers must not touch the ORM directly: wrap sync work (including
    serialization of a queryset) in `db_sync_to_async`. Everything DRF does
    before the handler -- authentication and permissions, which both hit the
    database -- is offloaded the same way.

    This matters under `granian --interface asginl`, which is started with
    `--blocking-threads 1`: a sync view holds one of very few blocking threads
    for its whole duration, so a slow endpoint stalls unrelated traffic. An
    async handler awaiting IO holds none.
    """

    @classmethod
    def as_view(cls, **initkwargs):
        view = super().as_view(**initkwargs)

        @wraps(view)
        async def async_view(*args, **kwargs):
            return await view(*args, **kwargs)

        async_view.view_is_async = True
        return async_view

    async def dispatch(self, request, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        request = self.initialize_request(request, *args, **kwargs)
        self.request = request
        self.headers = self.default_response_headers

        try:
            await db_sync_to_async(self.initial)(request, *args, **kwargs)

            if request.method.lower() in self.http_method_names:
                handler = getattr(
                    self, request.method.lower(), self.http_method_not_allowed
                )
            else:
                handler = self.http_method_not_allowed

            response = handler(request, *args, **kwargs)

            if asyncio.iscoroutine(response):
                response = await response

        except Exception as exc:  # noqa: BLE001
            response = self.handle_exception(exc)

        self.response = self.finalize_response(request, response, *args, **kwargs)
        return self.response

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
