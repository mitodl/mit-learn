"""Serializers for learning_resources"""

import json
import logging
from datetime import UTC
from decimal import Decimal
from uuid import uuid4

import dateparser
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Max
from drf_spectacular.utils import extend_schema_field
from langchain_text_splitters import RecursiveJsonSplitter
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from learning_resources import constants, models
from learning_resources.constants import (
    LEARNING_MATERIAL_RESOURCE_CATEGORY,
    CertificationType,
    Format,
    LearningResourceDelivery,
    LearningResourceType,
    LevelType,
    Pace,
)
from main.serializers import COMMON_IGNORED_FIELDS, WriteableSerializerMethodField

log = logging.getLogger(__name__)


class LearningResourceInstructorSerializer(serializers.ModelSerializer):
    """
    Serializer for LearningResourceInstructor model
    """

    class Meta:
        model = models.LearningResourceInstructor
        exclude = COMMON_IGNORED_FIELDS


class LearningResourcePriceSerializer(serializers.ModelSerializer):
    """
    Serializer for LearningResourcePrice model
    """

    class Meta:
        model = models.LearningResourcePrice
        exclude = "id", *COMMON_IGNORED_FIELDS


class LearningResourceTopicSerializer(serializers.ModelSerializer):
    """
    Serializer for LearningResourceTopic model
    """

    channel_url = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        """Meta options for the serializer."""

        model = models.LearningResourceTopic
        fields = ["id", "name", "icon", "parent", "channel_url"]


class WriteableTopicsMixin(serializers.Serializer):
    """Class for editable topics"""

    topics = WriteableSerializerMethodField()

    def validate_topics(self, topics):
        """Validate specified topics exist."""
        if len(topics) > 0:
            if isinstance(topics[0], dict):
                topics = [topic["id"] for topic in topics]
            try:
                valid_topic_ids = set(
                    models.LearningResourceTopic.objects.filter(
                        id__in=topics
                    ).values_list("id", flat=True)
                )
            except ValueError as ve:
                msg = "Topic ids must be integers"
                raise ValidationError(msg) from ve
            missing = set(topics).difference(valid_topic_ids)
            if missing:
                msg = f"Invalid topic ids: {missing}"
                raise ValidationError(msg)
        return {"topics": topics}

    @extend_schema_field(LearningResourceTopicSerializer(many=True))
    def get_topics(self, instance):
        """Return the list of topics"""
        return [
            LearningResourceTopicSerializer(topic).data
            for topic in instance.topics.all()
        ]


class LearningResourceTypeField(serializers.ReadOnlyField):
    """Field for LearningResource.resource_type"""


class LearningResourceOfferorSerializer(serializers.ModelSerializer):
    """Serializer for LearningResourceOfferor with basic details"""

    channel_url = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = models.LearningResourceOfferor
        fields = ("code", "name", "channel_url")


class LearningResourceOfferorDetailSerializer(LearningResourceOfferorSerializer):
    """Serializer for LearningResourceOfferor with all details"""

    channel_url = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = models.LearningResourceOfferor
        exclude = COMMON_IGNORED_FIELDS


@extend_schema_field(
    {
        "type": "object",
        "properties": {
            "code": {"enum": CertificationType.names()},
            "name": {"type": "string"},
        },
        "required": ["code", "name"],
    }
)
class CertificateTypeField(serializers.Field):
    """Serializer for LearningResource.certification_type"""

    def to_representation(self, value):
        """Serialize certification type as a dict"""
        return {"code": value, "name": CertificationType[value].value}


@extend_schema_field({"type": "array", "items": {"type": "string"}})
class LearningResourceContentTagField(serializers.Field):
    """Serializer for LearningResourceContentTag"""

    def to_representation(self, value):
        """Serialize content tags as a list of names"""
        return sorted([tag.name for tag in value.all()])


class LearningResourcePlatformSerializer(serializers.ModelSerializer):
    """Serializer for LearningResourcePlatform"""

    class Meta:
        model = models.LearningResourcePlatform
        fields = ("code", "name")


class LearningResourceBaseDepartmentSerializer(serializers.ModelSerializer):
    """
    Serializer for LearningResourceDepartment, minus school

    The absence of the departments list is to avoid a circular serialization structure.
    """

    channel_url = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = models.LearningResourceDepartment
        fields = ["department_id", "name", "channel_url"]


