"""Tests for video_shorts.models"""

from datetime import UTC, datetime

import pytest
from django.core.exceptions import ValidationError
from django.db import DataError, IntegrityError

from video_shorts.factories import VideoShortFactory
from video_shorts.models import VideoShort

pytestmark = [pytest.mark.django_db]


def test_video_short_creation():
    """Test that a VideoShort can be created with all required fields"""
    video_short = VideoShortFactory.create()
    assert video_short.youtube_id is not None
    assert video_short.title is not None
    assert video_short.description is not None
    assert video_short.published_at is not None
    assert video_short.thumbnail_url is not None
    assert video_short.thumbnail_height is not None
    assert video_short.thumbnail_width is not None
    assert video_short.video_url is not None
    assert video_short.created_on is not None
    assert video_short.updated_on is not None


def test_video_short_str():
    """Test the string representation of VideoShort"""
    video_short = VideoShortFactory.create(
        youtube_id="abc123",
        title="Test Video Title",
    )
    assert str(video_short) == "Test Video Title (abc123)"


def test_video_short_youtube_id_primary_key():
    """Test that youtube_id is the primary key"""
    video_short = VideoShortFactory.create(youtube_id="unique_id_123")
    assert video_short.pk == "unique_id_123"

    # Retrieve by pk should work with youtube_id
    retrieved = VideoShort.objects.get(pk="unique_id_123")
    assert retrieved.youtube_id == "unique_id_123"


def test_video_short_unique_youtube_id():
    """Test that youtube_id must be unique"""
    VideoShortFactory.create(youtube_id="duplicate_id")

    with pytest.raises(IntegrityError):
        VideoShortFactory.create(youtube_id="duplicate_id")


def test_video_short_description_can_be_blank():
    """Test that description field can be blank"""
    video_short = VideoShortFactory.create(description="")
    assert video_short.description == ""
    video_short.save()  # Should not raise


def test_video_short_ordering_by_published_at():
    """Test ordering video shorts by published_at"""
    older = VideoShortFactory.create(
        youtube_id="older",
        published_at=datetime(2023, 1, 1, tzinfo=UTC),
    )
    newer = VideoShortFactory.create(
        youtube_id="newer",
        published_at=datetime(2024, 1, 1, tzinfo=UTC),
    )

    shorts = list(VideoShort.objects.all().order_by("-published_at"))
    assert shorts[0].youtube_id == newer.youtube_id
    assert shorts[1].youtube_id == older.youtube_id


def test_video_short_max_youtube_id_length():
    """Test that youtube_id respects max_length of 20"""
    # 20 characters should work
    video_short = VideoShortFactory.create(youtube_id="a" * 20)
    assert len(video_short.youtube_id) == 20

    # 21 characters should fail during validation
    with pytest.raises((ValidationError, DataError)):
        VideoShortFactory.create(youtube_id="a" * 21)


def test_video_short_max_title_length():
    """Test that title respects max_length of 255"""
    # 255 characters should work
    long_title = "a" * 255
    video_short = VideoShortFactory.create(title=long_title)
    assert len(video_short.title) == 255

    # 256 characters should fail during validation
    with pytest.raises((DataError, ValidationError)):
        VideoShortFactory.create(title="a" * 256)


def test_video_short_timestamps():
    """Test that TimestampedModel fields are set correctly"""
    video_short = VideoShortFactory.create()

    assert video_short.created_on is not None
    assert video_short.updated_on is not None
    assert video_short.created_on <= video_short.updated_on
