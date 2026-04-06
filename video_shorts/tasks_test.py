"""Tests for video_shorts tasks"""

import pytest

from video_shorts.tasks import delete_video_short_from_s3

pytestmark = [pytest.mark.django_db]


@pytest.fixture
def s3_objects(mock_s3_bucket):
    """Populate mock S3 bucket with objects under a video short prefix."""
    prefix = "shorts/test_vid_001"
    keys = [
        f"{prefix}/test_vid_001.mp4",
        f"{prefix}/test_vid_001.json",
        f"{prefix}/test_vid_001_large.jpg",
        f"{prefix}/test_vid_001_small.jpg",
    ]
    for key in keys:
        mock_s3_bucket.put_object(Key=key, Body=b"test data")
    return keys


@pytest.mark.parametrize(
    ("video_url", "should_delete"),
    [
        ("/shorts/test_vid_001/test_vid_001.mp4", True),
        ("", False),
        ("/videos/test_vid_001/test_vid_001.mp4", False),
        ("/shorts/", False),
    ],
    ids=[
        "valid-url-deletes-objects",
        "empty-url-skips",
        "non-shorts-path-skips",
        "bare-shorts-prefix-skips",
    ],
)
def test_delete_video_short_from_s3(
    mock_s3_bucket, s3_objects, video_url, should_delete
):
    """Test that S3 objects are deleted only for valid shorts prefixes."""
    delete_video_short_from_s3(video_url)

    remaining = list(mock_s3_bucket.objects.all())
    if should_delete:
        assert len(remaining) == 0
    else:
        assert len(remaining) == len(s3_objects)


def test_delete_video_short_from_s3_no_matching_objects(mock_s3_bucket):
    """Test deletion with a valid prefix that has no matching objects."""
    delete_video_short_from_s3("/shorts/nonexistent/nonexistent.mp4")

    assert list(mock_s3_bucket.objects.all()) == []


def test_delete_video_short_from_s3_only_deletes_matching_prefix(mock_s3_bucket):
    """Test that only objects under the target prefix are deleted."""
    mock_s3_bucket.put_object(Key="shorts/vid_a/vid_a.mp4", Body=b"target")
    mock_s3_bucket.put_object(Key="shorts/vid_b/vid_b.mp4", Body=b"keep")

    delete_video_short_from_s3("/shorts/vid_a/vid_a.mp4")

    remaining = list(mock_s3_bucket.objects.all())
    assert len(remaining) == 1
    assert remaining[0].key == "shorts/vid_b/vid_b.mp4"