class LearningResourceBaseSchoolSerializer(serializers.ModelSerializer):
    """
    Base serializer for LearningResourceSchool model, minus departments list

    The absence of the departments list is to avoid a circular serialization structure.
    """

    class Meta:
        model = models.LearningResourceSchool
        fields = ["id", "name", "url"]


class LearningResourceDepartmentSerializer(LearningResourceBaseDepartmentSerializer):
    """Full serializer for LearningResourceDepartment, including school"""

    school = LearningResourceBaseSchoolSerializer(read_only=True, allow_null=True)

    class Meta:
        model = models.LearningResourceDepartment
        fields = [*LearningResourceBaseDepartmentSerializer.Meta.fields, "school"]


class LearningResourceSchoolSerializer(LearningResourceBaseSchoolSerializer):
    """
    Serializer for LearningResourceSchool model, including list of departments
    """

    departments = LearningResourceBaseDepartmentSerializer(many=True)

    class Meta:
        model = models.LearningResourceSchool
        fields = [*LearningResourceBaseSchoolSerializer.Meta.fields, "departments"]


class LearningResourceContentTagSerializer(serializers.ModelSerializer):
    """Serializer for LearningResourceContentTag"""

    class Meta:
        model = models.LearningResourceContentTag
        fields = ["id", "name"]


class LearningResourceImageSerializer(serializers.ModelSerializer):
    """Serializer for LearningResourceImage"""

    class Meta:
        model = models.LearningResourceImage
        exclude = COMMON_IGNORED_FIELDS


@extend_schema_field(
    {
        "type": "object",
        "properties": {
            "code": {"enum": LevelType.names()},
            "name": {"type": "string"},
        },
        "required": ["code", "name"],
    }
)
class LearningResourceLevelSerializer(serializers.Field):
    def to_representation(self, value):
        return {"code": value, "name": LevelType[value].value}


@extend_schema_field(
    {
        "type": "object",
        "properties": {
            "code": {"enum": LearningResourceDelivery.names()},
            "name": {"type": "string"},
        },
        "required": ["code", "name"],
    }
)
class LearningResourceDeliverySerializer(serializers.Field):
    def to_representation(self, value):
        return {"code": value, "name": LearningResourceDelivery[value].value}


@extend_schema_field(
    {
        "type": "object",
        "properties": {
            "code": {"enum": Format.names()},
            "name": {"type": "string"},
        },
        "required": ["code", "name"],
    }
)
class FormatSerializer(serializers.Field):
    def to_representation(self, value):
        return {"code": value, "name": Format[value].value}


@extend_schema_field(
    {
        "type": "object",
        "properties": {
            "code": {"enum": Pace.names()},
            "name": {"type": "string"},
        },
        "required": ["code", "name"],
    }
)
class PaceSerializer(serializers.Field):
    def to_representation(self, value):
        return {"code": value, "name": Pace[value].value}


class LearningResourceRunSerializer(serializers.ModelSerializer):
    """Serializer for the LearningResourceRun model"""

    instructors = LearningResourceInstructorSerializer(
        read_only=True, allow_null=True, many=True
    )
    image = LearningResourceImageSerializer(read_only=True, allow_null=True)

    level = serializers.ListField(child=LearningResourceLevelSerializer())
    delivery = serializers.ListField(
        child=LearningResourceDeliverySerializer(), read_only=True
    )
    format = serializers.ListField(child=FormatSerializer(), read_only=True)
    pace = serializers.ListField(child=PaceSerializer(), read_only=True)
    resource_prices = LearningResourcePriceSerializer(read_only=True, many=True)

    class Meta:
        model = models.LearningResourceRun
        exclude = ["learning_resource", *COMMON_IGNORED_FIELDS]


class ResourceListMixin(serializers.Serializer):
    """Common fields for LearningPath and other future resource lists"""

    item_count = serializers.SerializerMethodField()

    def get_item_count(self, instance) -> int:
        """Return the number of items in the list"""
        return (
            getattr(instance, "item_count", None)
            or instance.learning_resource.children.count()
        )


class CourseNumberSerializer(serializers.Serializer):
    """Serializer for CourseNumber"""

    value = serializers.CharField()
    department = LearningResourceDepartmentSerializer()
    listing_type = serializers.CharField()


class ProgramSerializer(serializers.ModelSerializer):
    """Serializer for the Program model"""

    course_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = models.Program
        include = ("course_count",)
        exclude = ("learning_resource", *COMMON_IGNORED_FIELDS)


