import logging
from itertools import chain

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
from vector_search.utils import vector_search

log = logging.getLogger(__name__)


class QdrantView(APIView):
    """
    Parent class for views that execute ES searches
    """

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
            settings.SEARCH_PAGE_CACHE_DURATION, cache="redis", key_prefix="search"
        )
    )
    @extend_schema(summary="Vector Search")
    def get(self, request):
        request_data = LearningResourcesVectorSearchRequestSerializer(data=request.GET)

        if request_data.is_valid():
            query_text = request_data.data.get("q", "")
            limit = request_data.data.get("limit", 10)
            offset = request_data.data.get("offset", 0)
            response = vector_search(
                query_text, limit=limit, offset=offset, params=request_data.data
            )
            if request_data.data.get("dev_mode"):
                return Response(response)
            else:
                response = LearningResourcesVectorSearchResponseSerializer(
                    response, context={"request": request}
                ).data
                response["results"] = list(response["results"])
                return Response(response)
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
            settings.SEARCH_PAGE_CACHE_DURATION, cache="redis", key_prefix="search"
        )
    )
    @extend_schema(summary="Content File Vector Search")
    def get(self, request):
        request_data = ContentFileVectorSearchRequestSerializer(data=request.GET)

        if request_data.is_valid():
            query_text = request_data.data.get("q", "")
            limit = request_data.data.get("limit", 10)
            offset = request_data.data.get("offset", 0)
            collection_name_override = request_data.data.get("collection_name")
            collection_name = CONTENT_FILES_COLLECTION_NAME
            if collection_name_override:
                collection_name = (
                    f"{settings.QDRANT_BASE_COLLECTION_NAME}.{collection_name_override}"
                )

            response = vector_search(
                query_text,
                limit=limit,
                offset=offset,
                params=request_data.data,
                search_collection=collection_name,
            )
            if request_data.data.get("dev_mode"):
                return Response(response)
            else:
                response = ContentFileVectorSearchResponseSerializer(
                    response, context={"request": request}
                ).data

                response["results"] = list(response["results"])
                return Response(response)
        else:
            errors = {}
            for key, errors_obj in request_data.errors.items():
                if isinstance(errors_obj, list):
                    errors[key] = errors_obj
                else:
                    errors[key] = list(set(chain(*errors_obj.values())))
            return Response(errors, status=400)
