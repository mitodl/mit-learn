"""Tests for video_shorts serializers"""

from datetime import UTC, datetime

import pytest

from main.test_utils import assert_json_equal
from video_shorts.factories import VideoShortFactory
from video_shorts.models import VideoShort
from video_shorts.serializers import (
    VideoShortSerializer,
    YouTubeContentDetailsSerializer,
    YouTubeMetadataSerializer,
    YouTubeSnippetSerializer,
    YouTubeThumbnailSerializer,
    YouTubeThumbnailsSerializer,
)

pytestmark = [pytest.mark.django_db]


def test_youtube_thumbnail_serializer():
    """Test YouTubeThumbnailSerializer validation and serialization"""
    data = {
        "url": "https://i.ytimg.com/vi/test_id/default.jpg",
        "width": 120,
        "height": 90,
    }
    serializer = YouTubeThumbnailSerializer(data=data)
    assert serializer.is_valid(), serializer.errors
    assert_json_equal(
        serializer.validated_data,
        {
            "url": "https://i.ytimg.com/vi/test_id/default.jpg",
            "width": 120,
            "height": 90,
        },
    )


def test_youtube_thumbnails_serializer_all_resolutions():
    """Test YouTubeThumbnailsSerializer with all thumbnail resolutions"""
    data = {
        "default": {
            "url": "https://i.ytimg.com/vi/test/default.jpg",
            "width": 120,
            "height": 90,
        },
        "medium": {
            "url": "https://i.ytimg.com/vi/test/mqdefault.jpg",
            "width": 320,
            "height": 180,
        },
        "high": {
            "url": "https://i.ytimg.com/vi/test/hqdefault.jpg",
            "width": 480,
            "height": 360,
        },
        "standard": {
            "url": "https://i.ytimg.com/vi/test/sddefault.jpg",
            "width": 640,
            "height": 480,
        },
        "maxres": {
            "url": "https://i.ytimg.com/vi/test/maxresdefault.jpg",
            "width": 1280,
            "height": 720,
        },
    }
    serializer = YouTubeThumbnailsSerializer(data=data)
    assert serializer.is_valid(), serializer.errors
    assert_json_equal(serializer.validated_data, data)


def test_youtube_snippet_serializer_complete():
    """Test YouTubeSnippetSerializer with complete data"""
    data = {
        "publishedAt": "2025-09-24T15:33:27Z",
        "channelId": "UCN0QBfKk0ZSytyX_16M11fA",
        "title": "How far away is space?",
        "description": "The Kármán line is 100 kilometers above Earth's surface.",
        "thumbnails": {
            "default": {
                "url": "https://i.ytimg.com/vi/test/default.jpg",
                "width": 120,
                "height": 90,
            },
            "high": {
                "url": "https://i.ytimg.com/vi/test/hqdefault.jpg",
                "width": 480,
                "height": 360,
            },
        },
        "channelTitle": "MIT Open Learning",
        "categoryId": "27",
        "liveBroadcastContent": "none",
        "defaultLanguage": "en",
        "defaultAudioLanguage": "en",
        "localized": {
            "title": "How far away is space?",
            "description": "The Kármán line is 100 kilometers above Earth's surface.",
        },
    }
    serializer = YouTubeSnippetSerializer(data=data)
    assert serializer.is_valid(), serializer.errors

    assert_json_equal(
        serializer.validated_data,
        {
            "published_at": "2025-09-24T15:33:27Z",
            "channel_id": "UCN0QBfKk0ZSytyX_16M11fA",
            "title": "How far away is space?",
            "description": "The Kármán line is 100 kilometers above Earth's surface.",
            "thumbnails": {
                "default": {
                    "url": "https://i.ytimg.com/vi/test/default.jpg",
                    "width": 120,
                    "height": 90,
                },
                "high": {
                    "url": "https://i.ytimg.com/vi/test/hqdefault.jpg",
                    "width": 480,
                    "height": 360,
                },
            },
            "channel_title": "MIT Open Learning",
            "category_id": "27",
            "live_broadcast_content": "none",
            "default_language": "en",
            "default_audio_language": "en",
            "localized": {
                "title": "How far away is space?",
                "description": "The Kármán line is 100 kilometers above Earth's surface.",
            },
        },
    )


