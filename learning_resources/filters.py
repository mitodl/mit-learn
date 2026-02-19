"""Filters for learning_resources API"""

import logging
from decimal import Decimal

from django.db.models import Count, Q
from django_filters import (
    BooleanFilter,
    ChoiceFilter,
    FilterSet,
    MultipleChoiceFilter,
)

from learning_resources.constants import (
    DEPARTMENTS,
    LEARNING_RESOURCE_SORTBY_OPTIONS,
    RESOURCE_TYPE_GROUP_VALUES,
    CertificationType,
    LearningResourceDelivery,
    LearningResourceType,
    LevelType,
    OfferedBy,
    PlatformType,
)
from learning_resources.models import (
    ContentFile,
    LearningResource,
)
from main.filters import CharInFilter, NumberInFilter, multi_or_filter

log = logging.getLogger(__name__)


class LearningResourceFilter(FilterSet):
    """LearningResource filter"""

    free = BooleanFilter(
        label="The course/program is offered for free", method="filter_free"
    )

    department = MultipleChoiceFilter(
        label="The department that offers learning resources",
        field_name="departments__department_id",
        choices=(list(DEPARTMENTS.items())),
    )

    resource_type = MultipleChoiceFilter(
        label="The type of learning resource",
        choices=(
            [
                (resource_type.name, resource_type.value)
                for resource_type in LearningResourceType
            ]
        ),
        field_name="resource_type",
        lookup_expr="iexact",
    )
    offered_by = MultipleChoiceFilter(
        label="The organization that offers a learning resource",
        choices=([(offeror.name, offeror.value) for offeror in OfferedBy]),
        field_name="offered_by",
        lookup_expr="exact",
    )

    platform = MultipleChoiceFilter(
        label="The platform on which learning resources are offered",
        choices=([(platform.name, platform.value) for platform in PlatformType]),
        field_name="platform",
        lookup_expr="exact",
    )

    level = MultipleChoiceFilter(
        label="The academic level of the resources",
        method="filter_level",
        choices=LevelType.as_list(),
    )

    topic = CharInFilter(
        label="Topics covered by the resources. Load the '/api/v1/topics' endpoint "
        "for a list of topics",
        field_name="topics__name__iexact",
    )

    course_feature = CharInFilter(
        label="Content feature for the resources. Load the 'api/v1/course_features' "
        "endpoint for a list of course features",
        field_name="content_tags__name__iexact",
    )

    readable_id = CharInFilter(
        label="A unique text identifier for the resources",
        field_name="readable_id",
    )

    resource_id = NumberInFilter(
        label="Comma-separated list of learning resource IDs",
        field_name="id",
    )

    sortby = ChoiceFilter(
        label="Sort By",
        method="filter_sortby",
        choices=(
            [
                (key, value["title"])
                for key, value in LEARNING_RESOURCE_SORTBY_OPTIONS.items()
            ]
        ),
    )

    delivery = MultipleChoiceFilter(
        label="The delivery of course/program resources",
        method="filter_delivery",
        choices=LearningResourceDelivery.as_list(),
    )

    certification_type = MultipleChoiceFilter(
        label="The type of certification offered",
        choices=CertificationType.as_tuple(),
        field_name="certification_type",
        lookup_expr="iexact",
    )

    resource_type_group = MultipleChoiceFilter(
        label="The resource type group of the learning resources",
        method="filter_resource_type_group",
        choices=(
            [
                (value, value.replace("_", " ").title())
                for value in RESOURCE_TYPE_GROUP_VALUES
            ]
        ),
    )

    def filter_free(self, queryset, _, value):
        """Free cost filter for learning resources"""
        free_filter = (
            Q(runs__isnull=True)
            | Q(runs__resource_prices__isnull=True)
            | Q(runs__resource_prices__amount=Decimal("0.00"))
        ) & Q(professional=False)
        if value:
            # Free resources
            return queryset.filter(free_filter)
        else:
            # Resources that are not offered for free
            return queryset.exclude(free_filter)

    def filter_resource_type_group(self, queryset, _, value):
        """Filter by resource type group"""
        query_or_filters = Q()
        for val in value:
            if val in [
                LearningResourceType.course.name,
                LearningResourceType.program.name,
            ]:
                query_or_filters |= Q(resource_type=val)
            else:
                query_or_filters |= ~Q(
                    resource_type__in=[
                        LearningResourceType.course.name,
                        LearningResourceType.program.name,
                    ]
                )
        return queryset.filter(query_or_filters)

    def filter_level(self, queryset, _, value):
        """Level Filter for learning resources"""
        values = [[LevelType[val].name] for val in value]
        return multi_or_filter(queryset, "runs__level__contains", values)

    def filter_sortby(self, queryset, _, value):
        """Sort the queryset in the order specified by the value"""
        sort_param = LEARNING_RESOURCE_SORTBY_OPTIONS[value]["sort"]

        if "views" in value:
            queryset = queryset.annotate(num_hits=Count("views"))
            sort_param = sort_param.replace("views", "num_hits")

        return queryset.order_by(sort_param)

    def filter_delivery(self, queryset, _, value):
        """Delivery Filter for learning resources"""
        values = [[LearningResourceDelivery[val].name] for val in value]
        return multi_or_filter(queryset, "delivery__contains", values)

    class Meta:
        model = LearningResource
        fields = ["professional", "certification"]


class ContentFileFilter(FilterSet):
    """ContentFile filter"""

    run_id = NumberInFilter(
        label="The id of the learning resource run the content file belongs to",
        field_name="run_id",
    )

    resource_id = NumberInFilter(
        label="The id of the learning resource the content file belongs to",
        field_name="run__learning_resource__id",
    )

    content_feature_type = CharInFilter(
        label="Content feature type for the content file. Load the "
        "'api/v1/course_features' endpoint for a list of course features",
        field_name="content_tags__name__iexact",
    )

    edx_module_id = CharInFilter(
        label="The edx module id of the content file",
        field_name="edx_module_id__iexact",
    )

    offered_by = MultipleChoiceFilter(
        label="The organization that offers a learning resource the content file "
        "belongs to",
        field_name="run__learning_resource__offered_by",
        lookup_expr="exact",
        choices=([(offeror.name, offeror.value) for offeror in OfferedBy]),
    )

    platform = MultipleChoiceFilter(
        label="The platform on which learning resources the content file belongs "
        "to is offered",
        field_name="run__learning_resource__platform",
        lookup_expr="exact",
        choices=([(platform.name, platform.value) for platform in PlatformType]),
    )

    class Meta:
        model = ContentFile
        fields = []


class TopicFilter(FilterSet):
    """Filterset for learning resource topics."""

    name = CharInFilter(
        label="Topic name",
        field_name="name__iexact",
    )
    parent_topic_id = NumberInFilter(
        label="Parent topic ID",
        field_name="parent_id",
    )
    is_toplevel = BooleanFilter(
        label="Filter top-level topics",
        method="filter_toplevel",
    )

    def filter_toplevel(self, queryset, _, value):
        """Filter by top-level (parent == null)"""
        return queryset.filter(parent__isnull=value)
