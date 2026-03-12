"""Tests for OVS ETL functions"""

import json
from unittest.mock import Mock

import pytest

from learning_resources.constants import (
    Availability,
    LearningResourceType,
    PlatformType,
)
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.ovs import (
    _build_caption_urls,
    _duration_to_iso8601,
    _get_cover_image_url,
    _get_resource_url,
    _get_source_url,
    _transform_collection,
    _transform_video,
    extract,
    transform,
)
from main.test_utils import assert_json_equal

pytestmark = pytest.mark.django_db


@pytest.fixture
def ovs_api_response():
    """Load test OVS API response"""
    with open("./test_json/ovs_videos.json") as f:  # noqa: PTH123
        return json.load(f)


@pytest.fixture
def ovs_video_with_subtitles(ovs_api_response):
    """Return the first video (has thumbnails and subtitles)"""
    return ovs_api_response["results"][0]


@pytest.fixture
def ovs_video_without_subtitles(ovs_api_response):
    """Return the second video (no thumbnails or subtitles)"""
    return ovs_api_response["results"][1]


@pytest.fixture
def mock_ovs_api_response(mocker, ovs_api_response):
    """Mock the OVS API response"""
    mock_response = Mock()
    mock_response.json.return_value = ovs_api_response
    mock_response.raise_for_status.return_value = None
    mocker.patch(
        "learning_resources.etl.ovs.requests.get",
        return_value=mock_response,
    )
    return mock_response


class TestExtract:
    """Tests for extract function"""

    def test_extract_yields_public_complete_videos(
        self,
        mock_ovs_api_response,  # noqa: ARG002
        ovs_api_response,
    ):
        """Extract should yield all public, complete videos"""
        results = list(extract())
        assert len(results) == 2
        assert results[0]["key"] == ovs_api_response["results"][0]["key"]
        assert results[1]["key"] == ovs_api_response["results"][1]["key"]

    def test_extract_skips_non_public_videos(self, mocker):
        """Extract should skip videos that are not public"""
        api_data = {
            "count": 1,
            "next": None,
            "results": [
                {
                    "key": "private_video",
                    "is_public": False,
                    "status": "Complete",
                }
            ],
        }
        mock_response = Mock()
        mock_response.json.return_value = api_data
        mock_response.raise_for_status.return_value = None
        mocker.patch(
            "learning_resources.etl.ovs.requests.get",
            return_value=mock_response,
        )
        results = list(extract())
        assert len(results) == 0

    def test_extract_skips_incomplete_videos(self, mocker):
        """Extract should skip videos that are not Complete"""
        api_data = {
            "count": 1,
            "next": None,
            "results": [
                {
                    "key": "processing_video",
                    "is_public": True,
                    "status": "Processing",
                }
            ],
        }
        mock_response = Mock()
        mock_response.json.return_value = api_data
        mock_response.raise_for_status.return_value = None
        mocker.patch(
            "learning_resources.etl.ovs.requests.get",
            return_value=mock_response,
        )
        results = list(extract())
        assert len(results) == 0

    def test_extract_handles_pagination(self, mocker):
        """Extract should follow pagination"""
        page1 = {
            "count": 2,
            "next": "https://video-rc.odl.mit.edu/api/v0/public/videos/?page=2",
            "results": [{"key": "video1", "is_public": True, "status": "Complete"}],
        }
        page2 = {
            "count": 2,
            "next": None,
            "results": [{"key": "video2", "is_public": True, "status": "Complete"}],
        }
        mock_resp1 = Mock()
        mock_resp1.json.return_value = page1
        mock_resp1.raise_for_status.return_value = None
        mock_resp2 = Mock()
        mock_resp2.json.return_value = page2
        mock_resp2.raise_for_status.return_value = None

        mocker.patch(
            "learning_resources.etl.ovs.requests.get",
            side_effect=[mock_resp1, mock_resp2],
        )
        results = list(extract())
        assert len(results) == 2
        assert results[0]["key"] == "video1"
        assert results[1]["key"] == "video2"

    def test_extract_adds_exclude_resource_param(self, mocker):
        """Extract should add exclude_resource=youtube to the URL"""
        api_data = {"count": 0, "next": None, "results": []}
        mock_response = Mock()
        mock_response.json.return_value = api_data
        mock_response.raise_for_status.return_value = None
        mock_get = mocker.patch(
            "learning_resources.etl.ovs.requests.get",
            return_value=mock_response,
        )
        list(extract(url="https://video.odl.mit.edu/api/v0/public/videos/"))
        called_url = mock_get.call_args[0][0]
        assert "exclude_resource=youtube" in called_url

    def test_extract_preserves_existing_exclude_param(self, mocker):
        """Extract should not duplicate exclude_resource if already present"""
        api_data = {"count": 0, "next": None, "results": []}
        mock_response = Mock()
        mock_response.json.return_value = api_data
        mock_response.raise_for_status.return_value = None
        mock_get = mocker.patch(
            "learning_resources.etl.ovs.requests.get",
            return_value=mock_response,
        )
        url = "https://video.odl.mit.edu/api/v0/public/videos/?exclude_resource=youtube"
        list(extract(url=url))
        called_url = mock_get.call_args[0][0]
        assert called_url.count("exclude_resource") == 1


