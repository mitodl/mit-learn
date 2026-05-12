from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from website_content import models
from website_content.constants import CONTENT_TYPE_NEWS
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


class WebsiteContentSerializer(serializers.ModelSerializer):
    """
    Serializer for WebsiteContent model.
    """

    created_on = serializers.DateTimeField(read_only=True, required=False)
    updated_on = serializers.DateTimeField(read_only=True, required=False)
    publish_date = serializers.DateTimeField(read_only=True, required=False)
    content = serializers.JSONField(default={})
    slug = serializers.SlugField(max_length=60, required=False, allow_blank=True)
    title = serializers.CharField(max_length=255)
    author_name = serializers.CharField(required=False, allow_blank=True, default="")
    user = UserSerializer(read_only=True)
    content_type = serializers.ChoiceField(
        choices=["news", "article"],
        default=CONTENT_TYPE_NEWS,
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
        ]


class WebsiteContentImageUploadSerializer(serializers.Serializer):
    image_file = serializers.ImageField(required=True)

    def create(self, validated_data):
        user = self.context.get("request").user
        return models.WebsiteContentImageUpload.objects.create(
            user=user,
            image_file=validated_data["image_file"],
        )
