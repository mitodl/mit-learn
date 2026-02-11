from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from articles import models
from articles.validators import clean_html

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


class RichTextArticleSerializer(serializers.ModelSerializer):
    """
    Serializer for LearningResourceInstructor model
    """

    created_on = serializers.DateTimeField(read_only=True, required=False)
    updated_on = serializers.DateTimeField(read_only=True, required=False)
    publish_date = serializers.DateTimeField(read_only=True, required=False)
    content = serializers.JSONField(default={})
    slug = serializers.SlugField(max_length=60, required=False, allow_blank=True)
    title = serializers.CharField(max_length=255)
    author_name = serializers.CharField(required=False, allow_blank=True, default="")
    user = UserSerializer(read_only=True)

    class Meta:
        model = models.Article
        fields = [
            "id",
            "title",
            "author_name",
            "content",
            "user",
            "created_on",
            "updated_on",
            "publish_date",
            "is_published",
            "slug",
        ]


class ArticleImageUploadSerializer(serializers.Serializer):
    image_file = serializers.ImageField(required=True)

    def create(self, validated_data):
        user = self.context.get("request").user
        return models.ArticleImageUpload.objects.create(
            user=user,
            image_file=validated_data["image_file"],
        )