class CourseSerializer(serializers.ModelSerializer):
    """Serializer for the Course model"""

    course_numbers = CourseNumberSerializer(many=True, allow_null=True)

    class Meta:
        model = models.Course
        exclude = ("learning_resource", *COMMON_IGNORED_FIELDS)


class LearningPathSerializer(serializers.ModelSerializer, ResourceListMixin):
    """Serializer for the LearningPath model"""

    class Meta:
        model = models.LearningPath
        exclude = ("learning_resource", "author", *COMMON_IGNORED_FIELDS)


class PodcastEpisodeSerializer(serializers.ModelSerializer):
    """
    Serializer for PodcastEpisode
    """

    podcasts = serializers.SerializerMethodField()

    def get_podcasts(self, instance) -> list[str]:
        """Get the podcast id(s) the episode belongs to"""
        return [podcast.parent_id for podcast in instance.learning_resource.podcasts]

    class Meta:
        model = models.PodcastEpisode
        exclude = ("learning_resource", *COMMON_IGNORED_FIELDS)


class PodcastSerializer(serializers.ModelSerializer):
    """
    Serializer for Podcasts
    """

    episode_count = serializers.IntegerField()

    class Meta:
        model = models.Podcast
        exclude = ("learning_resource", *COMMON_IGNORED_FIELDS)


class VideoChannelSerializer(serializers.ModelSerializer):
    """Serializer for the VideoChannel model"""

    class Meta:
        model = models.VideoChannel
        exclude = ["published", *COMMON_IGNORED_FIELDS]


class VideoSerializer(serializers.ModelSerializer):
    """Serializer for the Video model"""

    class Meta:
        model = models.Video
        exclude = ("learning_resource", *COMMON_IGNORED_FIELDS)


class VideoPlaylistSerializer(serializers.ModelSerializer):
    """Serializer for the VideoPlaylist model"""

    channel = VideoChannelSerializer(read_only=True, allow_null=True)

    video_count = serializers.IntegerField()

    class Meta:
        model = models.VideoPlaylist
        include = ("video_count",)
        exclude = ("learning_resource", *COMMON_IGNORED_FIELDS)


class MicroLearningPathRelationshipSerializer(serializers.ModelSerializer):
    """
    Serializer containing only parent and child ids for a learning path relationship
    """

    parent = serializers.ReadOnlyField(
        source="parent_id",
        help_text="The id of the parent learning resource",
    )
    child = serializers.ReadOnlyField(source="child_id")

    class Meta:
        model = models.LearningResourceRelationship
        fields = ("id", "parent", "child")


class MicroUserListRelationshipSerializer(serializers.ModelSerializer):
    """
    Serializer containing only parent and child ids for a user list relationship
    """

    parent = serializers.ReadOnlyField(
        source="parent_id", help_text="The id of the parent learning resource"
    )
    child = serializers.ReadOnlyField(source="child_id")

    class Meta:
        model = models.UserListRelationship
        fields = ("id", "parent", "child")