class TestHelpers:
    """Tests for helper functions"""

    def test_build_caption_urls(self, ovs_video_with_subtitles):
        """Test caption URL building from subtitle data using CloudFront domain"""
        captions = _build_caption_urls(ovs_video_with_subtitles)
        assert len(captions) == 1
        assert captions[0]["language"] == "en"
        assert captions[0]["language_name"] == "English"
        # Should use the CloudFront domain from the thumbnail, not direct S3
        assert (
            captions[0]["url"]
            == "https://d1rlgptj9v7p9j.cloudfront.net/subtitles/96fb932aa5644d8e8f6a5fafe42caa87/subtitles_en.vtt"
        )

    def test_build_caption_urls_empty(self, ovs_video_without_subtitles):
        """Test caption URL building with no subtitles"""
        captions = _build_caption_urls(ovs_video_without_subtitles)
        assert captions == []

    def test_get_cover_image_url(self, ovs_video_with_subtitles):
        """Test cover image URL extraction"""
        url = _get_cover_image_url(ovs_video_with_subtitles)
        assert (
            url
            == "https://d1rlgptj9v7p9j.cloudfront.net/thumbnails/96fb932aa5644d8e8f6a5fafe42caa87/video_thumbnail_00001.jpg"
        )

    def test_get_cover_image_url_none(self, ovs_video_without_subtitles):
        """Test cover image URL when no thumbnails exist"""
        url = _get_cover_image_url(ovs_video_without_subtitles)
        assert url is None

    def test_get_source_url(self, ovs_video_with_subtitles):
        """Test source URL extraction"""
        url = _get_source_url(ovs_video_with_subtitles)
        assert "video__index.m3u8" in url

    def test_get_source_url_no_sources(self):
        """Test source URL with no sources"""
        assert _get_source_url({"sources": []}) is None

    def test_get_resource_url_with_cta_link(self):
        """Test resource URL uses cta_link when available"""
        video = {"key": "abc123", "cta_link": "https://example.com/watch/abc123"}
        assert _get_resource_url(video) == "https://example.com/watch/abc123"

    def test_get_resource_url_without_cta_link(self, settings):
        """Test resource URL falls back to OVS base URL + /videos/{key}"""
        settings.OVS_API_BASE_URL = "https://video-rc.odl.mit.edu"
        video = {"key": "abc123", "cta_link": None}
        assert _get_resource_url(video) == "https://video-rc.odl.mit.edu/videos/abc123"

    @pytest.mark.parametrize(
        ("seconds", "expected"),
        [
            (0, "PT0S"),
            (0.0, "PT0S"),
            (61, "PT1M1S"),
            (3600, "PT1H"),
            (3661, "PT1H1M1S"),
            (7200, "PT2H"),
            (90, "PT1M30S"),
        ],
    )
    def test_duration_to_iso8601(self, seconds, expected):
        """Test duration conversion to ISO 8601"""
        assert _duration_to_iso8601(seconds) == expected


