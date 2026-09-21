from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import serializers

from learning_resources.factories import LearningResourceTopicFactory
from website_content.models import WebsiteContentImageUpload
from website_content.serializers import (
    SanitizedHtmlField,
    WebsiteContentImageUploadSerializer,
    WebsiteContentSerializer,
)


class HTMLSanitizingSerializer(serializers.Serializer):
    html = SanitizedHtmlField()


def test_html_sanitization():
    serializer = HTMLSanitizingSerializer(
        data={"html": "<p><script>console.error('danger!')</script></p>"}
    )
    serializer.is_valid()

    assert serializer.data["html"] == "<p></p>"


@pytest.mark.django_db
@pytest.mark.parametrize("topic_count", [1, 3])
def test_topics_resolve_in_one_query(django_assert_num_queries, topic_count):
    """
    Whatever the payload names, validating `topics` costs a single query.

    This is the whole reason `ManyPrimaryKeyRelatedField` exists: DRF's own
    `many=True` defers to the child field per item, and `PrimaryKeyRelatedField`
    runs a `.get()` each time, so N ids cost N queries -- an N+1 that zeal
    reports. Parametrized because one id passes either way; the count is what
    distinguishes them.
    """
    topics = LearningResourceTopicFactory.create_batch(topic_count)
    serializer = WebsiteContentSerializer(
        data={
            "title": "Topical",
            "content": {},
            "content_type": "news",
            "topics": [topic.id for topic in topics],
        }
    )

    with django_assert_num_queries(1):
        assert serializer.is_valid(), serializer.errors

    # Order is preserved, so a caller gets back what it sent.
    assert serializer.validated_data["topics"] == topics


@pytest.mark.django_db
def test_topics_reject_a_missing_id():
    """A single query still has to notice an id that resolves to nothing."""
    topic = LearningResourceTopicFactory.create()
    serializer = WebsiteContentSerializer(
        data={
            "title": "Topical",
            "content": {},
            "content_type": "news",
            "topics": [topic.id, topic.id + 1000],
        }
    )

    assert not serializer.is_valid()
    assert "topics" in serializer.errors


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