class LearningResourceBaseSerializer(serializers.ModelSerializer, WriteableTopicsMixin):
    """Serializer for LearningResource, minus program"""

    position = serializers.IntegerField(read_only=True, allow_null=True)
    offered_by = LearningResourceOfferorSerializer(read_only=True, allow_null=True)
    platform = LearningResourcePlatformSerializer(read_only=True, allow_null=True)
    course_feature = LearningResourceContentTagField(
        source="content_tags", read_only=True, allow_null=True
    )
    departments = LearningResourceDepartmentSerializer(
        read_only=True, allow_null=True, many=True
    )
    certification = serializers.ReadOnlyField(read_only=True)
    certification_type = CertificateTypeField(read_only=True)
    prices = serializers.ListField(
        child=serializers.DecimalField(max_digits=12, decimal_places=2),
        read_only=True,
    )
    resource_prices = LearningResourcePriceSerializer(read_only=True, many=True)
    runs = LearningResourceRunSerializer(read_only=True, many=True, allow_null=True)
    image = serializers.SerializerMethodField()
    learning_path_parents = MicroLearningPathRelationshipSerializer(
        many=True, read_only=True
    )
    user_list_parents = MicroUserListRelationshipSerializer(many=True, read_only=True)
    views = serializers.IntegerField(source="views_count", read_only=True)
    delivery = serializers.ListField(
        child=LearningResourceDeliverySerializer(), read_only=True
    )
    free = serializers.SerializerMethodField()
    resource_category = serializers.SerializerMethodField()
    format = serializers.ListField(child=FormatSerializer(), read_only=True)
    pace = serializers.ListField(child=PaceSerializer(), read_only=True)

    def get_resource_category(self, instance) -> str:
        """Return the resource category of the resource"""
        if instance.resource_type in [
            LearningResourceType.course.name,
            LearningResourceType.program.name,
        ]:
            return instance.resource_type
        else:
            return LEARNING_MATERIAL_RESOURCE_CATEGORY

    def get_free(self, instance) -> bool:
        """Return true if the resource is free/has a free option"""
        if instance.resource_type in [
            LearningResourceType.course.name,
            LearningResourceType.program.name,
        ]:
            prices = [price.amount for price in instance.resource_prices.all()]
            return not instance.professional and (
                Decimal("0.00") in prices or not prices or prices == []
            )
        else:
            return True

    @extend_schema_field(LearningResourceImageSerializer(allow_null=True))
    def get_image(self, instance) -> dict | None:
        """
        Return the resource.image if it exists. Otherwise, for learning paths only,
        return the image of the first child resource.
        """
        if instance.image:
            return LearningResourceImageSerializer(instance=instance.image).data
        elif (
            instance.resource_type == constants.LearningResourceType.learning_path.value
        ):
            list_item = instance.children.order_by("position").first()
            if list_item and list_item.child.image:
                return LearningResourceImageSerializer(
                    instance=list_item.child.image
                ).data
            return None
        return None

    class Meta:
        model = models.LearningResource
        read_only_fields = [
            "free",
            "prices",
            "resource_prices",
            "resource_category",
            "certification",
            "certification_type",
            "professional",
            "views",
            "learning_path_parents",
            "user_list_parents",
        ]
        exclude = ["content_tags", "resources", "etl_source", *COMMON_IGNORED_FIELDS]


class ProgramResourceSerializer(LearningResourceBaseSerializer):
    """Serializer for program resources"""

    resource_type = LearningResourceTypeField(
        default=constants.LearningResourceType.program.name
    )

    program = ProgramSerializer(read_only=True)


class CourseResourceSerializer(LearningResourceBaseSerializer):
    """Serializer for course resources"""

    resource_type = LearningResourceTypeField(
        default=constants.LearningResourceType.course.name
    )

    course = CourseSerializer(read_only=True)


class LearningResourceRelationshipChildField(serializers.ModelSerializer):
    """
    Serializer field for the LearningResourceRelationship model that uses
    the LearningResourceSerializer to serialize the child resources
    """

    def to_representation(self, instance):
        """Serializes child as a LearningResource"""  # noqa: D401
        return LearningResourceSerializer(instance=instance.child).data

    class Meta:
        model = models.LearningResourceRelationship
        exclude = ("parent", *COMMON_IGNORED_FIELDS)


class LearningPathResourceSerializer(LearningResourceBaseSerializer):
    """CRUD serializer for LearningPath resources"""

    resource_type = LearningResourceTypeField(
        default=constants.LearningResourceType.learning_path.name
    )

    learning_path = LearningPathSerializer(read_only=True)

    def validate_resource_type(self, value):
        """Only allow LearningPath resources to be CRUDed"""
        if value != constants.LearningResourceType.learning_path.name:
            msg = "Only LearningPath resources are editable"
            raise serializers.ValidationError(msg)
        return value

    def create(self, validated_data):
        """Ensure that the LearningPath is created by the requesting user; set topics"""
        # defined here because we disallow them as input
        validated_data["readable_id"] = uuid4().hex
        validated_data["resource_type"] = self.fields["resource_type"].default

        request = self.context.get("request")
        topics_data = validated_data.pop("topics", [])

        with transaction.atomic():
            path_resource = super().create(validated_data)
            path_resource.topics.set(
                models.LearningResourceTopic.objects.filter(id__in=topics_data)
            )
            models.LearningPath.objects.create(
                learning_resource=path_resource, author=request.user
            )
        return path_resource

    def update(self, instance, validated_data):
        """Set learning path topics and update the model object"""
        topics_data = validated_data.pop("topics", None)
        with transaction.atomic():
            resource = super().update(instance, validated_data)
            if topics_data is not None:
                resource.topics.set(
                    models.LearningResourceTopic.objects.filter(id__in=topics_data)
                )
        return resource

    class Meta:
        model = models.LearningResource
        exclude = ["content_tags", "resources", "etl_source", *COMMON_IGNORED_FIELDS]
        read_only_fields = ["platform", "offered_by", "readable_id"]


