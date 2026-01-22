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
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from articles.api import article_published_actions
from articles.models import Article
from articles.serializers import RichTextArticleSerializer
from learning_resources.permissions import is_admin_user
from main.constants import VALID_HTTP_METHODS
from main.utils import cache_page_for_all_users, clear_views_cache

from .permissions import CanEditArticle, CanViewArticle, is_article_group_user
from .serializers import ArticleImageUploadSerializer

# Create your views here.


class DefaultPagination(LimitOffsetPagination):
    """
    Pagination class for learning_resources viewsets which gets default_limit and max_limit from settings
    """  # noqa: E501

    default_limit = 10
    max_limit = 100


@extend_schema_view(
    list=extend_schema(
        summary="List",
        description="Get a paginated list of articles",
        parameters=[
            OpenApiParameter(
                name="draft",
                type=bool,
                location=OpenApiParameter.QUERY,
                description=(
                    "Filter to show only draft articles. Only available for "
                    "admins and article editors. If true, returns unpublished "
                    "articles. If not specified, returns all articles."
                ),
                required=False,
            )
        ],
    ),
    retrieve=extend_schema(summary="Retrieve", description="Retrieve a single article"),
    create=extend_schema(summary="Create", description="Create a new article"),
    destroy=extend_schema(summary="Destroy", description="Delete an article"),
    partial_update=extend_schema(summary="Update", description="Update an article"),
)
class ArticleViewSet(viewsets.ModelViewSet):
    """
    Viewset for Article viewing and editing.
    """

    serializer_class = RichTextArticleSerializer
    queryset = Article.objects.all()
    pagination_class = DefaultPagination

    permission_classes = [CanViewArticle, CanEditArticle]
    http_method_names = VALID_HTTP_METHODS

    def get_queryset(self):
        qs = Article.objects.all()

        # Admins/staff/learning_path_article_editors group see everything
        if is_admin_user(self.request) or is_article_group_user(self.request):
            # Apply optional draft filter for admins/editors
            draft_param = self.request.query_params.get("draft")
            if draft_param and draft_param.lower() in ("true", "1"):
                # If draft=true, return only unpublished articles
                qs = qs.filter(is_published=False)
            # Otherwise, return all articles (both published and unpublished)
            return qs

        # Normal users only see published articles
        return qs.filter(is_published=True)

    @method_decorator(
        cache_page_for_all_users(
            settings.REDIS_VIEW_CACHE_DURATION, cache="redis", key_prefix="articles"
        )
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        clear_views_cache()
        article = serializer.save(user=self.request.user)
        article_published_actions(article=article)

    def perform_update(self, serializer):
        clear_views_cache()
        article = serializer.save()
        article_published_actions(article=article)

    def destroy(self, request, *args, **kwargs):
        clear_views_cache()
        return super().destroy(request, *args, **kwargs)

    @extend_schema(
        summary="Retrieve article by ID or slug",
        description="If the path parameter is numeric → ID, else → slug.",
        parameters=[
            OpenApiParameter(
                name="identifier",
                type=str,
                location=OpenApiParameter.PATH,
                description="Article ID (number) or slug (string)",
                required=True,
            )
        ],
        responses={200: RichTextArticleSerializer, 404: OpenApiResponse()},
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
            article = get_object_or_404(qs, id=int(identifier))
        else:
            article = get_object_or_404(qs, slug=identifier)

        serializer = self.get_serializer(article)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema_view(
    post=extend_schema(
        # request: multipart/form-data with a binary file field
        request={
            "multipart/form-data": ArticleImageUploadSerializer,
        },
        # response: 201 with JSON containing the URL
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
        serializer = ArticleImageUploadSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        obj = serializer.save()

        file_url = None
        if obj.image_file:
            try:
                file_url = obj.image_file.url
            except (AttributeError, ValueError, OSError):
                file_url = None

        if not file_url:
            # Defensive: if save didn't attach image_file for any reason
            return Response(
                {"error": "Upload failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        if settings.DEBUG:
            file_url = request.build_absolute_uri(file_url)
        return Response({"url": file_url}, status=status.HTTP_201_CREATED)
