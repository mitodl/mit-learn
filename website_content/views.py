from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from learning_resources.permissions import is_admin_user
from main.constants import VALID_HTTP_METHODS
from main.utils import cache_page_per_user, clear_views_cache
from website_content.api import content_published_actions, purge_content_on_save
from website_content.models import WebsiteContent
from website_content.permissions import (
    CanEditWebsiteContent,
    CanViewWebsiteContent,
    is_website_content_editor,
)
from website_content.serializers import (
    WebsiteContentImageUploadSerializer,
    WebsiteContentSerializer,
)


@extend_schema_view(
    list=extend_schema(
        summary="List",
        description="Get a paginated list of website content items",
        parameters=[
            OpenApiParameter(
                name="draft",
                type=bool,
                location=OpenApiParameter.QUERY,
                description=(
                    "Filter to show only draft items. Only available for "
                    "admins and content editors. If true, returns unpublished "
                    "items. If not specified, returns all items."
                ),
                required=False,
            ),
            OpenApiParameter(
                name="content_type",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Filter by content type (e.g. 'news' or 'article').",
                required=False,
            ),
        ],
    ),
    retrieve=extend_schema(
        summary="Retrieve", description="Retrieve a single content item"
    ),
    create=extend_schema(summary="Create", description="Create a new content item"),
    destroy=extend_schema(summary="Destroy", description="Delete a content item"),
    partial_update=extend_schema(summary="Update", description="Update a content item"),
)
class WebsiteContentViewSet(viewsets.ModelViewSet):
    """
    Viewset for WebsiteContent viewing and editing.

    Registered under both `api/v1/website_content/` (primary) and
    `api/v1/articles/` (backward-compatible alias).
    """

    serializer_class = WebsiteContentSerializer
    queryset = WebsiteContent.objects.all()
    permission_classes = [CanViewWebsiteContent, CanEditWebsiteContent]
    http_method_names = VALID_HTTP_METHODS

    def get_queryset(self):
        qs = WebsiteContent.objects.all()

        if is_admin_user(self.request) or is_website_content_editor(self.request):
            draft_param = self.request.query_params.get("draft")
            if draft_param and draft_param.lower() in ("true", "1"):
                qs = qs.filter(is_published=False)
        else:
            qs = qs.filter(is_published=True)

        content_type_param = self.request.query_params.get("content_type")
        if content_type_param:
            qs = qs.filter(content_type=content_type_param)

        return qs

    @method_decorator(
        cache_page_per_user(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="website_content",
        )
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        clear_views_cache()
        content = serializer.save(user=self.request.user)
        purge_content_on_save(content)
        content_published_actions(content=content)

    def perform_update(self, serializer):
        clear_views_cache()
        content = serializer.save()
        purge_content_on_save(content)
        content_published_actions(content=content)

    def destroy(self, request, *args, **kwargs):
        clear_views_cache()
        return super().destroy(request, *args, **kwargs)

    @extend_schema(
        summary="Retrieve by ID or slug",
        description="Retrieve a content item by numeric ID or slug",
        parameters=[
            OpenApiParameter(
                name="identifier",
                type=str,
                location=OpenApiParameter.PATH,
                description="Numeric ID or slug of the content item",
            )
        ],
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="detail/(?P<identifier>[^/.]+)",
        url_name="detail-by-id-or-slug",
    )
    def detail_by_id_or_slug(self, _request, identifier):
        qs = self.get_queryset()

        if identifier.isdigit():
            content = get_object_or_404(qs, id=int(identifier))
        else:
            content = get_object_or_404(qs, slug=identifier)

        serializer = self.get_serializer(content)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema_view(
    post=extend_schema(
        request={
            "multipart/form-data": WebsiteContentImageUploadSerializer,
        },
        responses={
            201: OpenApiResponse(
                description="Successful Upload",
                response=(
                    {"type": "object", "properties": {"url": {"type": "string"}}}
                ),
            ),
            400: OpenApiResponse(description="Bad request"),
            401: OpenApiResponse(description="Authentication required"),
        },
        description="Upload an image (multipart/form-data) and return the storage URL.",
        operation_id="media_upload",
        tags=["media"],
    )
)
class MediaUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WebsiteContentImageUploadSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            instance = serializer.save()
            return Response(
                {"url": instance.image_file.url}, status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
