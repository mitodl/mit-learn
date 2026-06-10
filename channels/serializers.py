"""Serializers for channels"""

import logging

from drf_spectacular.utils import extend_schema_field, inline_serializer
from rest_framework import serializers

from channels.constants import ChannelType
from channels.models import (
    Channel,
    ChannelDepartmentDetail,
    ChannelPathwayDetail,
    ChannelTopicDetail,
    ChannelUnitDetail,
    SubChannel,
)
from learning_resources.models import (
    LearningResource,
)
from learning_resources.serializers import LearningResourceOfferorDetailSerializer
from main.serializers import COMMON_IGNORED_FIELDS

log = logging.getLogger(__name__)


class ChannelTypeConstantField(serializers.ReadOnlyField):
    """Field for Channel.channel_type"""


class LearningPathPreviewSerializer(serializers.ModelSerializer):
    """Serializer for a minimal preview of Learning Paths"""

    class Meta:
        model = LearningResource
        fields = ("title", "url", "id")


class ChannelAppearanceMixin(serializers.Serializer):
    """Serializer mixin for channel appearance"""

    avatar = serializers.SerializerMethodField()
    avatar_small = serializers.SerializerMethodField()
    avatar_medium = serializers.SerializerMethodField()
    banner = serializers.SerializerMethodField()

    def get_avatar(self, channel) -> str | None:
        """Get the avatar image URL"""
        return channel.avatar.url if channel.avatar else None

    def get_avatar_small(self, channel) -> str | None:
        """Get the avatar image small URL"""
        return channel.avatar_small.url if channel.avatar_small else None

    def get_avatar_medium(self, channel) -> str | None:
        """Get the avatar image medium URL"""
        return channel.avatar_medium.url if channel.avatar_medium else None

    def get_banner(self, channel) -> str | None:
        """Get the banner image URL"""
        return channel.banner.url if channel.banner else None


class SubChannelSerializer(serializers.ModelSerializer):
    """Serializer for SubChannels"""

    parent_channel = serializers.SlugRelatedField(
        many=False, read_only=True, slug_field="name"
    )

    channel = serializers.SlugRelatedField(
        many=False, read_only=True, slug_field="name"
    )

    class Meta:
        model = SubChannel
        fields = ("parent_channel", "channel", "position")


class ChannelBaseSerializer(ChannelAppearanceMixin, serializers.ModelSerializer):
    """Serializer for Channel"""

    lists = serializers.SerializerMethodField()
    channel_url = serializers.SerializerMethodField(read_only=True)
    featured_list = LearningPathPreviewSerializer(
        allow_null=True,
        many=False,
        read_only=True,
        help_text="Learning path featured in this channel.",
    )
    sub_channels = SubChannelSerializer(many=True, read_only=True)

    @extend_schema_field(LearningPathPreviewSerializer(many=True))
    def get_lists(self, instance):
        """Return the channel's list of LearningPaths"""
        return [
            LearningPathPreviewSerializer(channel_list).data
            for channel_list in instance.ordered_lists
        ]

    def get_channel_url(self, instance) -> str:
        """Get the URL for the channel"""
        return instance.channel_url

    class Meta:
        model = Channel
        exclude = ["published"]


class ChannelCountsSerializer(serializers.ModelSerializer):
    """
    Serializer for resource counts associated with Channel
    """

    counts = serializers.SerializerMethodField(read_only=True)
    channel_url = serializers.SerializerMethodField(read_only=True)

    def get_channel_url(self, instance) -> str:
        """Get the URL for the channel"""
        return instance.channel_url

    @extend_schema_field(
        inline_serializer(
            name="Counts",
            fields={
                "courses": serializers.IntegerField(),
                "programs": serializers.IntegerField(),
            },
        )
    )
    def get_counts(self, instance):
        if instance.channel_type == "unit":
            resources = instance.unit_detail.unit.learningresource_set.all()
        elif instance.channel_type == "department":
            resources = instance.department_detail.department.learningresource_set.all()
        elif instance.channel_type == "topic":
            resources = instance.topic_detail.topic.learningresource_set.all()
        course_count = resources.filter(course__isnull=False, published=True).count()
        program_count = resources.filter(program__isnull=False, published=True).count()
        return {"courses": course_count, "programs": program_count}

    class Meta:
        model = Channel
        exclude = [
            "avatar",
            "published",
            "banner",
            "about",
            "configuration",
            "public_description",
            "ga_tracking_id",
            "featured_list",
            "widget_list",
        ]


class ChannelTopicDetailSerializer(serializers.ModelSerializer):
    """Serializer for the ChannelTopicDetail model"""

    class Meta:
        model = ChannelTopicDetail
        exclude = ("channel", *COMMON_IGNORED_FIELDS)


class TopicChannelSerializer(ChannelBaseSerializer):
    """Serializer for Channel model of type topic"""

    channel_type = ChannelTypeConstantField(default=ChannelType.topic.name)
    topic_detail = ChannelTopicDetailSerializer()


class ChannelDepartmentDetailSerializer(serializers.ModelSerializer):
    """Serializer for the ChannelDepartmentDetail model"""

    class Meta:
        model = ChannelDepartmentDetail
        exclude = ("channel", *COMMON_IGNORED_FIELDS)


class DepartmentChannelSerializer(ChannelBaseSerializer):
    """Serializer for Channel model of type department"""

    channel_type = ChannelTypeConstantField(default=ChannelType.department.name)

    department_detail = ChannelDepartmentDetailSerializer()


class ChannelUnitDetailSerializer(serializers.ModelSerializer):
    """Serializer for the ChannelOfferorDetail model"""

    unit = LearningResourceOfferorDetailSerializer(read_only=True)

    class Meta:
        model = ChannelUnitDetail
        exclude = ("channel", *COMMON_IGNORED_FIELDS)


class UnitChannelSerializer(ChannelBaseSerializer):
    """Serializer for Channel model of type unit"""

    channel_type = ChannelTypeConstantField(default=ChannelType.unit.name)

    unit_detail = ChannelUnitDetailSerializer()


class ChannelPathwayDetailSerializer(serializers.ModelSerializer):
    """Serializer for the ChannelPathwayDetail model"""

    class Meta:
        model = ChannelPathwayDetail
        exclude = ("channel", *COMMON_IGNORED_FIELDS)


class PathwayChannelSerializer(ChannelBaseSerializer):
    """Serializer for Channel model of type pathway"""

    channel_type = ChannelTypeConstantField(default=ChannelType.pathway.name)

    pathway_detail = ChannelPathwayDetailSerializer()


class ChannelSerializer(serializers.Serializer):
    """Serializer for Channel"""

    serializer_cls_mapping = {
        serializer_cls().fields["channel_type"].default: serializer_cls
        for serializer_cls in (
            TopicChannelSerializer,
            DepartmentChannelSerializer,
            UnitChannelSerializer,
            PathwayChannelSerializer,
        )
    }

    def to_representation(self, instance):
        """Serialize a Channel based on channel_type"""
        serializer_cls = self.serializer_cls_mapping[instance.channel_type]

        return serializer_cls(instance=instance, context=self.context).data