class PodcastResourceSerializer(LearningResourceBaseSerializer):
    """Serializer for podcast resources"""

    resource_type = LearningResourceTypeField(
        default=constants.LearningResourceType.podcast.name
    )

    podcast = PodcastSerializer(read_only=True)


class PodcastEpisodeResourceSerializer(LearningResourceBaseSerializer):
    """Serializer for podcast episode resources"""

    resource_type = LearningResourceTypeField(
        default=constants.LearningResourceType.podcast_episode.name
    )

    podcast_episode = PodcastEpisodeSerializer(read_only=True)


class VideoResourceSerializer(LearningResourceBaseSerializer):
    """Serializer for video resources"""

    resource_type = LearningResourceTypeField(
        default=constants.LearningResourceType.video.name
    )

    video = VideoSerializer(read_only=True)

    playlists = serializers.SerializerMethodField()

    def get_playlists(self, instance) -> list[str]:
        """Get the playlist id(s) the video belongs to"""
        return list(
            instance.parents.filter(
                relation_type=constants.LearningResourceRelationTypes.PLAYLIST_VIDEOS.value
            ).values_list("parent__id", flat=True)
        )


class VideoPlaylistResourceSerializer(LearningResourceBaseSerializer):
    """Serializer for video playlist resources"""

    resource_type = LearningResourceTypeField(
        default=constants.LearningResourceType.video_playlist.name
    )

    video_playlist = VideoPlaylistSerializer(read_only=True)


class LearningResourceSerializer(serializers.Serializer):
    """Serializer for LearningResource"""

    serializer_cls_mapping = {
        serializer_cls().fields["resource_type"].default: serializer_cls
        for serializer_cls in (
            ProgramResourceSerializer,
            CourseResourceSerializer,
            LearningPathResourceSerializer,
            PodcastResourceSerializer,
            PodcastEpisodeResourceSerializer,
            VideoResourceSerializer,
            VideoPlaylistResourceSerializer,
        )
    }

    def to_representation(self, instance):
        """Serialize a LearningResource based on resource_type"""
        serializer_cls = self.serializer_cls_mapping[instance.resource_type]

        return serializer_cls(instance=instance, context=self.context).data