@pytest.mark.parametrize(
    ("camel_case_field", "snake_case_field"),
    [
        ("licensedContent", "licensed_content"),
        ("contentRating", "content_rating"),
    ],
)
def test_youtube_content_details_serializer_camel_case_conversion(
    camel_case_field, snake_case_field
):
    """Test YouTubeContentDetailsSerializer converts camelCase to snake_case"""
    data = {
        "duration": "PT59S",
        "dimension": "2d",
        "definition": "hd",
        "caption": "false",
        "projection": "rectangular",
        "licensedContent": True,
        "contentRating": {},
    }
    serializer = YouTubeContentDetailsSerializer(data=data)
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data[snake_case_field] == data[camel_case_field]


def test_youtube_content_details_serializer_complete():
    """Test YouTubeContentDetailsSerializer with complete data"""
    data = {
        "caption": "false",
        "contentRating": {},
        "definition": "hd",
        "dimension": "2d",
        "duration": "PT59S",
        "licensedContent": False,
        "projection": "rectangular",
    }
    serializer = YouTubeContentDetailsSerializer(data=data)
    assert serializer.is_valid()

    assert_json_equal(
        serializer.validated_data,
        {
            "duration": "PT59S",
            "dimension": "2d",
            "definition": "hd",
            "caption": "false",
            "licensed_content": False,
            "content_rating": {},
            "projection": "rectangular",
        },
    )


def test_youtube_metadata_serializer_camel_case_conversion(sample_youtube_metadata):
    """Test YouTubeMetadataSerializer converts contentDetails to content_details"""
    serializer = YouTubeMetadataSerializer(data=sample_youtube_metadata)
    assert serializer.is_valid(), serializer.errors
    # Verify that the camelCase field was converted to snake_case key
    assert "content_details" in serializer.validated_data
    # Verify nested camelCase was also converted
    assert (
        serializer.validated_data["content_details"]["licensed_content"]
        == sample_youtube_metadata["contentDetails"]["licensedContent"]
    )


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
    assert serializer.is_valid(), serializer.errors
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
    assert serializer.is_valid(), serializer.errors
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


@pytest.mark.parametrize(
    "thumbnail_priority",
    [
        ({"high": {"url": "http://high.jpg", "width": 480, "height": 360}}, 480, 360),
        (
            {
                "medium": {"url": "http://med.jpg", "width": 320, "height": 180},
                "default": {"url": "http://def.jpg", "width": 120, "height": 90},
            },
            320,
            180,
        ),
        ({"default": {"url": "http://def.jpg", "width": 120, "height": 90}}, 120, 90),
    ],
)
def test_video_short_serializer_transform_youtube_data_thumbnail_priority(
    settings, thumbnail_priority
):
    """Test transform_youtube_data selects correct thumbnail resolution"""
    thumbnails, expected_width, expected_height = thumbnail_priority
    settings.VIDEO_SHORTS_S3_PREFIX = "youtube_shorts"

    youtube_data = {
        "id": "priority_test",
        "snippet": {
            "published_at": datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC),
            "title": "Priority Test",
            "description": "Testing thumbnail priority",
            "thumbnails": thumbnails,
        },
    }

    serializer = VideoShortSerializer.transform_youtube_data(youtube_data)
    assert serializer.is_valid(), serializer.errors

    # Just verify the thumbnail dimensions match expected
    assert serializer.validated_data["thumbnail_width"] == expected_width
    assert serializer.validated_data["thumbnail_height"] == expected_height


def test_video_short_serializer_transform_youtube_data_with_sample_data(
    settings, sample_youtube_metadata
):
    """Test transform_youtube_data with the complete sample webhook data"""
    settings.VIDEO_SHORTS_S3_PREFIX = "youtube_shorts"

    # First validate with YouTubeMetadataSerializer (as webhook does)
    metadata_serializer = YouTubeMetadataSerializer(data=sample_youtube_metadata)
    assert metadata_serializer.is_valid(), metadata_serializer.errors

    # Then transform
    serializer = VideoShortSerializer.transform_youtube_data(
        metadata_serializer.validated_data
    )
    assert serializer.is_valid(), serializer.errors

    video_short = serializer.save()

    # Serialize the created object
    result_serializer = VideoShortSerializer(video_short)
    result_data = result_serializer.data
    result_data.pop("created_on")
    result_data.pop("updated_on")

    assert_json_equal(
        result_data,
        {
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
            "thumbnail_height": 360,  # 'high' resolution selected
            "thumbnail_width": 480,
            "video_url": "/youtube_shorts/k_AA4_fQIHc/k_AA4_fQIHc.mp4",
            "thumbnail_url": "/youtube_shorts/k_AA4_fQIHc/k_AA4_fQIHc.jpg",
        },
    )
