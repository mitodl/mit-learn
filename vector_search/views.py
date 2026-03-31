import logging
from itertools import chain

from asgiref.sync import sync_to_async
from django.conf import settings
from django.utils.decorators import method_decorator
from drf_spectacular.utils import extend_schema, extend_schema_view
from qdrant_client.http.exceptions import UnexpectedResponse
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.decorators import blocked_ip_exempt
from learning_resources.constants import GROUP_CONTENT_FILE_CONTENT_VIEWERS
from main.utils import cache_page_for_anonymous_users
from vector_search.constants import CONTENT_FILES_COLLECTION_NAME
from vector_search.serializers import (
    ContentFileVectorSearchRequestSerializer,
    ContentFileVectorSearchResponseSerializer,
    LearningResourcesVectorSearchRequestSerializer,
    LearningResourcesVectorSearchResponseSerializer,
)
from vector_search.utils import async_vector_search

log = logging.getLogger(__name__)


class QdrantView(APIView):
    """
    Parent class for views that execute ES searches
    """

    @classmethod
    def as_view(cls, **initkwargs):
        view = super().as_view(**initkwargs)

        from functools import wraps

        @wraps(view)
        async def async_view(*args, **kwargs):
            return await view(*args, **kwargs)

        async_view.view_is_async = True
        return async_view

    async def dispatch(self, request, *args, **kwargs):
        from asgiref.sync import sync_to_async

        self.args = args
        self.kwargs = kwargs
        request = self.initialize_request(request, *args, **kwargs)
        self.request = request
        self.headers = self.default_response_headers

        try:
            await sync_to_async(self.initial)(request, *args, **kwargs)

            if request.method.lower() in self.http_method_names:
                handler = getattr(
                    self, request.method.lower(), self.http_method_not_allowed
                )
            else:
                handler = self.http_method_not_allowed

            response = handler(request, *args, **kwargs)
            import asyncio

            if asyncio.iscoroutine(response):
                response = await response

        except Exception as exc:  # noqa: BLE001
            response = self.handle_exception(exc)

        self.response = self.finalize_response(request, response, *args, **kwargs)
        return self.response

    def handle_exception(self, exc):
        if isinstance(exc, UnexpectedResponse) and (
            isinstance(exc.status_code, int) and 400 <= exc.status_code < 500  # noqa: PLR2004
        ):
            log.exception("Received a 4xx error from Qdrant")
            return Response(status=exc.status_code)
        raise exc


@method_decorator(blocked_ip_exempt, name="dispatch")
@extend_schema_view(
    get=extend_schema(
        parameters=[LearningResourcesVectorSearchRequestSerializer()],
        responses=LearningResourcesVectorSearchResponseSerializer(),
    ),
)
@action(methods=["GET"], detail=False, name="Search Learning Resources")
class LearningResourcesVectorSearchView(QdrantView):
    """
    Vector Search for learning resources
    """

    permission_classes = ()

    @method_decorator(
        cache_page_for_anonymous_users(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="vector_search",
        )
    )
    @extend_schema(summary="Vector Search")
    async def get(self, request):
        request_data = LearningResourcesVectorSearchRequestSerializer(data=request.GET)

        if request_data.is_valid():
            query_text = request_data.data.get("q", "")
            hybrid_search = request_data.data.get("hybrid_search", False)
            limit = request_data.data.get("limit", 10)
            offset = request_data.data.get("offset", 0)
            response = await async_vector_search(
                query_text,
                limit=limit,
                offset=offset,
                params=request_data.data,
                hybrid_search=hybrid_search,
            )
            if request_data.data.get("dev_mode"):
                return Response(response)
            else:

                def serialize():
                    return LearningResourcesVectorSearchResponseSerializer(
                        response, context={"request": request}
                    ).data

                response_data = await sync_to_async(serialize)()
                response_data["results"] = list(response_data["results"])
                return Response(response_data)
        else:
            errors = {}
            for key, errors_obj in request_data.errors.items():
                if isinstance(errors_obj, list):
                    errors[key] = errors_obj
                else:
                    errors[key] = list(set(chain(*errors_obj.values())))
            return Response(errors, status=400)


@method_decorator(blocked_ip_exempt, name="dispatch")
@extend_schema_view(
    get=extend_schema(
        parameters=[ContentFileVectorSearchRequestSerializer()],
        responses=ContentFileVectorSearchResponseSerializer(),
    ),
)
@action(methods=["GET"], detail=False, name="Search Content Files")
class ContentFilesVectorSearchView(QdrantView):
    """
    Vector Search for content
    """

    class IsAdminOrContentFileContentViewer(BasePermission):
        def has_permission(self, request, view):  # noqa: ARG002
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if user.is_staff or user.is_superuser:
                return True
            return user.groups.filter(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS).exists()

    permission_classes = (IsAdminOrContentFileContentViewer,)

    @method_decorator(
        cache_page_for_anonymous_users(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="vector_search",
        )
    )
    @extend_schema(summary="Content File Vector Search")
    async def get(self, request):
        request_data = ContentFileVectorSearchRequestSerializer(data=request.GET)

        if request_data.is_valid():
            query_text = request_data.data.get("q", "")
            hybrid_search = request_data.data.get("hybrid_search", False)
            limit = request_data.data.get("limit", 10)
            offset = request_data.data.get("offset", 0)
            collection_name_override = request_data.data.get("collection_name")
            collection_name = CONTENT_FILES_COLLECTION_NAME
            if collection_name_override:
                collection_name = (
                    f"{settings.QDRANT_BASE_COLLECTION_NAME}.{collection_name_override}"
                )

            response = await async_vector_search(
                query_text,
                limit=limit,
                offset=offset,
                params=request_data.data,
                search_collection=collection_name,
                hybrid_search=hybrid_search,
            )
            if request_data.data.get("dev_mode"):
                return Response(response)
            else:
                from asgiref.sync import sync_to_async

                def serialize():
                    return ContentFileVectorSearchResponseSerializer(
                        response, context={"request": request}
                    ).data

                response_data = await sync_to_async(serialize)()
                response_data["results"] = list(response_data["results"])
                return Response(response_data)
        else:
            errors = {}
            for key, errors_obj in request_data.errors.items():
                if isinstance(errors_obj, list):
                    errors[key] = errors_obj
                else:
                    errors[key] = list(set(chain(*errors_obj.values())))
            return Response(errors, status=400)