class LearningResourceMetadataDisplaySerializer(serializers.Serializer):
    """
    Serializer to render course information as a text document
    """

    title = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True)

    full_description = serializers.CharField(read_only=True)
    url = serializers.CharField(read_only=True)
    free = serializers.ReadOnlyField(read_only=True)
    topics = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    certification = serializers.SerializerMethodField()
    instructors = serializers.SerializerMethodField()
    runs = serializers.SerializerMethodField()
    offered_by = serializers.SerializerMethodField()
    languages = serializers.SerializerMethodField()
    levels = serializers.SerializerMethodField()
    departments = serializers.SerializerMethodField()
    platform = serializers.SerializerMethodField()

    @extend_schema_field({"type": "array", "items": {"type": "string"}})
    def get_departments(self, serialized_resource):
        department_vals = []
        for department in serialized_resource.get("departments", []):
            school = (
                f" ({department['school']['name']})" if department.get("school") else ""
            )
            department_vals.append(f"{department['name']}{school}")
        return department_vals

    def get_platform(self, serialized_resource):
        return (
            serialized_resource["platform"].get("name")
            if serialized_resource.get("platform")
            else ""
        )

    @extend_schema_field({"type": "array", "items": {"type": "string"}})
    def get_levels(self, serialized_resource):
        levels = []
        for run in serialized_resource.get("runs", []):
            if run.get("level"):
                levels.extend(lvl["name"] for lvl in run["level"])
        return list(set(levels))

    @extend_schema_field({"type": "array", "items": {"type": "string"}})
    def get_languages(self, serialized_resource):
        languages = []
        for run in serialized_resource.get("runs", []):
            if run.get("languages"):
                languages.extend(run["languages"])
        return list(set(languages))

    @extend_schema_field({"type": "array", "items": {"type": "string"}})
    def get_offered_by(self, serialized_resource):
        return (
            serialized_resource["offered_by"].get("name")
            if serialized_resource.get("offered_by")
            else ""
        )

    def get_runs(self, serialized_resource):
        runs = []
        for run in serialized_resource.get("runs", []):
            start_date = run["start_date"]
            formatted_date = (
                dateparser.parse(start_date).replace(tzinfo=UTC).strftime("%B %d, %Y")
                if start_date
                else ""
            )
            location = run["location"] or "Online"
            duration = run["duration"]
            delivery_modes = [delivery["name"] for delivery in run.get("delivery", [])]
            instructors = [
                instructor.get("full_name")
                for instructor in run.get("instructors", [])
                if instructor.get("full_name")
            ]
            runs.append(
                {
                    "start_date": formatted_date,
                    "location": location,
                    "instructors": instructors,
                    "duration": duration,
                    "format": delivery_modes,
                }
            )
        return runs

    @extend_schema_field({"type": "array", "items": {"type": "string"}})
    def get_instructors(self, serialized_resource):
        instructors = set()
        for run in serialized_resource.get("runs", []):
            for instructor in run.get("instructors", []):
                instructors.add(instructor["full_name"])

        return list(instructors)

    def get_certification(self, serialized_resource):
        if serialized_resource.get(
            "certification_type"
        ) and not serialized_resource.get("free"):
            return serialized_resource["certification_type"].get("name")
        if (
            serialized_resource["free"]
            and serialized_resource["certification_type"]
            and serialized_resource["certification_type"]["code"]
            == CertificationType.none.name
        ):
            return CertificationType.none.value
        return None

    def get_price(self, serialized_resource):
        prices = serialized_resource.get("prices", [])
        if not serialized_resource["free"] and prices:
            return f"${serialized_resource['prices'][0]}"
        if (
            serialized_resource["free"]
            and serialized_resource["certification_type"]
            and serialized_resource["certification_type"]["code"]
            == CertificationType.completion.name
        ) and len(prices) > 1:
            return f"Free (Earn a certificate: ${prices[1]})"
        return "Free"

    @extend_schema_field({"type": "array", "items": {"type": "string"}})
    def get_topics(self, serialized_resource):
        return [topic["name"] for topic in serialized_resource.get("topics", [])]

    def render_document(self):
        data = self.data
        display_sections = {
            "title": "Title",
            "platform": "Platform",
            "url": "Link",
            "delivery": "Format",
            "departments": "Departments",
            "description": "Description",
            "full_description": "Full Description",
            "topics": "Topics",
            "price": "Cost",
            "certification": "Certification",
            "instructors": "Instructors",
            "runs": "Course Schedule (Runs and Sessions)",
            "offered_by": "Offered By",
            "languages": "Languages",
            "levels": "Levels",
        }
        rendered_data = {}

        for section, section_display in display_sections.items():
            display_text = data.get(section)
            if display_text:
                rendered_data[section_display] = display_text
        return rendered_data

    def _json_to_markdown(self, obj, indent=0):
        """
        Recursively converts a JSON object into a readable
        Markdown format with proper lists and tables.
        """
        markdown = ""
        indent_str = " " * (indent * 2)
        if isinstance(obj, dict):
            for key, value in obj.items():
                markdown += f"\n{indent_str}**{key.replace('_', ' ').title()}**\n\n"
                markdown += self._json_to_markdown(value, indent + 1)
        elif isinstance(obj, list):
            if all(
                isinstance(item, dict) for item in obj
            ):  # Check if it's a list of dictionaries
                keys = sorted(
                    {k for item in obj for k in item}
                )  # Collect and sort all keys
                # Create table header
                markdown += f"| {' | '.join(keys)} |\n"
                markdown += f"| {' | '.join(['---'] * len(keys))} |\n"
                # Create table rows
                for item in obj:
                    row = [
                        str(item.get(k, "N/A"))
                        .replace("[", "")
                        .replace("]", "")
                        .replace("{", "")
                        .replace("}", "")
                        for k in keys
                    ]
                    markdown += f"| {' | '.join(row)} |\n"
            else:
                for item in obj:
                    markdown += (
                        f"{indent_str}- "
                        f"{self._json_to_markdown(item, indent + 1).strip()}\n"
                    )
        elif obj is None:
            markdown += f"{indent_str}N/A\n\n"
        else:
            markdown += f"{indent_str}{obj}\n\n"
        return markdown

    def render_chunks(self):
        rendered_doc = self.render_document()
        """
        We cant use tiktoken for token size calculation so
        we use a rough calculation of 4*chunk_size characters:
        https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
        """
        chunk_size = (
            settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE
            if settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE
            else 512
        )
        return [
            (
                f"# Information about this course:\n\n"
                f"{self._json_to_markdown(json.loads(json_fragment))}"
            )
            for json_fragment in RecursiveJsonSplitter(
                max_chunk_size=chunk_size * 4
            ).split_text(
                json_data=rendered_doc,
                convert_lists=False,
            )
        ]


