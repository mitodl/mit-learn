"""Tests for video_shorts API functions"""

import json

import pytest
from rest_framework.exceptions import ValidationError

from video_shorts.api import upsert_video_short, walk_video_shorts_from_s3
from video_shorts.models import VideoShort

pytestmark = [pytest.mark.django_db]


def test_upsert_video_short_creates_new(settings, sample_video_metadata):
    """Test process_video_short creates a new VideoShort"""

    video_short = upsert_video_short(sample_video_metadata)

    assert video_short.video_id == "k_AA4_fQIHc"
    assert video_short.title == "How far away is space?"
    assert (
        video_short.thumbnail_large_url == "/shorts/k_AA4_fQIHc/k_AA4_fQIHc_large.jpg"
    )
    assert video_short.video_url == "/shorts/k_AA4_fQIHc/k_AA4_fQIHc.mp4"
    assert VideoShort.objects.count() == 1


def test_upsert_video_short_updates_existing(settings, sample_video_metadata):
    """Test process_video_short updates existing VideoShort"""
    import copy

    # Create initial version
    updated_metadata = copy.deepcopy(sample_video_metadata)
    updated_metadata["title"] = "Updated Title"

    first_short = upsert_video_short(sample_video_metadata)
    assert VideoShort.objects.count() == 1
    original_created_on = first_short.created_on

    updated_short = upsert_video_short(updated_metadata)

    assert VideoShort.objects.count() == 1  # Still only one
    assert updated_short.video_id == first_short.video_id
    assert updated_short.title == "Updated Title"
    assert updated_short.created_on == original_created_on  # Not changed


def test_process_video_short_invalid_metadata_raises(settings):
    """Test process_video_short raises ValidationError for invalid data"""
    invalid_data = {
        "id": "test_id",
        "youtube_metadata": {},
        "source": "youtube_shorts",
        # Missing required fields like 'title'
    }

    with pytest.raises(ValidationError):
        upsert_video_short(invalid_data)


@pytest.mark.parametrize(
    ("s3_prefix", "shorts_prefix"),
    [
        ("media", "shorts/"),
        ("media/", "shorts"),
        ("media", "video_shorts/"),
        (None, "shorts"),
    ],
)
def test_walk_video_shorts_from_s3(
    mock_s3_bucket, settings, sample_video_metadata, s3_prefix, shorts_prefix
):
    """Test walk_video_shorts_from_s3 processes S3 objects"""
    settings.AWS_S3_PREFIX = s3_prefix
    settings.VIDEO_SHORTS_S3_PREFIX = shorts_prefix
    settings.VIDEO_SHORTS_COUNT = 3

    # Upload test files with different timestamps
    metadata_json = json.dumps(sample_video_metadata)
    base_prefix = ((s3_prefix or "").strip("/") + "/" + shorts_prefix.strip("/")).strip(
        "/"
    )

    for i in range(2):
        mock_s3_bucket.put_object(
            Key=f"{base_prefix}/video{i}/video{i}.json",
            Body=metadata_json.encode("utf-8"),
        )
    mock_s3_bucket.put_object(
        Key=f"{base_prefix}/video3/video3.mp4",  # Not a .json file
        Body=b"fake video data",
    )

    # Execute
    shorts = list(walk_video_shorts_from_s3())

    # Should have processed 2 .json files
    assert len(shorts) == 2
    assert all(isinstance(short, VideoShort) for short in shorts)


def test_walk_video_shorts_from_s3_respects_count_limit(
    mock_s3_bucket, settings, sample_video_metadata
):
    """Test walk_video_shorts_from_s3 respects VIDEO_SHORTS_COUNT setting"""
    settings.VIDEO_SHORTS_COUNT = 2  # Limit to 2

    # Upload 5 JSON files
    metadata_json = json.dumps(sample_video_metadata)
    for i in range(5):
        mock_s3_bucket.put_object(
            Key=f"media/shorts/video{i}/video{i}.json",
            Body=metadata_json.encode("utf-8"),
        )

    # Execute
    shorts = list(walk_video_shorts_from_s3())

    # Should stop at the limit
    assert len(shorts) == 2


def test_walk_video_shorts_from_s3_orders_by_last_modified(
    mock_s3_bucket, sample_video_metadata
):
    """Test walk_video_shorts_from_s3 processes newest files first"""
    import copy
    import time

    # Upload older file first
    older_metadata = copy.deepcopy(sample_video_metadata)
    older_metadata["video_id"] = "old_video"
    mock_s3_bucket.put_object(
        Key="media/shorts/old/old.json",
        Body=json.dumps(older_metadata).encode("utf-8"),
    )

    # Small delay to ensure different timestamps
    time.sleep(0.1)

    # Upload newer file
    newer_metadata = copy.deepcopy(sample_video_metadata)
    newer_metadata["video_id"] = "new_video"
    mock_s3_bucket.put_object(
        Key="media/shorts/new/new.json",
        Body=json.dumps(newer_metadata).encode("utf-8"),
    )

    # Execute
    shorts = list(walk_video_shorts_from_s3())

    # Newer file should be processed first
    assert shorts[0].video_id == "new_video"
    assert shorts[1].video_id == "old_video"


def test_walk_video_shorts_from_s3_handles_errors_gracefully(
    mock_s3_bucket, sample_video_metadata
):
    """Test walk_video_shorts_from_s3 continues on error"""
    # Upload good file with valid metadata
    mock_s3_bucket.put_object(
        Key="media/shorts/good/good.json",
        Body=json.dumps(sample_video_metadata).encode("utf-8"),
    )

    # Upload bad file with invalid JSON that will cause an error
    mock_s3_bucket.put_object(
        Key="media/shorts/bad/bad.json",
        Body=b"invalid json{",
    )

    # Execute - should not raise
    shorts = list(walk_video_shorts_from_s3())

    # Should have processed only the good one
    assert len(shorts) == 1


def test_walk_video_shorts_from_s3_extracts_video_metadata(
    mock_s3_bucket, sample_video_metadata
):
    """Test walk_video_shorts_from_s3 extracts video_metadata from webhook envelope"""
    # Upload a file using the webhook envelope format
    envelope_data = {
        "video_id": sample_video_metadata["video_id"],
        "video_metadata": sample_video_metadata,
        "source": "video_shorts",
    }
    mock_s3_bucket.put_object(
        Key="media/shorts/video/video.json",
        Body=json.dumps(envelope_data).encode("utf-8"),
    )

    shorts = list(walk_video_shorts_from_s3())

    assert len(shorts) == 1
    assert shorts[0].video_id == "k_AA4_fQIHc"
    assert shorts[0].title == "How far away is space?"


def test_walk_video_shorts_from_s3_filters_non_json_files(
    mock_s3_bucket, sample_video_metadata
):
    """Test walk_video_shorts_from_s3 only processes .json files"""
    # Upload files of different types
    mock_s3_bucket.put_object(
        Key="media/shorts/video/video.json",
        Body=json.dumps(sample_video_metadata).encode("utf-8"),
    )
    mock_s3_bucket.put_object(
        Key="media/youtube_shorts/video/video.mp4",
        Body=b"fake video data",
    )
    # Execute
    shorts = list(walk_video_shorts_from_s3())

    # Should only process the .json file
    assert len(shorts) == 1
