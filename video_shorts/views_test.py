"""Tests for video_shorts views"""

import pytest
from django.urls import reverse

from main.test_utils import assert_json_equal
from video_shorts.factories import VideoShortFactory
from video_shorts.serializers import VideoShortSerializer

pytestmark = [pytest.mark.django_db]


def test_video_short_viewset_list(client):
    """Test listing video shorts"""
    # Create test data
    videos = sorted(
        VideoShortFactory.create_batch(3), key=lambda x: x.published_at, reverse=True
    )

    url = reverse("video_shorts:v0:video_shorts_api-list")
    response = client.get(url)

    assert response.status_code == 200
    data = response.json()

    # Should be ordered by -published_at (newest first)
    for idx, result in enumerate(data["results"]):
        assert result["youtube_id"] == videos[idx].youtube_id
        if idx > 0:
            assert videos[idx].published_at <= videos[idx - 1].published_at


def test_video_short_viewset_list_pagination_default(client):
    """Test default pagination limit of 12"""
    # Create 15 video shorts
    VideoShortFactory.create_batch(15)

    url = reverse("video_shorts:v0:video_shorts_api-list")
    response = client.get(url)

    assert response.status_code == 200
    data = response.json()

    # Default limit is 12
    assert len(data["results"]) == 12
    assert data["count"] == 15
    assert data["next"] is not None


def test_video_short_viewset_retrieve(client):
    """Test retrieving a single video short"""
    video_short = VideoShortFactory.create()

    url = reverse(
        "video_shorts:v0:video_shorts_api-detail", kwargs={"pk": video_short.youtube_id}
    )
    response = client.get(url)

    assert_json_equal(
        response.json(),
        VideoShortSerializer(video_short).data,
    )


def test_video_short_viewset_retrieve_not_found(client):
    """Test retrieving a non-existent video short"""
    url = reverse(
        "video_shorts:v0:video_shorts_api-detail", kwargs={"pk": "nonexistent"}
    )
    response = client.get(url)

    assert response.status_code == 404


def test_video_short_viewset_list_serializer_format(client):
    """Test that list endpoint returns correctly serialized data"""
    video_shorts = sorted(
        VideoShortFactory.create_batch(3), key=lambda x: x.published_at, reverse=True
    )

    url = reverse("video_shorts:v0:video_shorts_api-list")
    response = client.get(url)

    results = response.json()["results"]
    assert len(results) == 3

    # Verify the serializer data matches
    video_short = results[0]
    serializer = VideoShortSerializer(video_shorts[0])
    assert_json_equal(video_short, serializer.data)


def test_video_short_viewset_readonly(client, user):
    """Test that viewset is read-only (no create/update/delete)"""
    serialized = VideoShortSerializer(VideoShortFactory.create()).data

    client.force_login(user)
    url = reverse("video_shorts:v0:video_shorts_api-list")
    for method in ["put", "patch", "post"]:
        response = getattr(client, method)(
            url, data=serialized, content_type="application/json"
        )
        assert response.status_code == 405
