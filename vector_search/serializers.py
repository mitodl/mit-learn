import datetime
import json

from dateutil import parser as date_parser
from django.conf import settings
from drf_spectacular.plumbing import build_choice_description_list
from drf_spectacular.utils import extend_schema_field
from langchain_text_splitters import RecursiveJsonSplitter
from rest_framework import serializers

from learning_resources.constants import (
    DEPARTMENTS,
    RESOURCE_CATEGORY_VALUES,
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


class LearningResourceMetadataDisplaySerializer(serializers.Serializer):
    """
    Serializer to render course information as a text document
    """

    title = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True)
    platform = serializers.ReadOnlyField(read_only=True)
    offered_by = serializers.ReadOnlyField(read_only=True)
    full_description = serializers.CharField(read_only=True)
    url = serializers.CharField(read_only=True)
    departments = serializers.ReadOnlyField(
        read_only=True,
    )
    free = serializers.ReadOnlyField(read_only=True)
    topics_display = serializers.SerializerMethodField()
    price_display = serializers.SerializerMethodField()
    certification_display = serializers.SerializerMethodField()
    instructors_display = serializers.SerializerMethodField()
    runs_display = serializers.SerializerMethodField()
    offered_by_display = serializers.SerializerMethodField()
    languages_display = serializers.SerializerMethodField()
    levels_display = serializers.SerializerMethodField()
    departments_display = serializers.SerializerMethodField()
    platform_display = serializers.SerializerMethodField()

    def get_departments_display(self, serialized_resource):
        return ", ".join(
            f"{department['name']} ({department['school']['name']})"
            for department in serialized_resource.get("departments", [])
        )

    def get_platform_display(self, serialized_resource):
        return serialized_resource["platform"]["name"]

    def get_levels_display(self, serialized_resource):
        levels = []
        for run in serialized_resource.get("runs", []):
            if run.get("level"):
                levels.extend(lvl["name"] for lvl in run["level"])
        return ", ".join(set(levels))

    def get_languages_display(self, serialized_resource):
        languages = []
        for run in serialized_resource.get("runs", []):
            if run.get("languages"):
                languages.extend(run["languages"])
        return ", ".join(set(languages))

    def get_offered_by_display(self, serialized_resource):
        return serialized_resource.get("offered_by", {}).get("name")

    def get_runs_display(self, serialized_resource):
        runs = []
        for run in serialized_resource.get("runs", []):
            start_date = run.get("start_date")
            formatted_date = (
                date_parser.parse(start_date)
                .replace(tzinfo=datetime.UTC)
                .strftime("%B %d, %Y")
                if start_date
                else ""
            )
            location = run.get("location") or "Online"
            duration = run.get("duration")
            delivery_modes = (
                ", ".join(delivery["name"] for delivery in run.get("delivery", []))
                or "Not specified"
            )
            instructors = ", ".join(
                instructor["full_name"]
                for instructor in run.get("instructors", [])
                if "full_name" in instructor
            )
            runs.append(
                f" - Start Date: {formatted_date}, Location: {location}, "
                f"Duration: {duration}, Format: {delivery_modes},"
                f" Instructors: {instructors}"
            )
        return "\n".join(runs) if runs else ""

    def get_instructors_display(self, serialized_resource):
        return ", ".join(
            instructor["full_name"]
            for instructor in serialized_resource.get("instructors", [])
            if "full_name" in instructor
        )

    def get_certification_display(self, serialized_resource):
        return serialized_resource.get("certification_type", {}).get("name")

    def get_price_display(self, serialized_resource):
        return (
            f"${serialized_resource['prices'][0]}"
            if serialized_resource.get("prices")
            else "Free"
        )

    def get_topics_display(self, serialized_resource):
        return ", ".join(
            topic["name"] for topic in serialized_resource.get("topics", [])
        )

    def render_document(self):
        data = self.data
        display_sections = {
            "title": "Title",
            "platform_display": "Platform",
            "url": "Link",
            "delivery": "Format",
            "departments_display": "Departments",
            "description": "Description",
            "full_description": "Full Description",
            "topics_display": "Topics",
            "price_display": "Cost",
            "certification_display": "Certification",
            "instructors_display": "Instructors",
            "runs_display": "Runs",
            "offered_by_display": "Offered By",
            "languages_display": "Languages",
            "levels_display": "Levels",
        }
        rendered_data = {}

        for section, section_display in display_sections.items():
            display_text = data.get(section)
            if display_text:
                rendered_data[section_display] = display_text
        return rendered_data

    def _json_to_text_document(
        self, json_text, document_prefix="Information about this course:"
    ):
        """Render a (serialized) json fragment as plain text"""
        rendered_info = f"{document_prefix}\n"
        for section, section_value in json.loads(json_text).items():
            rendered_info += f"{section} -\n{section_value}\n"
        return rendered_info

    def render_chunks(self):
        rendered_doc = self.render_document()
        chunk_size = (
            settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE
            if settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE
            else 512
        )
        return [
            self._json_to_text_document(json_fragment)
            for json_fragment in RecursiveJsonSplitter(
                max_chunk_size=chunk_size * 4
            ).split_text(
                json_data=rendered_doc,
                convert_lists=True,
            )
        ]


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
    resource_category_choices = [
        (value, value.replace("_", " ").title()) for value in RESOURCE_CATEGORY_VALUES
    ]
    resource_category = serializers.ListField(
        required=False,
        child=serializers.ChoiceField(
            choices=resource_category_choices,
        ),
        help_text=(
            f"The category of learning resource \
            \n\n{build_choice_description_list(resource_category_choices)}"
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
    edx_block_id = serializers.ListField(
        required=False,
        child=serializers.CharField(),
        help_text="The edx_block_id of the content file",
    )
    collection_name = serializers.CharField(
        required=False,
        help_text=("Manually specify the name of the Qdrant collection to query"),
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