class TestTransform:
    """Tests for transform functions"""

    def test_transform_video_with_subtitles(self, ovs_video_with_subtitles, settings):
        """Test transforming a video with thumbnails and subtitles"""
        result = _transform_video(ovs_video_with_subtitles)

        assert_json_equal(
            result,
            {
                "readable_id": "96fb932aa5644d8e8f6a5fafe42caa87",
                "platform": PlatformType.ovs.name,
                "etl_source": ETLSource.ovs.name,
                "resource_type": LearningResourceType.video.name,
                "title": "Introduction to Machine Learning",
                "description": "An introductory lecture on machine learning concepts.",
                "url": f"{settings.OVS_API_BASE_URL}/videos/96fb932aa5644d8e8f6a5fafe42caa87",
                "image": {
                    "url": "https://d1rlgptj9v7p9j.cloudfront.net/thumbnails/96fb932aa5644d8e8f6a5fafe42caa87/video_thumbnail_00001.jpg",
                },
                "last_modified": "2020-03-23T15:14:38.254631Z",
                "availability": Availability.anytime.name,
                "published": True,
                "video": {
                    "duration": "PT1H1M1S",
                    "caption_urls": [
                        {
                            "language": "en",
                            "language_name": "English",
                            "url": "https://d1rlgptj9v7p9j.cloudfront.net/subtitles/96fb932aa5644d8e8f6a5fafe42caa87/subtitles_en.vtt",
                        }
                    ],
                    "cover_image_url": "https://d1rlgptj9v7p9j.cloudfront.net/thumbnails/96fb932aa5644d8e8f6a5fafe42caa87/video_thumbnail_00001.jpg",
                },
            },
        )

    def test_transform_video_without_subtitles(
        self, ovs_video_without_subtitles, settings
    ):
        """Test transforming a video without thumbnails or subtitles"""
        result = _transform_video(ovs_video_without_subtitles)

        assert_json_equal(
            result,
            {
                "readable_id": "abcdef1234567890abcdef1234567890",
                "platform": PlatformType.ovs.name,
                "etl_source": ETLSource.ovs.name,
                "resource_type": LearningResourceType.video.name,
                "title": "Advanced Data Structures",
                "description": "",
                "url": f"{settings.OVS_API_BASE_URL}/videos/abcdef1234567890abcdef1234567890",
                "image": None,
                "last_modified": "2021-05-10T10:00:00.000000Z",
                "availability": Availability.anytime.name,
                "published": True,
                "video": {
                    "duration": "PT0S",
                    "caption_urls": [],
                    "cover_image_url": None,
                },
            },
        )

    def test_transform_collection(self, settings):
        """Test transforming a collection into playlist data"""
        settings.OVS_API_BASE_URL = "https://video-rc.odl.mit.edu"
        collection = {
            "key": "abc123",
            "title": "Test Collection",
            "description": "A test collection",
            "is_public": True,
        }
        result = _transform_collection(collection)
        assert_json_equal(
            result,
            {
                "playlist_id": "abc123",
                "platform": PlatformType.ovs.name,
                "title": "Test Collection",
                "description": "A test collection",
                "url": f"{settings.OVS_API_BASE_URL.rstrip('/')}/collections/abc123",
                "published": True,
            },
        )

    def test_transform_groups_by_collection(self, ovs_api_response):
        """Test that transform groups videos into playlists by collection"""
        videos = ovs_api_response["results"]
        results = list(transform(videos))
        # Two videos in two different collections = 2 playlists
        assert len(results) == 2
        for playlist in results:
            assert "playlist_id" in playlist
            assert "videos" in playlist
            assert len(playlist["videos"]) == 1

    def test_transform_merges_same_collection(self):
        """Test that videos in the same collection are merged into one playlist"""
        videos = [
            {
                "key": "video1",
                "title": "Video 1",
                "description": "",
                "created_at": "2020-01-01T00:00:00Z",
                "sources": [],
                "videothumbnail_set": [],
                "videosubtitle_set": [],
                "cta_link": None,
                "duration": 0,
                "collection": {
                    "key": "collection1",
                    "title": "Same Collection",
                    "description": "",
                    "is_public": True,
                },
            },
            {
                "key": "video2",
                "title": "Video 2",
                "description": "",
                "created_at": "2020-01-02T00:00:00Z",
                "sources": [],
                "videothumbnail_set": [],
                "videosubtitle_set": [],
                "cta_link": None,
                "duration": 0,
                "collection": {
                    "key": "collection1",
                    "title": "Same Collection",
                    "description": "",
                    "is_public": True,
                },
            },
        ]
        results = list(transform(videos))
        assert len(results) == 1
        assert results[0]["playlist_id"] == "collection1"
        assert len(results[0]["videos"]) == 2
