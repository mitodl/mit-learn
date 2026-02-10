"""Views for learning_resources"""

import logging
from hmac import compare_digest

import rapidjson
from django.conf import settings
from django.db import transaction
from django.db.models import Count, F, Prefetch, Q, QuerySet
from django.http import Http404, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from grpc._channel import _InactiveRpcError
from rest_framework import serializers, views, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.generics import get_object_or_404
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_nested.viewsets import NestedViewSetMixin

from authentication.decorators import blocked_ip_exempt
from channels.constants import ChannelType
from channels.models import Channel
from learning_resources import permissions
from learning_resources.constants import (
    GROUP_CONTENT_FILE_CONTENT_VIEWERS,
    LearningResourceRelationTypes,
    LearningResourceType,
    PlatformType,
    PrivacyLevel,
)
from learning_resources.etl.podcast import generate_aggregate_podcast_rss
from learning_resources.exceptions import WebhookException
from learning_resources.filters import (
    ContentFileFilter,
    LearningResourceFilter,
    TopicFilter,
)
from learning_resources.models import (
    ContentFile,
    LearningResource,
    LearningResourceContentTag,
    LearningResourceDepartment,
    LearningResourceOfferor,
    LearningResourcePlatform,
    LearningResourceRelationship,
    LearningResourceRun,
    LearningResourceSchool,
    LearningResourceTopic,
    TutorProblemFile,
    UserList,
    UserListRelationship,
)
from learning_resources.permissions import (
    HasLearningPathPermissions,
    HasUserListItemPermissions,
    HasUserListPermissions,
    is_learning_path_editor,
)
from learning_resources.serializers import (
    ContentFileSerializer,
    CourseResourceSerializer,
    LearningPathRelationshipSerializer,
    LearningPathResourceSerializer,
    LearningResourceContentTagSerializer,
    LearningResourceDepartmentSerializer,
    LearningResourceDisplayInfoResponseSerializer,
    LearningResourceOfferorDetailSerializer,
    LearningResourcePlatformSerializer,
    LearningResourceRelationshipSerializer,
    LearningResourceSchoolSerializer,
    LearningResourceSerializer,
    LearningResourceSummarySerializer,
    LearningResourceTopicSerializer,
    MicroLearningPathRelationshipSerializer,
    MicroUserListRelationshipSerializer,
    PodcastEpisodeResourceSerializer,
    PodcastResourceSerializer,
    ProgramResourceSerializer,
    SetLearningPathsRequestSerializer,
    SetUserListsRequestSerializer,
    UserListRelationshipSerializer,
    UserListSerializer,
    VideoPlaylistResourceSerializer,
    VideoResourceSerializer,
)
from learning_resources.tasks import get_ocw_courses
from learning_resources.utils import (
    resource_unpublished_actions,
)
from learning_resources_search.api import get_similar_resources
from learning_resources_search.serializers import (
    serialize_learning_resource_for_update,
)
from main.constants import VALID_HTTP_METHODS
from main.filters import MultipleOptionsFilterBackend
from main.permissions import (
    AnonymousAccessReadonlyPermission,
    is_admin_user,
)
from main.utils import cache_page_for_all_users, cache_page_for_anonymous_users, chunks


def show_content_file_content(user):
    """
    Check if the user is allowed to view content file content
    """
    return (
        user
        and user.is_authenticated
        and (
            user.is_superuser
            or user.is_staff
            or user.groups.filter(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS).first()
            is not None
        )
    )


log = logging.getLogger(__name__)


class DefaultPagination(LimitOffsetPagination):
    """
    Pagination class for learning_resources viewsets which gets default_limit and max_limit from settings
    """  # noqa: E501

    default_limit = 10
    max_limit = 100


class LargePagination(DefaultPagination):
    """Large pagination for small resources, e.g., topics."""

    default_limit = 1000
    max_limit = 1000