class LearningResourceWithDisplayInfoSerializer(LearningResourceSerializer):
    display_info = LearningResourceMetadataDisplaySerializer()


class LearningResourceRelationshipSerializer(serializers.ModelSerializer):
    """CRUD serializer for LearningResourceRelationship"""

    resource = LearningResourceSerializer(read_only=True, source="child")

    def create(self, validated_data):
        resource = validated_data["parent"]
        items = models.LearningResourceRelationship.objects.filter(parent=resource)
        position = (
            items.aggregate(Max("position"))["position__max"] or items.count()
        ) + 1
        item, _ = models.LearningResourceRelationship.objects.get_or_create(
            parent=validated_data["parent"],
            child=validated_data["child"],
            relation_type=validated_data["relation_type"],
            defaults={"position": position},
        )
        return item

    def update(self, instance, validated_data):
        position = validated_data["position"]
        # to perform an update on position we atomically:
        # 1) move everything between the old position and the new position towards the old position by 1  # noqa: E501
        # 2) move the item into its new position
        # this operation gets slower the further the item is moved, but it is sufficient for now  # noqa: E501
        with transaction.atomic():
            path_items = models.LearningResourceRelationship.objects.filter(
                parent=instance.parent,
                relation_type=instance.relation_type,
            )
            if position > instance.position:
                # move items between the old and new positions up, inclusive of the new position  # noqa: E501
                path_items.filter(
                    position__lte=position, position__gt=instance.position
                ).update(position=F("position") - 1)
            else:
                # move items between the old and new positions down, inclusive of the new position  # noqa: E501
                path_items.filter(
                    position__lt=instance.position, position__gte=position
                ).update(position=F("position") + 1)
            # now move the item into place
            instance.position = position
            instance.save()

        return instance

    class Meta:
        model = models.LearningResourceRelationship
        extra_kwargs = {"position": {"required": False}}
        exclude = COMMON_IGNORED_FIELDS


class LearningPathRelationshipSerializer(LearningResourceRelationshipSerializer):
    """Specialized serializer for a LearningPath relationship"""

    relation_type = serializers.HiddenField(
        default=constants.LearningResourceRelationTypes.LEARNING_PATH_ITEMS.value
    )


class ContentFileSerializer(serializers.ModelSerializer):
    """
    Serializer class for course run ContentFiles
    """

    run_id = serializers.IntegerField(source="run.id")
    run_readable_id = serializers.CharField(source="run.run_id")
    run_title = serializers.CharField(source="run.title")
    run_slug = serializers.CharField(source="run.slug")
    semester = serializers.CharField(source="run.semester")
    year = serializers.IntegerField(source="run.year")
    topics = LearningResourceTopicSerializer(
        source="run.learning_resource.topics", many=True
    )
    resource_id = serializers.CharField(source="run.learning_resource.id")
    departments = LearningResourceDepartmentSerializer(
        source="run.learning_resource.departments", many=True
    )
    resource_readable_id = serializers.CharField(
        source="run.learning_resource.readable_id"
    )
    course_number = serializers.SerializerMethodField()
    content_feature_type = LearningResourceContentTagField(source="content_tags")
    offered_by = LearningResourceOfferorSerializer(
        source="run.learning_resource.offered_by"
    )
    platform = LearningResourcePlatformSerializer(
        source="run.learning_resource.platform"
    )

    def get_course_number(self, instance) -> list[str]:
        """Extract the course number(s) from the associated course"""
        if hasattr(instance.run.learning_resource, LearningResourceType.course.name):
            return [
                coursenum["value"]
                for coursenum in instance.run.learning_resource.course.course_numbers
            ]
        return []

    class Meta:
        model = models.ContentFile
        fields = [
            "id",
            "run_id",
            "run_title",
            "run_slug",
            "departments",
            "semester",
            "year",
            "topics",
            "key",
            "uid",
            "title",
            "description",
            "url",
            "content_feature_type",
            "content_type",
            "content",
            "content_title",
            "content_author",
            "content_language",
            "image_src",
            "resource_id",
            "resource_readable_id",
            "course_number",
            "file_type",
            "file_extension",
            "offered_by",
            "platform",
            "run_readable_id",
            "file_extension",
            "edx_module_id",
        ]


