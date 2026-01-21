"""Views for news_events"""

from django.conf import settings
from django.db.models import Q
from django.utils.decorators import method_decorator
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.pagination import LimitOffsetPagination

from main.features import Features, is_enabled
from main.filters import MultipleOptionsFilterBackend
from main.permissions import AnonymousAccessReadonlyPermission
from main.utils import cache_page_for_all_users, now_in_utc
from news_events.constants import FeedType
from news_events.etl.articles_news import LEARN_ARTICLES_URL
from news_events.filters import FeedItemFilter, FeedSourceFilter
from news_events.models import FeedItem, FeedSource
from news_events.serializers import FeedItemSerializer, FeedSourceSerializer


class DefaultPagination(LimitOffsetPagination):
    """
    Pagination class for news/events viewsets which gets
    default_limit and max_limit from settings
    """

    default_limit = 10
    max_limit = 100


@extend_schema_view(
    list=extend_schema(
        description="Get a paginated list of feed items.",
    ),
    retrieve=extend_schema(
        description="Retrieve a single feed item.",
    ),
)
class FeedItemViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Viewset for news and events
    """

    resource_type_name_plural = "News and Events"
    serializer_class = FeedItemSerializer
    permission_classes = (AnonymousAccessReadonlyPermission,)
    pagination_class = DefaultPagination
    filter_backends = [MultipleOptionsFilterBackend]
    filterset_class = FeedItemFilter

    def get_queryset(self):
        """Get the queryset, filtering out articles if the feature flag is disabled."""
        queryset = FeedItem.objects.select_related(*FeedItem.related_selects).filter(
            Q(source__feed_type=FeedType.news.name)
            | Q(event_details__event_datetime__gte=now_in_utc())
        )

        # Exclude articles feed items if the feature flag is disabled
        if not is_enabled(
            Features.article_viewer,
            opt_unique_id=str(self.request.user.id),
        ):
            queryset = queryset.exclude(source__url=LEARN_ARTICLES_URL)

        return queryset.order_by(
            "-news_details__publish_date",
            "-event_details__event_datetime",
        )

    @method_decorator(
        cache_page_for_all_users(
            settings.REDIS_VIEW_CACHE_DURATION, cache="redis", key_prefix="news_events"
        )
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


@extend_schema_view(
    list=extend_schema(
        description="Get a paginated list of news/event feed sources.",
    ),
    retrieve=extend_schema(
        description="Retrieve a single news/event feed source.",
    ),
)
class FeedSourceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Viewset for news and event sources
    """

    permission_classes = (AnonymousAccessReadonlyPermission,)
    pagination_class = DefaultPagination
    resource_type_name_plural = "News & Events Sources"
    serializer_class = FeedSourceSerializer
    filter_backends = [MultipleOptionsFilterBackend]
    filterset_class = FeedSourceFilter
    queryset = FeedSource.objects.all().order_by("id")

    @method_decorator(
        cache_page_for_all_users(
            settings.REDIS_VIEW_CACHE_DURATION, cache="redis", key_prefix="news_events"
        )
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
