from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import serializers

from website_content.models import WebsiteContentImageUpload
from website_content.serializers import (
    SanitizedHtmlField,
    WebsiteContentImageUploadSerializer,
)


class HTMLSanitizingSerializer(serializers.Serializer):
    html = SanitizedHtmlField()


def test_html_sanitization():
    serializer = HTMLSanitizingSerializer(
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
def test_website_content_image_upload_serializer(django_user_model):
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

    serializer = WebsiteContentImageUploadSerializer(
        data={"image_file": image_file},
        context={"request": request},
    )

    assert serializer.is_valid(), serializer.errors

    instance = serializer.save()

    assert isinstance(instance, WebsiteContentImageUpload)
    assert instance.user == user
    assert instance.image_file
    assert instance.image_file.name.endswith(".jpg")