class UserListSerializer(serializers.ModelSerializer, WriteableTopicsMixin):
    """
    Simplified serializer for UserList model.
    """

    item_count = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    def get_image(self, instance) -> dict:
        """Return the image of the first item"""
        list_item = instance.children.order_by("position").first()
        if list_item and list_item.child.image:
            return LearningResourceImageSerializer(instance=list_item.child.image).data
        return None

    def get_item_count(self, instance) -> int:
        """Return the number of items in the list"""
        return getattr(instance, "item_count", None) or instance.resources.count()

    def create(self, validated_data):
        """Create a new user list"""
        User = get_user_model()

        request = self.context.get("request")
        if request and hasattr(request, "user") and isinstance(request.user, User):
            validated_data["author"] = request.user
            topics_data = validated_data.pop("topics", [])
            with transaction.atomic():
                userlist = super().create(validated_data)
                userlist.topics.set(
                    models.LearningResourceTopic.objects.filter(id__in=topics_data)
                )
            return userlist
        return None

    def update(self, instance, validated_data):
        """Update an existing user list"""
        request = self.context.get("request")
        validated_data["author"] = request.user
        topics_data = validated_data.pop("topics", None)
        with transaction.atomic():
            userlist = super().update(instance, validated_data)
            if topics_data is not None:
                userlist.topics.set(
                    models.LearningResourceTopic.objects.filter(id__in=topics_data)
                )
            return userlist

    class Meta:
        model = models.UserList
        exclude = ("resources", *COMMON_IGNORED_FIELDS)
        read_only_fields = ["author"]


class UserListRelationshipSerializer(serializers.ModelSerializer):
    """
    Serializer for UserListRelationship model
    """

    resource = LearningResourceSerializer(read_only=True, source="child")

    def create(self, validated_data):
        user_list = validated_data["parent"]
        items = models.UserListRelationship.objects.filter(parent=user_list)
        position = (
            items.aggregate(Max("position"))["position__max"] or items.count()
        ) + 1
        item, _ = models.UserListRelationship.objects.get_or_create(
            parent=validated_data["parent"],
            child=validated_data["child"],
            defaults={"position": position},
        )
        return item

    def update(self, instance, validated_data):
        position = validated_data["position"]
        with transaction.atomic():
            if position > instance.position:
                # move items between old & new positions up, inclusive of new position
                models.UserListRelationship.objects.filter(
                    position__lte=position, position__gt=instance.position
                ).update(position=F("position") - 1)
            else:
                models.UserListRelationship.objects.filter(
                    position__lt=instance.position, position__gte=position
                ).update(position=F("position") + 1)
            instance.position = position
            instance.save()

        return instance

    class Meta:
        model = models.UserListRelationship
        extra_kwargs = {"position": {"required": False}}
        exclude = COMMON_IGNORED_FIELDS


class BaseRelationshipRequestSerializer(serializers.Serializer):
    """
    Base class for validating requests that set relationships between
    learning resources
    """

    learning_resource_id = serializers.IntegerField()

    def validate_learning_resource_id(self, learning_resource_id):
        """Ensure that the learning resource exists"""
        try:
            models.LearningResource.objects.get(id=learning_resource_id)
        except models.LearningResource.DoesNotExist as dne:
            msg = f"Invalid learning resource id: {learning_resource_id}"
            raise ValidationError(msg) from dne
        return learning_resource_id


class SetLearningPathsRequestSerializer(BaseRelationshipRequestSerializer):
    """
    Validate request parameters for setting learning paths for a learning resource
    """

    learning_path_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=True
    )

    def validate_learning_path_ids(self, learning_path_ids):
        """Ensure that the learning paths exist"""
        valid_learning_path_ids = set(
            models.LearningResource.objects.filter(
                id__in=learning_path_ids,
                resource_type=LearningResourceType.learning_path.name,
            ).values_list("id", flat=True)
        )
        missing = set(learning_path_ids).difference(valid_learning_path_ids)
        if missing:
            msg = f"Invalid learning path ids: {missing}"
            raise ValidationError(msg)
        return learning_path_ids


class SetUserListsRequestSerializer(BaseRelationshipRequestSerializer):
    """
    Validate request parameters for setting userlist for a learning resource
    """

    userlist_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=True
    )

    def validate_userlist_ids(self, userlist_ids):
        """Ensure that the learning paths exist"""
        valid_userlist_ids = set(
            models.UserList.objects.filter(
                id__in=userlist_ids,
            ).values_list("id", flat=True)
        )
        missing = set(userlist_ids).difference(valid_userlist_ids)
        if missing:
            msg = f"Invalid learning path ids: {missing}"
            raise ValidationError(msg)
        return userlist_ids
