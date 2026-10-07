from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from mitol.common.serializers import BaseSerializer
from rest_framework import serializers

from learning_resources.models import LearningResourceTopic
from website_content import models
from website_content.constants import WebsiteContentType
from website_content.utils import inferred_seo_description, inferred_seo_title
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
    # What the editor wants search engines and link previews to show *instead
    # of* what the content already says. Blank rather than absent when unset,
    # so a consumer reads "" and does not have to handle null as well -- and
    # blank is meaningful here: it is what hands the field back to inference.
    seo_title_override = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    seo_description_override = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    # The values to actually use, resolved here so that every consumer agrees
    # on them rather than each reimplementing the fallback. Read-only: what is
    # stored is the override, because writing the inferred text back would
    # freeze it and a later title change would stop being reflected.
    seo_title = serializers.SerializerMethodField()
    seo_description = serializers.SerializerMethodField()
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

    # 255 is honest rather than inherited: both sources are capped there --
    # the override by its own column, the fallback by `title` -- so the
    # resolved value cannot be longer, and the response keeps the length it
    # documented when this was a plain model field.
    @extend_schema_field({"type": "string", "maxLength": 255})
    def get_seo_title(self, instance) -> str:
        """Resolve the SEO title: the editor's override, else the content title"""
        return instance.seo_title_override or inferred_seo_title(instance.title)

    @extend_schema_field(serializers.CharField())
    def get_seo_description(self, instance) -> str:
        """
        Resolve the SEO description: the override, else the banner's subheading

        Blank when neither is there -- a document with no subheading. The caller
        decides what to do about that; there is nothing better to infer from,
        and inventing something would put words in the editor's mouth.
        """
        return instance.seo_description_override or inferred_seo_description(
            instance.content
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
            "seo_title_override",
            "seo_description_override",
            "seo_title",
            "seo_description",
        ]


class WebsiteContentImageUploadSerializer(serializers.Serializer):
    image_file = serializers.ImageField(required=True)

    def create(self, validated_data):
        user = self.context.get("request").user
        return models.WebsiteContentImageUpload.objects.create(
            user=user,
            image_file=validated_data["image_file"],
        )
