from drf_spectacular.plumbing import build_choice_description_list
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from learning_resources.constants import (
    DEPARTMENTS,
    RESOURCE_TYPE_GROUP_VALUES,
    CertificationType,
    LearningResourceDelivery,
    LearningResourceType,
    LevelType,
    OfferedBy,
    PlatformType,
)
from learning_resources.serializers import LearningResourceSerializer
from learning_resources_search.serializers import (
    CONTENT_FILE_SORTBY_OPTIONS,
    ArrayWrappedBoolean,
    ContentFileSerializer,
    SearchResponseMetadata,
    SearchResponseSerializer,
)


class LearningResourcesVectorSearchRequestSerializer(serializers.Serializer):
    """
    Request serializer for vector based search
    instead of id we use readable_id in case we upload qdrant snapshots
    """

    q = serializers.CharField(required=False, help_text="The search text")
    offset = serializers.IntegerField(
        required=False, help_text="The initial index from which to return the results"
    )
    limit = serializers.IntegerField(
        required=False, help_text="Number of results to return per page"
    )
    readable_id = serializers.CharField(
        required=False, help_text="The readable id of the resource"
    )
    offered_by_choices = [(e.name.lower(), e.value) for e in OfferedBy]
    offered_by = serializers.ListField(
        required=False,
        child=serializers.ChoiceField(choices=offered_by_choices),
        help_text=(
            f"The organization that offers the learning resource \
            \n\n{build_choice_description_list(offered_by_choices)}"
        ),
    )
    platform_choices = [(e.name.lower(), e.value) for e in PlatformType]
    platform = serializers.ListField(
        required=False,
        child=serializers.ChoiceField(choices=platform_choices),
        help_text=(
            f"The platform on which the learning resource is offered \
            \n\n{build_choice_description_list(platform_choices)}"
        ),
    )
    topic = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="The topic name. To see a list of options go to api/v1/topics/",
    )
    ocw_topic = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="The ocw topic name.",
    )

    resource_choices = [(e.name, e.value.lower()) for e in LearningResourceType]
    resource_type = serializers.ListField(
        required=False,
        child=serializers.ChoiceField(
            choices=resource_choices,
        ),
        help_text=(
            f"The type of learning resource \
            \n\n{build_choice_description_list(resource_choices)}"
        ),
    )
    free = ArrayWrappedBoolean(
        required=False,
        allow_null=True,
        default=None,
    )
    professional = ArrayWrappedBoolean(
        required=False,
        allow_null=True,
        default=None,
    )

    certification = ArrayWrappedBoolean(
        required=False,
        allow_null=True,
        default=None,
        help_text="True if the learning resource offers a certificate",
    )
    certification_choices = CertificationType.as_tuple()
    certification_type = serializers.ListField(
        required=False,
        child=serializers.ChoiceField(
            choices=certification_choices,
        ),
        help_text=(
            f"The type of certificate \
            \n\n{build_choice_description_list(certification_choices)}"
        ),
    )
    department_choices = list(DEPARTMENTS.items())
    department = serializers.ListField(
        required=False,
        child=serializers.ChoiceField(choices=department_choices),
        help_text=(
            f"The department that offers the learning resource \
            \n\n{build_choice_description_list(department_choices)}"
        ),
    )

    level = serializers.ListField(
        required=False, child=serializers.ChoiceField(choices=LevelType.as_list())
    )

    course_feature = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="The course feature. Possible options are at api/v1/course_features/",
    )

    delivery_choices = LearningResourceDelivery.as_list()
    delivery = serializers.ListField(
        required=False,
        child=serializers.ChoiceField(choices=delivery_choices),
        help_text=(
            f"The delivery options in which the learning resource is offered \
            \n\n{build_choice_description_list(delivery_choices)}"
        ),
    )
    resource_type_group_choices = [
        (value, value.replace("_", " ").title()) for value in RESOURCE_TYPE_GROUP_VALUES
    ]
    resource_type_group = serializers.ListField(
        required=False,
        child=serializers.ChoiceField(
            choices=resource_type_group_choices,
        ),
        help_text=(
            f"The category of learning resource \
            \n\n{build_choice_description_list(resource_type_group_choices)}"
        ),
    )


class LearningResourcesVectorSearchResponseSerializer(SearchResponseSerializer):
    """
    Response serializer for vector based search
    """

    @extend_schema_field(LearningResourceSerializer(many=True))
    def get_results(self, instance):
        return instance.get("hits", {})

    def get_count(self, instance) -> int:
        return instance.get("total", {}).get("value")

    def get_metadata(self, _) -> SearchResponseMetadata:
        return {
            "aggregations": [],
            "suggest": [],
        }


class ContentFileVectorSearchRequestSerializer(serializers.Serializer):
    """
    Request serializer for vector based content file search
    """

    q = serializers.CharField(required=False, help_text="The search text")
    offset = serializers.IntegerField(
        required=False, help_text="The initial index from which to return the results"
    )
    limit = serializers.IntegerField(
        required=False, help_text="Number of results to return per page"
    )
    sortby = serializers.ChoiceField(
        required=False,
        choices=CONTENT_FILE_SORTBY_OPTIONS,
        help_text="if the parameter starts with '-' the sort is in descending order",
    )
    key = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="The filename of the content file",
    )
    course_number = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="Course number of the content file",
    )
    offered_by = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="Offeror of the content file",
    )
    platform = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="platform(s) of the content file",
    )
    content_feature_type = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="The feature type of the content file. "
        "Possible options are at api/v1/course_features/",
    )
    file_extension = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="The extension of the content file. ",
    )
    run_readable_id = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="The readable_id value of the run that the content file belongs to",
    )
    resource_readable_id = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text=(
            "The readable_id value of the parent learning resource for the content file"
        ),
    )
    edx_module_id = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="The edx_module_id of the content file",
    )
    collection_name = serializers.CharField(
        required=False,
        help_text=("Manually specify the name of the Qdrant collection to query"),
    )
    group_by = serializers.CharField(
        required=False,
        help_text=("The attribute to group results by"),
    )
    group_size = serializers.IntegerField(
        required=False,
        help_text=(
            "The number of chunks in each group. Only relevant when group_by is used"
        ),
    )


class ContentFileVectorSearchResponseSerializer(SearchResponseSerializer):
    """
    SearchResponseSerializer with OpenAPI annotations for Content Files search
    """

    def get_count(self, instance) -> int:
        return instance["total"]["value"]

    @extend_schema_field(ContentFileSerializer(many=True))
    def get_results(self, instance):
        return instance["hits"]

    def get_metadata(self, *_) -> SearchResponseMetadata:
        return {
            "aggregations": [],
            "suggest": [],
        }