@extend_schema_view(
    list=extend_schema(
        summary="List",
        description="Get a paginated list of learning resources.",
    ),
    retrieve=extend_schema(
        summary="Retrieve",
        description="Retrieve a single learning resource.",
    ),
)
class BaseLearningResourceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Viewset for LearningResources
    """

    permission_classes = (AnonymousAccessReadonlyPermission,)
    pagination_class = DefaultPagination
    filter_backends = [MultipleOptionsFilterBackend]
    filterset_class = LearningResourceFilter
    lookup_field = "id"

    def _get_base_queryset(self, resource_type: str | None = None) -> QuerySet:
        """
        Return learning resources based on query parameters

        Args:
            resource_type (str): Resource type to filter by (default is None)

        Returns:
            QuerySet of LearningResource objects matching the query parameters
        """
        # Valid fields to filter by, just resource_type for now
        lr_query = LearningResource.objects.for_serialization()
        if resource_type:
            lr_query = lr_query.filter(resource_type=resource_type)
        return lr_query.distinct()

    def get_queryset(self) -> QuerySet:
        """
        Generate a QuerySet for fetching valid learning resources

        Returns:
            QuerySet of LearningResource objects
        """
        return self._get_base_queryset().filter(published=True)

    @method_decorator(
        cache_page_for_anonymous_users(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="learning_resources",
        )
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


@extend_schema_view(
    list=extend_schema(
        description="Get a paginated list of learning resources.",
    ),
    retrieve=extend_schema(
        description="Retrieve a single learning resource.",
    ),
)
class LearningResourceViewSet(
    BaseLearningResourceViewSet,
):
    """
    Viewset for LearningResources
    """

    resource_type_name_plural = "Learning Resources"
    serializer_class = LearningResourceSerializer

    @extend_schema(
        summary="Get similar resources",
        parameters=[
            OpenApiParameter(name="id", type=int, location=OpenApiParameter.PATH),
            OpenApiParameter(name="limit", type=int, location=OpenApiParameter.QUERY),
        ],
        responses=LearningResourceSerializer(many=True),
    )
    @action(
        detail=True,
        methods=["GET"],
        name="Fetch similar learning resources for a resource by id",
        pagination_class=None,
    )
    @method_decorator(
        cache_page_for_all_users(
            settings.REDIS_VIEW_CACHE_DURATION, cache="redis", key_prefix="similar"
        )
    )
    def similar(self, request, *_, **kwargs):
        """
        Fetch similar learning resources

        Args:
        id (integer): The id of the learning resource

        Returns:
        QuerySet of similar LearningResource for the resource matching the id parameter
        """
        limit = int(request.GET.get("limit", 12))
        pk = int(kwargs.get("id"))
        learning_resource = get_object_or_404(LearningResource, id=pk)
        learning_resource = LearningResource.objects.for_search_serialization().get(
            id=pk
        )
        resource_data = serialize_learning_resource_for_update(learning_resource)
        similar = get_similar_resources(
            resource_data, limit, 2, 3, use_embeddings=False
        )
        return Response(LearningResourceSerializer(list(similar), many=True).data)

    @extend_schema(
        summary="Get similar resources using vector embeddings",
        parameters=[
            OpenApiParameter(name="id", type=int, location=OpenApiParameter.PATH),
            OpenApiParameter(name="limit", type=int, location=OpenApiParameter.QUERY),
        ],
        responses=LearningResourceSerializer(many=True),
    )
    @action(
        detail=True,
        methods=["GET"],
        name="Fetch similar resources using embeddings for a resource",
        pagination_class=None,
    )
    @method_decorator(
        cache_page_for_all_users(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="vector_similar",
        )
    )
    def vector_similar(self, request, *_, **kwargs):
        """
        Fetch similar learning resources

        Args:
        id (integer): The id of the learning resource

        Returns:
        QuerySet of similar LearningResource for the resource matching the id parameter
        """
        limit = int(request.GET.get("limit", 12))
        pk = int(kwargs.get("id"))

        try:
            learning_resource = LearningResource.objects.for_search_serialization().get(
                id=pk
            )
        except LearningResource.DoesNotExist as dne:
            msg = f"No LearningResource matches the given id {pk}."
            raise Http404(msg) from dne
        resource_data = serialize_learning_resource_for_update(learning_resource)
        try:
            similar = get_similar_resources(
                resource_data, limit, 2, 3, use_embeddings=True
            )
            return Response(LearningResourceSerializer(list(similar), many=True).data)
        except _InactiveRpcError as ircp:
            msg = f"Similar resources RPC error for resource {pk}: {ircp.details()}"
            log.warning(msg)
            raise Http404(msg) from ircp

    @extend_schema(
        summary="Get learning resources summary",
        description="Get a paginated list of learning resources with summary fields",
        responses=LearningResourceSummarySerializer(many=True),
    )
    @action(
        detail=False,
        methods=["GET"],
        name="Get learning resources summary",
        pagination_class=LargePagination,
    )
    def summary(self, request, **kwargs):  # noqa: ARG002
        """
        Get learning resources summary data.

        Returns:
            Paginated list of learning resources with summary fields only.
            Intended to be performant with large page sizes.
        """
        queryset = self.filter_queryset(
            self.get_queryset().values("id", "last_modified")
        )
        page = self.paginate_queryset(queryset)

        serializer = LearningResourceSummarySerializer(page, many=True)
        return self.get_paginated_response(serializer.data)


@extend_schema_view(
    list=extend_schema(
        description="Get a paginated list of courses",
    ),
    retrieve=extend_schema(
        description="Retrieve a single course",
    ),
)
class CourseViewSet(
    BaseLearningResourceViewSet,
):
    """
    Viewset for Courses
    """

    lookup_url_kwarg = "id"
    resource_type_name_plural = "Courses"
    serializer_class = CourseResourceSerializer

    def get_queryset(self) -> QuerySet:
        """
        Generate a QuerySet for fetching valid Course objects

        Returns:
            QuerySet of LearningResource objects that are Courses
        """
        return self._get_base_queryset(
            resource_type=LearningResourceType.course.name
        ).filter(published=True)


@extend_schema_view(
    list=extend_schema(
        description="Get a paginated list of programs",
    ),
    retrieve=extend_schema(
        description="Retrieve a single program",
    ),
)
class ProgramViewSet(
    BaseLearningResourceViewSet,
):
    """
    Viewset for Programs
    """

    resource_type_name_plural = "Programs"

    serializer_class = ProgramResourceSerializer

    def get_queryset(self):
        """
        Generate a QuerySet for fetching valid Programs

        Returns:
            QuerySet of LearningResource objects that are Programs
        """
        return self._get_base_queryset(
            resource_type=LearningResourceType.program.name
        ).filter(published=True)


@extend_schema_view(
    list=extend_schema(
        description="Get a paginated list of podcasts",
    ),
    retrieve=extend_schema(
        description="Retrieve a single podcast",
    ),
)
class PodcastViewSet(BaseLearningResourceViewSet):
    """
    Viewset for Podcasts
    """

    serializer_class = PodcastResourceSerializer

    def get_queryset(self):
        """
        Generate a QuerySet for fetching valid Programs

        Returns:
            QuerySet of LearningResource objects that are Programs
        """
        return self._get_base_queryset(
            resource_type=LearningResourceType.podcast.name
        ).filter(published=True)


@extend_schema_view(
    list=extend_schema(
        description="Get a paginated list of podcast episodes",
    ),
    retrieve=extend_schema(
        description="Retrieve a single podcast episode",
    ),
)
class PodcastEpisodeViewSet(BaseLearningResourceViewSet):
    """
    Viewset for Podcast Episodes
    """

    serializer_class = PodcastEpisodeResourceSerializer

    def get_queryset(self):
        """
        Generate a QuerySet for fetching valid Programs

        Returns:
            QuerySet of LearningResource objects that are Programs
        """
        return self._get_base_queryset(
            resource_type=LearningResourceType.podcast_episode.name
        ).filter(published=True)


@extend_schema_view(
    list=extend_schema(
        summary="List", description="Get a paginated list of learning paths"
    ),
    retrieve=extend_schema(
        summary="Retrieve", description="Retrive a single learning path"
    ),
    create=extend_schema(summary="Create", description="Create a learning path"),
    destroy=extend_schema(summary="Destroy", description="Remove a learning path"),
    partial_update=extend_schema(
        summary="Update",
        description="Update individual fields of a learning path",
    ),
)
class LearningPathViewSet(BaseLearningResourceViewSet, viewsets.ModelViewSet):
    """
    Viewset for LearningPaths
    """

    serializer_class = LearningPathResourceSerializer
    permission_classes = (permissions.HasLearningPathPermissions,)
    http_method_names = VALID_HTTP_METHODS
    lookup_url_kwarg = "id"

    def get_queryset(self):
        """
        Generate a QuerySet for fetching valid Programs

        Returns:
            QuerySet of LearningResource objects that are Programs
        """
        queryset = self._get_base_queryset(
            resource_type=LearningResourceType.learning_path.name,
        )
        if not (is_learning_path_editor(self.request) or is_admin_user(self.request)):
            queryset = queryset.filter(published=True)
        return queryset


@extend_schema_view(
    list=extend_schema(
        summary="List", description="Get a list of all learning path items"
    ),
)
class LearningPathMembershipViewSet(viewsets.ReadOnlyModelViewSet):
    """Viewset for listing all learning path relationships"""

    serializer_class = MicroLearningPathRelationshipSerializer
    permission_classes = (permissions.HasLearningPathMembershipPermissions,)
    http_method_names = ["get"]

    def get_queryset(self):
        """
        Generate a QuerySet for fetching all LearningResourceRelationships
        with a parent of resource type "learning_path"

        Returns:
            QuerySet of LearningResourceRelationships objects with learning path parents
        """
        return LearningResourceRelationship.objects.filter(
            child__published=True,
            parent__resource_type=LearningResourceType.learning_path.name,
        ).order_by("child", "parent")


@extend_schema_view(
    list=extend_schema(
        summary="Nested Learning Resource List",
        description="Get a list of related learning resources for a learning resource.",
    ),
    retrieve=extend_schema(
        summary="Nested Learning Resource Retrieve",
        description="Get a singe related learning resource for a learning resource.",
    ),
)
@extend_schema(
    parameters=[
        OpenApiParameter(
            name="learning_resource_id",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.PATH,
            description="id of the parent learning resource",
        )
    ]
)
class ResourceListItemsViewSet(NestedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """
    Viewset for nested learning resources.

    """

    parent_lookup_kwargs = {"learning_resource_id": "parent_id"}
    permission_classes = (AnonymousAccessReadonlyPermission,)
    serializer_class = LearningResourceRelationshipSerializer
    pagination_class = DefaultPagination
    queryset = (
        LearningResourceRelationship.objects.select_related("child")
        .prefetch_related(
            Prefetch(
                "child__topics",
                queryset=LearningResourceTopic.objects.for_serialization(),
            ),
            Prefetch(
                "child__offered_by",
                queryset=LearningResourceOfferor.objects.for_serialization(),
            ),
            Prefetch(
                "child__departments",
                queryset=LearningResourceDepartment.objects.for_serialization(
                    prefetch_school=True
                ).select_related("school"),
            ),
            Prefetch(
                "child__runs",
                queryset=LearningResourceRun.objects.filter(published=True)
                .order_by("start_date", "enrollment_start", "id")
                .for_serialization(),
            ),
            "child__runs__instructors",
            "child__runs__resource_prices",
            "child__topics",
        )
        .filter(child__published=True)
    )
    filter_backends = [OrderingFilter]
    ordering = ["position", "-child__last_modified"]


@extend_schema(
    parameters=[
        OpenApiParameter(
            name="id",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.PATH,
            description="id of the learning resource",
        ),
    ],
)
class LearningResourceListRelationshipViewSet(viewsets.GenericViewSet):
    """
    Viewset for managing relationships between Learning Resources
    and User Lists / Learning Paths
    """

    permission_classes = (AnonymousAccessReadonlyPermission,)
    filter_backends = [MultipleOptionsFilterBackend]
    queryset = LearningResourceRelationship.objects.select_related("parent", "child")
    http_method_names = ["patch"]

    def get_serializer_class(self):
        if self.action == "userlists":
            return UserListRelationshipSerializer
        elif self.action == "learning_paths":
            return LearningResourceRelationshipSerializer
        return super().get_serializer_class()

    @extend_schema(
        summary="Set User List Relationships",
        description="Set User List Relationships on a given Learning Resource.",
        parameters=[
            OpenApiParameter(
                name="userlist_id",
                type=OpenApiTypes.INT,
                many=True,
                location=OpenApiParameter.QUERY,
                description="id of the parent user list",
            ),
        ],
        responses={200: UserListRelationshipSerializer(many=True)},
    )
    @action(detail=True, methods=["patch"], name="Set User List Relationships")
    def userlists(self, request, *args, **kwargs):  # noqa: ARG002
        """
        Set User List relationships for a given Learning Resource
        """
        req_data = SetUserListsRequestSerializer().to_internal_value(
            {
                "userlist_ids": request.query_params.getlist("userlist_id"),
                "learning_resource_id": kwargs.get("pk"),
            }
        )
        learning_resource_id = req_data["learning_resource_id"]
        userlist_ids = req_data["userlist_ids"]
        if (
            UserList.objects.filter(pk__in=userlist_ids)
            .exclude(author=request.user)
            .exists()
        ):
            msg = "User does not have permission to add to the selected user list(s)"
            raise PermissionError(msg)
        current_relationships = UserListRelationship.objects.filter(
            parent__author=request.user, child_id=learning_resource_id
        )

        # Remove the resource from lists it WAS in before but is not in now
        current_relationships.exclude(parent_id__in=userlist_ids).delete()
        current_parent_lists = current_relationships.values_list("parent_id", flat=True)

        for userlist_id in userlist_ids:
            last_index = 0
            # re-number the positions for surviving items
            for index, relationship in enumerate(
                UserListRelationship.objects.filter(
                    parent__author=request.user, parent__id=userlist_id
                ).order_by("position")
            ):
                relationship.position = index
                relationship.save()
                last_index = index
            # Add new items as necessary
            if userlist_id not in list(current_parent_lists):
                UserListRelationship.objects.create(
                    parent_id=userlist_id,
                    child_id=learning_resource_id,
                    position=last_index + 1,
                )
        SerializerClass = self.get_serializer_class()
        serializer = SerializerClass(current_relationships, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Set Learning Path Relationships",
        description="Set Learning Path Relationships on a given Learning Resource.",
        parameters=[
            OpenApiParameter(
                name="learning_path_id",
                type=OpenApiTypes.INT,
                many=True,
                location=OpenApiParameter.QUERY,
                description="id of the parent learning path",
            ),
        ],
        responses={200: LearningResourceRelationshipSerializer(many=True)},
    )
    @action(
        detail=True,
        methods=["patch"],
        permission_classes=[HasLearningPathPermissions],
        name="Set Learning Path Relationships",
    )
    def learning_paths(self, request, *args, **kwargs):  # noqa: ARG002
        """
        Set Learning Path relationships for a given Learning Resource
        """
        req_data = SetLearningPathsRequestSerializer().to_internal_value(
            {
                "learning_path_ids": request.query_params.getlist("learning_path_id"),
                "learning_resource_id": kwargs.get("pk"),
            }
        )
        learning_resource_id = req_data["learning_resource_id"]
        learning_path_ids = req_data["learning_path_ids"]
        current_relationships = LearningResourceRelationship.objects.filter(
            child_id=learning_resource_id
        )
        # Remove the resource from lists it WAS in before but is not in now
        current_relationships.exclude(parent_id__in=learning_path_ids).delete()
        current_parent_lists = current_relationships.values_list("parent_id", flat=True)

        for learning_path_id_str in learning_path_ids:
            learning_path_id = int(learning_path_id_str)
            last_index = 0
            # re-number the positions for surviving items
            for index, relationship in enumerate(
                LearningResourceRelationship.objects.filter(
                    parent__id=learning_path_id
                ).order_by("position")
            ):
                relationship.position = index
                relationship.save()
                last_index = index

            # Add new items as necessary
            if learning_path_id not in list(current_parent_lists):
                LearningResourceRelationship.objects.create(
                    parent_id=learning_path_id,
                    child_id=learning_resource_id,
                    relation_type=LearningResourceRelationTypes.LEARNING_PATH_ITEMS,
                    position=last_index + 1,
                )
        SerializerClass = self.get_serializer_class()
        serializer = SerializerClass(current_relationships, many=True)
        return Response(serializer.data)

    @method_decorator(
        cache_page_for_anonymous_users(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="learning_resource_relationships",
        )
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


@extend_schema_view(
    create=extend_schema(summary="Learning Path Resource Relationship Add"),
    destroy=extend_schema(summary="Learning Path Resource Relationship Remove"),
    partial_update=extend_schema(summary="Learning Path Resource Relationship Update"),
)
@extend_schema(
    parameters=[
        OpenApiParameter(
            name="learning_resource_id",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.PATH,
            description="The learning resource id of the learning path",
        )
    ]
)
class LearningPathItemsViewSet(ResourceListItemsViewSet, viewsets.ModelViewSet):
    """
    Viewset for LearningPath related resources
    """

    serializer_class = LearningPathRelationshipSerializer
    permission_classes = (permissions.HasLearningPathItemPermissions,)
    http_method_names = VALID_HTTP_METHODS

    @method_decorator(
        cache_page_for_anonymous_users(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="learning_path_items",
        )
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        request.data["parent"] = request.data.get("parent_id")
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        request.data["parent"] = request.data.get("parent_id")
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        """Delete the relationship and update the positions of the remaining items"""
        with transaction.atomic():
            LearningResourceRelationship.objects.filter(
                parent=instance.parent,
                relation_type=instance.relation_type,
                position__gt=instance.position,
            ).update(position=F("position") - 1)
            instance.delete()


@extend_schema_view(
    list=extend_schema(summary="List"),
    retrieve=extend_schema(summary="Retrieve"),
)
class TopicViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Topics covered by learning resources
    """

    queryset = LearningResourceTopic.objects.for_serialization().order_by("name")
    serializer_class = LearningResourceTopicSerializer
    pagination_class = LargePagination
    permission_classes = (AnonymousAccessReadonlyPermission,)
    filter_backends = [DjangoFilterBackend]
    filterset_class = TopicFilter

    def filter_queryset(self, queryset):
        queryset = queryset.exclude(channel_url__isnull=True)
        return super().filter_queryset(queryset)

    @method_decorator(
        cache_page_for_all_users(
            settings.REDIS_VIEW_CACHE_DURATION, cache="redis", key_prefix="topics"
        )
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


@extend_schema_view(
    list=extend_schema(summary="List"),
    retrieve=extend_schema(summary="Retrieve"),
)
@extend_schema(
    parameters=[
        OpenApiParameter(
            name="learning_resource_id",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.PATH,
            description="id of the parent learning resource",
        )
    ]
)
class ContentFileViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Viewset for ContentFiles
    """

    serializer_class = ContentFileSerializer
    permission_classes = (AnonymousAccessReadonlyPermission,)
    queryset = (
        ContentFile.objects.for_serialization()
        .filter(published=True)
        .order_by("-created_on")
    )
    pagination_class = DefaultPagination
    filter_backends = [MultipleOptionsFilterBackend]
    filterset_class = ContentFileFilter
    private_fields = ["content"]

    def get_serializer(self, *args, **kwargs):
        """
        Dynamically modify the serializer to hide the `content` field
        for anonymous users.
        """
        serializer = ContentFileSerializer(*args, **kwargs)

        if not show_content_file_content(self.request.user):
            for field in self.private_fields:
                if hasattr(serializer, "child"):
                    serializer.child.fields.pop(field, None)
                else:
                    serializer.fields.pop(field, None)

        return serializer


@extend_schema_view(
    list=extend_schema(
        summary="Learning Resource Content File List",
    ),
    retrieve=extend_schema(
        summary="Learning Resource Content File Retrieve",
    ),
)
class LearningResourceContentFilesViewSet(NestedViewSetMixin, ContentFileViewSet):
    """
    Show content files for a learning resource
    """

    parent_lookup_kwargs = {"learning_resource_id": "run__learning_resource"}


@extend_schema_view(
    list=extend_schema(summary="List"),
    retrieve=extend_schema(summary="Retrieve"),
    create=extend_schema(summary="Create"),
    destroy=extend_schema(summary="Destroy"),
    partial_update=extend_schema(summary="Update"),
)
class UserListViewSet(viewsets.ModelViewSet):
    """
    Viewset for UserLists
    """

    serializer_class = UserListSerializer
    pagination_class = DefaultPagination
    permission_classes = (HasUserListPermissions,)
    http_method_names = VALID_HTTP_METHODS
    lookup_url_kwarg = "id"

    def get_queryset(self):
        """Return a queryset for this user"""
        return (
            UserList.objects.all()
            .prefetch_related("author", "topics")
            .annotate(item_count=Count("children"))
        )

    def list(self, request, **kwargs):  # noqa: ARG002
        queryset = self.get_queryset().filter(author_id=self.request.user.id)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, id=None, **kwargs):  # noqa: A002,ARG002
        queryset = self.get_queryset().filter(
            Q(author_id=self.request.user.id)
            | Q(privacy_level=PrivacyLevel.unlisted.value)
        )
        userlist = get_object_or_404(queryset, pk=id)
        serializer = self.get_serializer(userlist)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        instance.delete()


@extend_schema_view(
    list=extend_schema(summary="User List Resources List"),
    retrieve=extend_schema(summary="User List Resources Retrieve"),
    create=extend_schema(summary="User List Resource Relationship Add"),
    destroy=extend_schema(summary="User List Resource Relationship Remove"),
    partial_update=extend_schema(summary="User List Resource Relationship Update"),
)
@extend_schema(
    parameters=[
        OpenApiParameter(
            name="userlist_id",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.PATH,
            description="id of the parent user list",
        )
    ]
)
class UserListItemViewSet(NestedViewSetMixin, viewsets.ModelViewSet):
    """
    Viewset for UserListRelationships
    """

    queryset = UserListRelationship.objects.prefetch_related("child").order_by(
        "position"
    )
    serializer_class = UserListRelationshipSerializer
    pagination_class = DefaultPagination
    permission_classes = (HasUserListItemPermissions,)
    http_method_names = VALID_HTTP_METHODS
    parent_lookup_kwargs = {"userlist_id": "parent"}

    def create(self, request, *args, **kwargs):
        user_list_id = kwargs.get("userlist_id")
        request.data["parent"] = user_list_id

        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        user_list_id = kwargs.get("userlist_id")
        request.data["parent"] = user_list_id
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        instance.delete()
        UserListRelationship.objects.filter(
            parent=instance.parent,
            position__gt=instance.position,
        ).update(position=F("position") - 1)


@cache_page(60 * settings.RSS_FEED_CACHE_MINUTES)
def podcast_rss_feed(request):  # noqa: ARG001
    """
    View to display the combined podcast rss file
    """

    rss = generate_aggregate_podcast_rss()
    return HttpResponse(
        rss.prettify(), content_type="application/rss+xml; charset=utf-8"
    )


@extend_schema_view(
    list=extend_schema(
        summary="List", description="Get a list of all userlist items for a user"
    ),
)
class UserListMembershipViewSet(viewsets.ReadOnlyModelViewSet):
    """Viewset for all user list relationships"""

    serializer_class = MicroUserListRelationshipSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ["get"]

    def get_queryset(self):
        """
        Generate a QuerySet for fetching all UserListRelationships for the user

        Returns:
            QuerySet of UserListRelationship objects authored by the user
        """
        return UserListRelationship.objects.filter(
            child__published=True,
            parent__author=self.request.user,
        ).order_by("child", "parent")


@method_decorator(blocked_ip_exempt, name="dispatch")
class WebhookOCWView(views.APIView):
    """
    Handle webhooks coming from the OCW Next bucket
    """

    permission_classes = ()
    authentication_classes = ()

    def handle_exception(self, exc):
        """
        Raise any exception with request info instead of returning response
        with error status/message
        """
        msg = (
            f"Error ({exc}). BODY: {self.request.body or ''}, META: {self.request.META}"
        )
        raise WebhookException(msg) from exc

    @extend_schema(exclude=True)
    def post(self, request):
        """Process webhook request"""
        content = rapidjson.loads(request.body.decode())

        if not compare_digest(content.get("webhook_key", ""), settings.OCW_WEBHOOK_KEY):
            msg = "Incorrect webhook key"
            raise WebhookException(msg)

        version = content.get("version")
        prefix = content.get("prefix")
        prefixes = content.get("prefixes", [prefix] if prefix else None)
        site_uid = content.get("site_uid")
        unpublished = content.get("unpublished", False)
        status = 200

        if version == "live":
            if prefixes is not None:
                # Index the course(s)
                prefixes = (
                    prefixes
                    if isinstance(prefixes, list)
                    else [prefix.strip() for prefix in prefixes.split(",")]
                )
                for url_paths in chunks(
                    prefixes, chunk_size=settings.OCW_ITERATOR_CHUNK_SIZE
                ):
                    get_ocw_courses.delay(
                        url_paths=url_paths,
                        force_overwrite=False,
                    )
                message = f"OCW courses queued for indexing: {prefixes}"
            elif site_uid is not None and unpublished is True:
                # Remove the course from the search index
                run = LearningResourceRun.objects.filter(
                    run_id=site_uid,
                    learning_resource__platform__code=PlatformType.ocw.name,
                ).first()
                if run:
                    resource = run.learning_resource
                    resource.published = False
                    resource.save()
                    resource_unpublished_actions(resource)
                    message = f"OCW course {site_uid} queued for unpublishing"
                else:
                    message = (
                        f"OCW course {site_uid} not found, so nothing to unpublish"
                    )
            else:
                message = (
                    f"Could not determine appropriate action from request: {content}"
                )
                status = 400

        else:
            message = "Not a live version, ignoring"
        return Response(data={"message": message}, status=status)


@extend_schema_view(
    list=extend_schema(summary="List"),
    retrieve=extend_schema(summary="Retrieve", parameters=[]),
)
class ContentTagViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Course Features and Content Feature Types
    """

    queryset = LearningResourceContentTag.objects.all().order_by("id")
    serializer_class = LearningResourceContentTagSerializer
    pagination_class = LargePagination
    permission_classes = (AnonymousAccessReadonlyPermission,)

    @method_decorator(
        cache_page_for_all_users(
            settings.REDIS_VIEW_CACHE_DURATION, cache="redis", key_prefix="content_tags"
        )
    )
    def list(self, *args, **kwargs):
        return super().list(*args, **kwargs)


@extend_schema_view(
    list=extend_schema(summary="List"),
    retrieve=extend_schema(summary="Retrieve", parameters=[]),
)
class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    MIT academic departments
    """

    queryset = LearningResourceDepartment.objects.for_serialization(
        prefetch_school=True
    ).order_by("department_id")
    serializer_class = LearningResourceDepartmentSerializer
    pagination_class = LargePagination
    permission_classes = (AnonymousAccessReadonlyPermission,)
    lookup_url_kwarg = "department_id"
    lookup_field = "department_id__iexact"

    @method_decorator(
        cache_page_for_all_users(
            settings.REDIS_VIEW_CACHE_DURATION, cache="redis", key_prefix="departments"
        )
    )
    def list(self, *args, **kwargs):
        return super().list(*args, **kwargs)


@extend_schema_view(
    list=extend_schema(summary="List"),
    retrieve=extend_schema(summary="Retrieve", parameters=[]),
)
class SchoolViewSet(viewsets.ReadOnlyModelViewSet):
    """
    MIT schools
    """

    queryset = LearningResourceSchool.objects.for_serialization().order_by("id")
    serializer_class = LearningResourceSchoolSerializer
    pagination_class = LargePagination
    permission_classes = (AnonymousAccessReadonlyPermission,)

    @method_decorator(
        cache_page_for_all_users(
            settings.REDIS_VIEW_CACHE_DURATION, cache="redis", key_prefix="schools"
        )
    )
    def list(self, *args, **kwargs):
        return super().list(*args, **kwargs)


@extend_schema_view(
    list=extend_schema(summary="List"),
    retrieve=extend_schema(summary="Retrieve"),
)
class PlatformViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Platforms on which learning resources are hosted
    """

    queryset = LearningResourcePlatform.objects.all().order_by("code")
    serializer_class = LearningResourcePlatformSerializer
    pagination_class = LargePagination
    permission_classes = (AnonymousAccessReadonlyPermission,)

    @method_decorator(
        cache_page_for_all_users(
            settings.REDIS_VIEW_CACHE_DURATION, cache="redis", key_prefix="platforms"
        )
    )
    def list(self, *args, **kwargs):
        return super().list(*args, **kwargs)


@extend_schema_view(
    list=extend_schema(summary="List"),
    retrieve=extend_schema(summary="Retrieve"),
)
class OfferedByViewSet(viewsets.ReadOnlyModelViewSet):
    """
    MIT organizations that offer learning resources
    """

    queryset = LearningResourceOfferor.objects.for_serialization().order_by("code")
    serializer_class = LearningResourceOfferorDetailSerializer
    pagination_class = LargePagination
    permission_classes = (AnonymousAccessReadonlyPermission,)
    lookup_field = "code"

    @method_decorator(
        cache_page_for_anonymous_users(
            settings.REDIS_VIEW_CACHE_DURATION, cache="redis", key_prefix="offerors"
        )
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


@extend_schema_view(
    list=extend_schema(
        description="Get a paginated list of videos",
    ),
    retrieve=extend_schema(
        description="Retrieve a single video",
    ),
)
class VideoViewSet(BaseLearningResourceViewSet):
    """
    Viewset for Videos
    """

    resource_type_name_plural = "Videos"

    serializer_class = VideoResourceSerializer

    def get_queryset(self):
        """
        Generate a QuerySet for fetching valid Videos

        Returns:
            QuerySet of LearningResource objects that are Videos
        """
        return self._get_base_queryset(
            resource_type=LearningResourceType.video.name
        ).filter(published=True)


@extend_schema_view(
    list=extend_schema(
        description="Get a paginated list of video playlists",
    ),
    retrieve=extend_schema(
        description="Retrieve a single video playlist",
    ),
)
class VideoPlaylistViewSet(BaseLearningResourceViewSet):
    """
    Viewset for VideoPlaylists
    """

    resource_type_name_plural = "Video Playlists"

    serializer_class = VideoPlaylistResourceSerializer

    def get_queryset(self):
        """
        Generate a QuerySet for fetching valid Video Playlists

        Returns:
            QuerySet of LearningResource objects that are Video Playlists
        """
        return self._get_base_queryset(
            resource_type=LearningResourceType.video_playlist.name
        ).filter(published=True)


@extend_schema_view(
    retrieve=extend_schema(
        description="Retrieve a single featured resource",
    ),
)
class FeaturedViewSet(
    BaseLearningResourceViewSet,
):
    """
    Viewset for Featured Resources
    """

    lookup_url_kwarg = "id"
    resource_type_name_plural = "Featured Resources"
    serializer_class = LearningResourceSerializer

    def get_queryset(self) -> QuerySet:
        """
        Generate a QuerySet for fetching featured LearningResource objects

        Returns:
            QuerySet of LearningResource objects that are in
            featured learning paths from certain offerors
        """
        featured_list_ids = Channel.objects.filter(
            channel_type=ChannelType.unit.name
        ).values_list("featured_list", flat=True)

        return (
            self._get_base_queryset()
            .filter(parents__parent_id__in=featured_list_ids)
            .filter(published=True)
            .annotate(position=F("parents__position"))
            .order_by("position")
            .distinct()
        )

    @method_decorator(
        cache_page_for_anonymous_users(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="featured_resources",
        )
    )
    @extend_schema(
        summary="List",
        description="Get a paginated list of featured resources",
    )
    def list(self, request, *args, **kwargs):  # noqa: ARG002
        """Get a paginated list of featured resources"""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(
        summary="List",
        description="Get a paginated list of learning resource display info",
        responses=LearningResourceDisplayInfoResponseSerializer(many=True),
    ),
    retrieve=extend_schema(
        summary="Retrieve",
        description="Retrieve display info for a learning resource.",
        responses=LearningResourceDisplayInfoResponseSerializer(),
    ),
)
class LearningResourceDisplayInfoViewSet(BaseLearningResourceViewSet):
    """
    Viewset for LearningResourceDisplayInfo
    """

    serializer_class = LearningResourceDisplayInfoResponseSerializer

    @method_decorator(
        cache_page_for_anonymous_users(
            settings.REDIS_VIEW_CACHE_DURATION,
            cache="redis",
            key_prefix="learning_resource_display_info",
        )
    )
    def list(self, *_args, **_kwargs):
        """Get paginated list of display info"""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = LearningResourceSerializer(page, many=True)

            return self.get_paginated_response(
                self.get_serializer(serializer.data, many=True).data
            )

        serializer = LearningResourceSerializer(queryset, many=True)
        return Response(self.get_serializer(serializer.data, many=True).data)

    def retrieve(self, *_args, **_kwargs):
        instance = self.get_object()
        serializer = LearningResourceSerializer(instance)
        return Response(self.get_serializer(serializer.data).data)


@extend_schema_view(
    list_problems=extend_schema(
        summary="Retrieve problem list",
        description="Retrieve a list of problem names for a course run",
        operation_id="list_problems",
        responses={
            200: inline_serializer(
                name="ProblemListResponse",
                fields={
                    "problem_set_titles": serializers.ListField(
                        child=serializers.CharField()
                    )
                },
            )
        },
    ),
    retrieve_problem=extend_schema(
        summary="Retrieve Problem",
        description="Retrieve a specific problem and its solution for a course run",
        operation_id="retrieve_problem",
        responses={
            200: inline_serializer(
                name="RetrieveProblemResponse",
                fields={
                    "problem_set": serializers.CharField(),
                    "solution_set": serializers.CharField(),
                },
            )
        },
    ),
)
class CourseRunProblemsViewSet(viewsets.ViewSet):
    """Viewset for all tutorbot problems and solutions for a course run"""

    permission_classes = ()

    http_method_names = ["get"]
    lookup_field = "run_readable_id"
    lookup_url_kwarg = "run_readable_id"

    @action(
        detail=False,
        methods=["get"],
        url_path=r"(?P<run_readable_id>[^/]+)",
        permission_classes=[AnonymousAccessReadonlyPermission],
    )
    def list_problems(self, request, run_readable_id):  # noqa: ARG002
        """
        Fetch Tutorbot problem titles for a course run

        Returns:
            Array of strings of problem titles from TutorProblemFile objects for a
            course run
        """
        run = LearningResourceRun.objects.filter(
            run_id=run_readable_id,
            learning_resource__platform=PlatformType.canvas.name,
        ).first()
        problem_list = (
            TutorProblemFile.objects.filter(run=run)
            .order_by("problem_title")
            .values_list("problem_title", flat=True)
            .distinct()
        )
        return Response({"problem_set_titles": list(problem_list)})

    @action(
        detail=False,
        methods=["get"],
        url_path=r"(?P<run_readable_id>[^/]+)/(?P<problem_title>[^/]+)",
        permission_classes=[permissions.IsAdminOrTutorProblemViewer],
    )
    def retrieve_problem(self, request, run_readable_id, problem_title):  # noqa: ARG002
        """
        Fetch Tutorbot problem and solution content for a course run

        Returns:
            json object with problem and solution content for a specific problem
        """
        run = LearningResourceRun.objects.filter(
            run_id=run_readable_id, learning_resource__platform=PlatformType.canvas.name
        ).first()

        problem_files = TutorProblemFile.objects.filter(
            run=run, problem_title=problem_title, type="problem"
        )
        solution_files = TutorProblemFile.objects.filter(
            run=run, problem_title=problem_title, type="solution"
        )

        return Response(
            {
                "problem_set_files": [
                    problem_set_file_output(problem_file)
                    for problem_file in problem_files
                ],
                "solution_set_files": [
                    problem_set_file_output(solution_file)
                    for solution_file in solution_files
                ],
            }
        )


def problem_set_file_output(problem_set_file):
    if problem_set_file.file_extension == ".csv":
        csv_lines = problem_set_file.content.splitlines()
        return {
            "file_name": problem_set_file.file_name,
            "file_extension": ".csv",
            "truncated_content": "\n".join(csv_lines[0:5]),
            "number_of_records": len(csv_lines) - 1,
            "note": "The content of the data file has been truncated to the column headers and first 4 rows.",  # noqa: E501
        }
    return {
        "file_name": problem_set_file.file_name,
        "content": problem_set_file.content,
        "file_extension": problem_set_file.file_extension,
    }
