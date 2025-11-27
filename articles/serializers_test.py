from rest_framework import serializers

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from articles.serializers import SanitizedHtmlField
from io import BytesIO
from PIL import Image

from articles.serializers import ArticleImageUploadSerializer
from articles.models import ArticleImageUpload


class HTMLSantizingSerializer(serializers.Serializer):
    html = SanitizedHtmlField()


def test_html_sanitization():
    serializer = HTMLSantizingSerializer(
        data={"html": "<p><script>console.error('danger!')</script></p>"}
    )
    serializer.is_valid()

    assert serializer.data["html"] == "<p></p>"

def generate_test_image():
    """Create a valid in-memory JPEG image."""
    file = BytesIO()
    image = Image.new("RGB", (100, 100), color="red")
    image.save(file, "JPEG")
    file.seek(0)
    return SimpleUploadedFile(
        "test.jpg",
        file.read(),
        content_type="image/jpeg",
    )


@pytest.mark.django_db
def test_article_image_upload_serializer(django_user_model):
    image_file = generate_test_image()

    user = django_user_model.objects.create_user(
        username="testuser",
        email="user@example.com",
        password="password123",  # noqa: S106
    )


    class FakeRequest:
        pass

    request = FakeRequest()
    request.user = user

    serializer = ArticleImageUploadSerializer(
        data={"image_file": image_file},
        context={"request": request},
    )

    assert serializer.is_valid(), serializer.errors

    instance = serializer.save()

    assert isinstance(instance, ArticleImageUpload)
    assert instance.user == user
    # ✅ Check for valid saved file
    assert instance.image_file
    assert instance.image_file.name.endswith(".jpg")
