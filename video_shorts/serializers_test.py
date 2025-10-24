"""Tests for video_shorts serializers"""

from datetime import UTC, datetime

import pytest

from main.test_utils import assert_json_equal
from video_shorts.factories import VideoShortFactory
from video_shorts.models import VideoShort
from video_shorts.serializers import (
    VideoShortSerializer,
    YouTubeMetadataSerializer,
)

pytestmark = [pytest.mark.django_db]


def test_video_short_serializer_read():
    """Test VideoShortSerializer serializes model correctly"""
    video_short = VideoShortFactory.create(
        youtube_id="test_123",
        title="Test Video",
        description="Test description",
        published_at=datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC),
        thumbnail_url="https://example.com/thumb.jpg",
        thumbnail_height=360,
        thumbnail_width=480,
        video_url="https://example.com/video.mp4",
    )

    serializer = VideoShortSerializer(video_short)
    data = serializer.data

    data.pop("created_on")
    data.pop("updated_on")

    assert_json_equal(
        data,
        {
            "youtube_id": "test_123",
            "title": "Test Video",
            "description": "Test description",
            "published_at": "2024-01-15T12:00:00Z",
            "thumbnail_url": "https://example.com/thumb.jpg",
            "thumbnail_height": 360,
            "thumbnail_width": 480,
            "video_url": "https://example.com/video.mp4",
        },
    )


def test_video_short_serializer_create():
    """Test VideoShortSerializer creates VideoShort correctly"""
    data = {
        "youtube_id": "create_test",
        "title": "Created Video",
        "description": "Created description",
        "published_at": "2024-01-15T12:00:00Z",
        "thumbnail_url": "https://example.com/created_thumb.jpg",
        "thumbnail_height": 720,
        "thumbnail_width": 1280,
        "video_url": "https://example.com/created_video.mp4",
    }

    serializer = VideoShortSerializer(data=data)
    assert serializer.is_valid()
    video_short = serializer.save()

    # Verify object was created
    assert VideoShort.objects.filter(youtube_id="create_test").exists()

    # Serialize the created object and compare
    result_serializer = VideoShortSerializer(video_short)
    result_data = result_serializer.data
    result_data.pop("created_on")
    result_data.pop("updated_on")

    assert_json_equal(result_data, data)


def test_video_short_serializer_update():
    """Test VideoShortSerializer updates VideoShort correctly"""
    video_short = VideoShortFactory.create(
        youtube_id="update_test",
        title="Original Title",
        description="Original description",
    )

    # Get the serialized version of the original to ensure format consistency
    original_serializer = VideoShortSerializer(video_short)

    data = {
        "youtube_id": "update_test",
        "title": "Updated Title",
        "description": "Updated description",
        "published_at": original_serializer.data["published_at"],
        "thumbnail_url": video_short.thumbnail_url,
        "thumbnail_height": video_short.thumbnail_height,
        "thumbnail_width": video_short.thumbnail_width,
        "video_url": video_short.video_url,
    }

    serializer = VideoShortSerializer(video_short, data=data)
    assert serializer.is_valid()
    updated = serializer.save()

    # Verify still only one instance
    assert VideoShort.objects.count() == 1

    # Verify the update worked
    assert updated.title == "Updated Title"
    assert updated.description == "Updated description"

    # Serialize the updated object and compare
    result_serializer = VideoShortSerializer(updated)
    result_data = result_serializer.data
    result_data.pop("created_on")
    result_data.pop("updated_on")

    assert_json_equal(result_data, data)


def test_youtube_metadata_serializer(settings, sample_youtube_metadata):
    """Test YouTubeMetadataSerializer transforms YouTube API data correctly"""
    settings.VIDEO_SHORTS_S3_PREFIX = "youtube_shorts"

    serializer = YouTubeMetadataSerializer(data=sample_youtube_metadata)
    assert serializer.is_valid()

    # Check that the internal value was transformed correctly
    expected_data = {
        "youtube_id": "k_AA4_fQIHc",
        "title": "How far away is space?",
        "description": (
            "The Kármán line is 100 kilometers above Earth's surface. "
            "For context,  that distance is shorter than a trip between "
            "Boston and New York City or London and Paris.\n\n"
            "Keep learning about spaceflight with MIT Prof. Jeff Hoffman "
            "on MIT Learn: https://learn.mit.edu/search?resource=2766"
        ),
        "published_at": "2025-09-24T15:33:27Z",
        "thumbnail_height": 360,
        "thumbnail_width": 480,
        "video_url": "/youtube_shorts/k_AA4_fQIHc/k_AA4_fQIHc.mp4",
        "thumbnail_url": "/youtube_shorts/k_AA4_fQIHc/k_AA4_fQIHc.jpg",
    }

    assert_json_equal(serializer.validated_data, expected_data)

    # Verify it can save and create a VideoShort object
    video_short = serializer.save()
    assert video_short.youtube_id == "k_AA4_fQIHc"
    assert video_short.title == "How far away is space?"
    assert video_short.thumbnail_height == 360
    assert video_short.thumbnail_width == 480
    assert video_short.video_url == "/youtube_shorts/k_AA4_fQIHc/k_AA4_fQIHc.mp4"
    assert video_short.thumbnail_url == "/youtube_shorts/k_AA4_fQIHc/k_AA4_fQIHc.jpg"
