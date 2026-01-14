"""Tests for video_shorts serializers"""

from datetime import UTC, datetime

import pytest

from main.test_utils import assert_json_equal
from video_shorts.api import VideoShortWebhookSerializer
from video_shorts.factories import VideoShortFactory
from video_shorts.models import VideoShort
from video_shorts.serializers import VideoShortSerializer

pytestmark = [pytest.mark.django_db]


def test_video_short_serializer_read():
    """Test VideoShortSerializer serializes model correctly"""
    video_short = VideoShortFactory.create(
        video_id="test_123",
        title="Test Video",
        published_at=datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC),
    )

    serializer = VideoShortSerializer(video_short)
    data = serializer.data

    data.pop("created_on")
    data.pop("updated_on")

    assert_json_equal(
        data,
        {
            "video_id": "test_123",
            "title": "Test Video",
            "published_at": "2024-01-15T12:00:00Z",
            "thumbnail_small_url": "/shorts/test_123/test_123_small.jpg",
            "thumbnail_large_url": "/shorts/test_123/test_123_large.jpg",
            "video_url": "/shorts/test_123/test_123.mp4",
        },
    )


def test_video_short_serializer_create():
    """Test VideoShortWebhookSerializer creates VideoShort correctly"""
    data = {
        "video_id": "create_test",
        "title": "Created Video",
        "published_at": "2024-01-15T12:00:00Z",
        "thumbnail_small": {
            "url": "/shorts/create_test/create_test_small.jpg",
            "height": 480,
            "width": 270,
        },
        "thumbnail_large": {
            "url": "/shorts/create_test/create_test_large.jpg",
            "height": 1920,
            "width": 1080,
        },
        "video_url": "/shorts/create_test/create_test.mp4",
    }

    serializer = VideoShortWebhookSerializer(data=data)
    assert serializer.is_valid(raise_exception=True)
    assert (
        serializer.validated_data["video_url"] == "/shorts/create_test/create_test.mp4"
    )
    video_short = serializer.save()
    assert video_short.video_url == "/shorts/create_test/create_test.mp4"
    assert (
        video_short.thumbnail_small_url == "/shorts/create_test/create_test_small.jpg"
    )
    assert (
        video_short.thumbnail_large_url == "/shorts/create_test/create_test_large.jpg"
    )

    # Verify object was created
    assert VideoShort.objects.filter(video_id="create_test").exists()

    # Serialize the created object and compare
    result_serializer = VideoShortWebhookSerializer(video_short)
    result_data = result_serializer.data
    result_data.pop("created_on")
    result_data.pop("updated_on")

    expected_data = {
        "video_url": "/shorts/create_test/create_test.mp4",
        "thumbnail_small_url": "/shorts/create_test/create_test_small.jpg",
        "thumbnail_large_url": "/shorts/create_test/create_test_large.jpg",
        **data,
    }

    assert_json_equal(result_data, expected_data)


def test_video_short_serializer_update():
    """Test VideoShortWebhookSerializer updates VideoShort correctly"""
    video_short = VideoShortFactory.create(
        video_id="update_test",
        title="Original Title",
    )

    # Get the serialized version of the original to ensure format consistency
    original_serializer = VideoShortSerializer(video_short)

    data = {
        "video_id": "update_test",
        "title": "Updated Title",
        "published_at": original_serializer.data["published_at"],
        "thumbnail_small": {
            "url": "/shorts/create_test/create_test_small.jpg",
            "height": 480,
            "width": 270,
        },
        "thumbnail_large": {
            "url": "/shorts/create_test/create_test_large.jpg",
            "height": 1920,
            "width": 1080,
        },
        "video_url": original_serializer.data["video_url"],
    }

    serializer = VideoShortWebhookSerializer(video_short, data=data)
    assert serializer.is_valid(raise_exception=True)
    updated = serializer.save()

    # Verify still only one instance
    assert VideoShort.objects.count() == 1

    # Verify the update worked
    assert updated.title == "Updated Title"

    # Serialize the updated object and compare
    result_serializer = VideoShortSerializer(updated)
    result_data = result_serializer.data
    result_data.pop("created_on")
    result_data.pop("updated_on")

    assert_json_equal(result_data, data)
