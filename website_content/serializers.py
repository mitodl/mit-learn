from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from mitol.common.serializers import BaseSerializer
from rest_framework import serializers

from learning_resources.models import LearningResourceTopic
from website_content import models
from website_content.constants import WebsiteContentType
from website_content.validators import clean_html

User = get_user_model()


@extend_schema_field(str)
class SanitizedHtmlField(serializers.Field):
    @staticmethod
    def to_representation(value):
        return value

    def to_internal_value(self, data):
        return clean_html(data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name"]


class ManyPrimaryKeyRelatedField(serializers.ManyRelatedField):
    """
    A `many=True` related field that resolves every submitted id in one query.

    DRF's own `ManyRelatedField` defers to its child field per item, and
    `PrimaryKeyRelatedField.to_internal_value` runs a `.get()` of its own -- so
    a payload naming N topics costs N queries, which zeal reports as an N+1.

    Error codes and messages are the child's, so responses are unchanged: the
    only difference is the number of queries it takes to produce them.
    """

    def to_internal_value(self, data):
        if isinstance(data, str) or not hasattr(data, "__iter__"):
            self.fail("not_a_list", input_type=type(data).__name__)
        if not self.allow_empty and len(data) == 0:
            self.fail("empty")

        child = self.child_relation
        # Coerced up front: `in_bulk` raises ValueError on a non-numeric pk,
        # where the child returns a 400.
        pks = []
        for item in data:
            try:
                pks.append(int(item))
            except (TypeError, ValueError):
                child.fail("incorrect_type", data_type=type(item).__name__)

        objects = child.get_queryset().in_bulk(pks)
        for pk in pks:
            if pk not in objects:
                child.fail("does_not_exist", pk_value=pk)
        return [objects[pk] for pk in pks]


class WebsiteContentSerializer(BaseSerializer):
    """
    Serializer for WebsiteContent model.
    """

    # Neither write path leaves `topics` prefetched on its own: a created
    # instance has no prefetch cache, and UpdateModelMixin clears the one the
    # fetched instance had -- correctly, since the m2m may have just changed.
    # The viewset therefore hands write responses a freshly prefetched copy;
    # see WebsiteContentViewSet._reloaded_for_response.
    required_prefetches: list[str] = ["user", "topics"]

    created_on = serializers.DateTimeField(read_only=True, required=False)
    updated_on = serializers.DateTimeField(read_only=True, required=False)
    publish_date = serializers.DateTimeField(read_only=True, required=False)
    content = serializers.JSONField(default=dict)
    slug = serializers.SlugField(max_length=60, required=False, allow_blank=True)
    title = serializers.CharField(max_length=255)
    cover_image = serializers.URLField(
        max_length=2083, allow_blank=True, default="", read_only=True
    )
    author_name = serializers.CharField(required=False, allow_blank=True, default="")
    user = UserSerializer(read_only=True)
    content_type = serializers.ChoiceField(
        choices=WebsiteContentType.as_tuple(),
        default=WebsiteContentType.news.name,
        required=False,
    )
    # Ids, not nested objects: the editor picks topics by id and only needs to
    # round-trip its own selections. The parent chain is added downstream when
    # the content is projected into a LearningResource.
    topics = ManyPrimaryKeyRelatedField(
        child_relation=serializers.PrimaryKeyRelatedField(
            queryset=LearningResourceTopic.objects.all(),
        ),
        required=False,
    )

    class Meta:
        model = models.WebsiteContent
        fields = [
            "id",
            "title",
            "author_name",
            "content",
            "content_type",
            "user",
            "created_on",
            "updated_on",
            "publish_date",
            "is_published",
            "slug",
            "cover_image",
            "topics",
        ]


class WebsiteContentImageUploadSerializer(serializers.Serializer):
    image_file = serializers.ImageField(required=True)

    def create(self, validated_data):
        user = self.context.get("request").user
        return models.WebsiteContentImageUpload.objects.create(
            user=user,
            image_file=validated_data["image_file"],
        )
