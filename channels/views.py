"""Views for channels"""

import logging
from collections.abc import Callable

from django.db.models import QuerySet
from django.utils.decorators import method_decorator
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, viewsets
from rest_framework.generics import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response

from channels.constants import ChannelType
from channels.models import Channel
from channels.serializers import (
    ChannelCountsSerializer,
    ChannelSerializer,
)
from main.permissions import AnonymousAccessReadonlyPermission
from main.utils import cache_page_for_all_users

log = logging.getLogger(__name__)


def cache_channel_response() -> Callable:
    """Cache shared channel payloads."""
    return cache_page_for_all_users(
        cache="redis",
        key_prefix="channels",
    )


def extend_schema_responses(serializer):
    """
    Specify a serializer for all view **responses** when generating OpenAPI schema
    via drf-spectacular. The request schema will be inferred as usual.
    """

    def decorate(view):
        extend_schema_view(
            list=extend_schema(responses={200: serializer}),
            retrieve=extend_schema(responses={200: serializer}),
        )(view)
        return view

    return decorate


@extend_schema_responses(ChannelSerializer)
@extend_schema_view(
    list=extend_schema(summary="List"),
    retrieve=extend_schema(summary="Retrieve"),
)
class ChannelViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only operations for channels.

    Channels may represent groups or organizations at MIT and are a high-level
    categorization of content.
    """

    permission_classes = (AnonymousAccessReadonlyPermission,)
    serializer_class = ChannelSerializer
    http_method_names = ["get", "head", "options"]
    lookup_field = "id"
    lookup_url_kwarg = "id"
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["channel_type"]

    def get_queryset(self) -> QuerySet[Channel]:
        """Return a queryset"""
        return Channel.objects.filter(published=True).with_detail_relations()

    @method_decorator(cache_channel_response())
    def list(self, request: Request, *args, **kwargs) -> Response:
        """
        List published channels.
        """
        return super().list(request, *args, **kwargs)

    @method_decorator(cache_channel_response())
    def retrieve(self, request: Request, *args, **kwargs) -> Response:
        """Retrieve a single channel by id."""
        return super().retrieve(request, *args, **kwargs)


@extend_schema_view(
    retrieve=extend_schema(summary="Channel Detail Lookup by channel type and name"),
)
class ChannelByTypeNameDetailView(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    View for retrieving an individual channel by type and name
    """

    serializer_class = ChannelSerializer
    permission_classes = (AnonymousAccessReadonlyPermission,)

    def get_queryset(self) -> QuerySet[Channel]:
        """Return a queryset"""
        return Channel.objects.filter(published=True).with_detail_relations()

    def get_object(self) -> Channel:
        """
        Return the channel by type and name
        """
        return get_object_or_404(
            self.get_queryset(),
            channel_type=self.kwargs["channel_type"],
            name=self.kwargs["name"],
        )

    @method_decorator(cache_channel_response())
    def retrieve(self, request: Request, *args, **kwargs) -> Response:
        """View for retrieving an individual channel by type and name"""
        return super().retrieve(request, *args, **kwargs)


@extend_schema_view(
    list=extend_schema(summary="Channel Counts by channel type"),
)
class ChannelCountsView(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    View for retrieving channel resource counts by channel type
    """

    serializer_class = ChannelCountsSerializer
    permission_classes = (AnonymousAccessReadonlyPermission,)
    pagination_class = None

    def get_queryset(self) -> QuerySet[Channel]:
        """Channels of the given type, joined to the relation get_counts walks."""
        channel_type = self.kwargs["channel_type"]
        # Each request is scoped to a single channel_type, so only that type's
        # detail relation needs joining (pathway channels have nothing to count).
        detail_relation = {
            ChannelType.topic.name: "topic_detail__topic",
            ChannelType.department.name: "department_detail__department",
            ChannelType.unit.name: "unit_detail__unit",
        }.get(channel_type)
        queryset = Channel.objects.filter(
            channel_type=channel_type,
            published=True,
        )
        if detail_relation:
            queryset = queryset.select_related(detail_relation)
        return queryset

    @method_decorator(cache_channel_response())
    def list(self, request: Request, *args, **kwargs) -> Response:
        """List channel counts by resource type."""
        return super().list(request, *args, **kwargs)
