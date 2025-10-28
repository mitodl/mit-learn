"""Views for video_shorts"""

from django.conf import settings
from django.utils.decorators import method_decorator
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.pagination import LimitOffsetPagination

from main.permissions import AnonymousAccessReadonlyPermission
from main.utils import cache_page_for_all_users
from video_shorts.models import VideoShort
from video_shorts.serializers import VideoShortSerializer


class VideoShortPagination(LimitOffsetPagination):
    """
    Pagination class for video shorts viewset with a default limit of 12
    """

    default_limit = 12
    max_limit = 100


@extend_schema_view(
    list=extend_schema(
        description="Get a paginated list of video shorts.",
    ),
    retrieve=extend_schema(
        description="Retrieve a single video short.",
    ),
)
class VideoShortViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for video shorts
    """

    resource_type_name_plural = "Video Shorts"
    serializer_class = VideoShortSerializer
    permission_classes = (AnonymousAccessReadonlyPermission,)
    pagination_class = VideoShortPagination
    queryset = VideoShort.objects.all().order_by("-published_at")

    @method_decorator(
        cache_page_for_all_users(
            settings.SEARCH_PAGE_CACHE_DURATION, cache="redis", key_prefix="search"
        )
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
