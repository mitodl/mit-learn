"""Tests for OVS ETL functions"""

import json
from unittest.mock import Mock

import pytest
import requests

from learning_resources.constants import (
    Availability,
    LearningResourceType,
    PlatformType,
)
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.ovs import (
    _build_caption_urls,
    _duration_to_iso8601,
    _fetch_transcript,
    _get_cover_image_url,
    _get_resource_url,
    _get_source_url,
    _transform_collection,
    _transform_video,
    extract,
    get_ovs_transcripts,
    get_ovs_videos_for_transcripts_job,
    transform,
)
from learning_resources.factories import (
    LearningResourcePlatformFactory,
    VideoFactory,
)
from main.test_utils import assert_json_equal

pytestmark = pytest.mark.django_db

OVS_TEST_BASE_URL = "https://video.odl.mit.edu"


@pytest.fixture(autouse=True)
def ovs_settings(settings):
    """Ensure OVS_API_BASE_URL is set for all tests in this module"""
    settings.OVS_API_BASE_URL = OVS_TEST_BASE_URL
    return settings


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


def _mock_ovs_response(mocker, data, **patch_kwargs):
    """Create a mock OVS API response and patch requests.get"""
    mock_response = Mock()
    mock_response.json.return_value = data
    mock_response.raise_for_status.return_value = None
    mock_get = mocker.patch(
        "learning_resources.etl.ovs.requests.get",
        return_value=mock_response,
        **patch_kwargs,
    )
    return mock_get, mock_response


@pytest.fixture
def mock_ovs_api_response(mocker, ovs_api_response):
    """Mock the OVS API response"""
    _, mock_response = _mock_ovs_response(mocker, ovs_api_response)
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
        _mock_ovs_response(mocker, api_data)
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
        _mock_ovs_response(mocker, api_data)
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

    def test_extract_adds_include_in_learn_param(self, mocker):
        """Extract should add include_in_learn=true to the URL"""
        api_data = {"count": 0, "next": None, "results": []}
        mock_get, _ = _mock_ovs_response(mocker, api_data)
        list(extract(url="https://video.odl.mit.edu/api/v0/public/videos/"))
        called_url = mock_get.call_args[0][0]
        assert "include_in_learn=true" in called_url

    def test_extract_preserves_existing_include_in_learn_param(self, mocker):
        """Extract should not duplicate include_in_learn if already present"""
        api_data = {"count": 0, "next": None, "results": []}
        mock_get, _ = _mock_ovs_response(mocker, api_data)
        url = "https://video.odl.mit.edu/api/v0/public/videos/?include_in_learn=true"
        list(extract(url=url))
        called_url = mock_get.call_args[0][0]
        assert called_url.count("include_in_learn") == 1

    def test_extract_skips_when_url_not_configured(self, mocker, settings):
        """Extract should return nothing when OVS_API_BASE_URL is not set"""
        settings.OVS_API_BASE_URL = None
        mock_get = mocker.patch("learning_resources.etl.ovs.requests.get")
        results = list(extract())
        assert len(results) == 0
        mock_get.assert_not_called()

    def test_extract_raises_on_http_error(self, mocker):
        """Extract should propagate HTTP errors from the API"""
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.HTTPError(
            "500 Server Error"
        )
        mocker.patch(
            "learning_resources.etl.ovs.requests.get",
            return_value=mock_response,
        )
        with pytest.raises(requests.HTTPError):
            list(extract())

    def test_extract_adds_include_in_learn_to_next_urls(self, mocker):
        """Extract should add include_in_learn=true to paginated next URLs"""
        page1 = {
            "count": 2,
            "next": "https://video.odl.mit.edu/api/v0/public/videos/?page=2",
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

        mock_get = mocker.patch(
            "learning_resources.etl.ovs.requests.get",
            side_effect=[mock_resp1, mock_resp2],
        )
        list(extract())
        # Both calls should include include_in_learn=true
        for call in mock_get.call_args_list:
            assert "include_in_learn=true" in call[0][0]


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
                    "cover_image_url": "",
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

    def test_transform_skips_videos_without_collection(self):
        """Test that videos without a collection are skipped"""
        videos = [
            {
                "key": "video_no_collection",
                "title": "No Collection Video",
                "description": "",
                "created_at": "2020-01-01T00:00:00Z",
                "sources": [],
                "videothumbnail_set": [],
                "videosubtitle_set": [],
                "cta_link": None,
                "duration": 0,
                "collection": None,
            },
            {
                "key": "video_empty_collection_key",
                "title": "Empty Collection Key Video",
                "description": "",
                "created_at": "2020-01-01T00:00:00Z",
                "sources": [],
                "videothumbnail_set": [],
                "videosubtitle_set": [],
                "cta_link": None,
                "duration": 0,
                "collection": {"key": "", "title": "Empty", "description": ""},
            },
        ]
        results = list(transform(videos))
        assert len(results) == 0

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


@pytest.fixture
def ovs_platform():
    """Create OVS platform for tests."""
    return LearningResourcePlatformFactory.create(code=PlatformType.ovs.name)


def test_fetch_transcript_english(mocker):
    """Should fetch and return English transcript text via Tika"""
    mock_extract = mocker.patch(
        "learning_resources.etl.ovs.extract_text_from_url",
        return_value={"content": "  Hello world transcript  "},
    )
    caption_urls = [
        {"language": "en", "url": "https://example.com/subtitles_en.vtt"},
    ]
    result = _fetch_transcript(caption_urls)
    assert result == "Hello world transcript"
    mock_extract.assert_called_once_with(
        "https://example.com/subtitles_en.vtt", mime_type="text/vtt"
    )


def test_fetch_transcript_picks_english(mocker):
    """Should pick the English caption from multiple languages"""
    mock_extract = mocker.patch(
        "learning_resources.etl.ovs.extract_text_from_url",
        return_value={"content": "English text"},
    )
    caption_urls = [
        {"language": "es", "url": "https://example.com/subtitles_es.vtt"},
        {"language": "en", "url": "https://example.com/subtitles_en.vtt"},
    ]
    result = _fetch_transcript(caption_urls)
    assert result == "English text"
    mock_extract.assert_called_once_with(
        "https://example.com/subtitles_en.vtt", mime_type="text/vtt"
    )


def test_fetch_transcript_no_english(mocker):
    """Should return empty string when no English caption exists"""
    mock_extract = mocker.patch(
        "learning_resources.etl.ovs.extract_text_from_url",
    )
    caption_urls = [
        {"language": "es", "url": "https://example.com/subtitles_es.vtt"},
    ]
    result = _fetch_transcript(caption_urls)
    assert result == ""
    mock_extract.assert_not_called()


def test_fetch_transcript_empty_captions(mocker):
    """Should return empty string for empty caption list"""
    mocker.patch("learning_resources.etl.ovs.extract_text_from_url")
    assert _fetch_transcript([]) == ""


def test_fetch_transcript_request_error(mocker):
    """Should return empty string and log warning on request failure"""
    mocker.patch(
        "learning_resources.etl.ovs.extract_text_from_url",
        side_effect=requests.RequestException("Connection error"),
    )
    caption_urls = [
        {"language": "en", "url": "https://example.com/subtitles_en.vtt"},
    ]
    result = _fetch_transcript(caption_urls)
    assert result == ""


def test_fetch_transcript_tika_returns_none(mocker):
    """Should return empty string when Tika returns None"""
    mocker.patch(
        "learning_resources.etl.ovs.extract_text_from_url",
        return_value=None,
    )
    caption_urls = [
        {"language": "en", "url": "https://example.com/subtitles_en.vtt"},
    ]
    result = _fetch_transcript(caption_urls)
    assert result == ""


def test_filters_ovs_videos_without_transcripts(ovs_platform):
    """Should return OVS videos with empty transcripts"""
    video = VideoFactory.create(
        learning_resource__platform=ovs_platform,
        learning_resource__resource_type=LearningResourceType.video.name,
        learning_resource__published=True,
        transcript="",
        caption_urls=[{"language": "en", "url": "https://example.com/en.vtt"}],
    )
    results = get_ovs_videos_for_transcripts_job()
    assert list(results) == [video.learning_resource]


def test_excludes_videos_with_transcripts(ovs_platform):
    """Should exclude videos that already have transcripts"""
    VideoFactory.create(
        learning_resource__platform=ovs_platform,
        learning_resource__resource_type=LearningResourceType.video.name,
        learning_resource__published=True,
        transcript="Existing transcript",
        caption_urls=[{"language": "en", "url": "https://example.com/en.vtt"}],
    )
    results = get_ovs_videos_for_transcripts_job()
    assert results.count() == 0


def test_includes_with_overwrite(ovs_platform):
    """Should include videos with existing transcripts when overwrite=True"""
    video = VideoFactory.create(
        learning_resource__platform=ovs_platform,
        learning_resource__resource_type=LearningResourceType.video.name,
        learning_resource__published=True,
        transcript="Existing transcript",
        caption_urls=[{"language": "en", "url": "https://example.com/en.vtt"}],
    )
    results = get_ovs_videos_for_transcripts_job(overwrite=True)
    assert list(results) == [video.learning_resource]


def test_excludes_non_ovs_videos():
    """Should not return YouTube or other platform videos"""
    yt_platform = LearningResourcePlatformFactory.create(code=PlatformType.youtube.name)
    VideoFactory.create(
        learning_resource__platform=yt_platform,
        learning_resource__resource_type=LearningResourceType.video.name,
        learning_resource__published=True,
        transcript="",
        caption_urls=[{"language": "en", "url": "https://example.com/en.vtt"}],
    )
    results = get_ovs_videos_for_transcripts_job()
    assert results.count() == 0


def test_excludes_videos_without_english_captions(ovs_platform):
    """Should not return videos that only have non-English captions"""
    VideoFactory.create(
        learning_resource__platform=ovs_platform,
        learning_resource__resource_type=LearningResourceType.video.name,
        learning_resource__published=True,
        transcript="",
        caption_urls=[{"language": "es", "url": "https://example.com/es.vtt"}],
    )
    results = get_ovs_videos_for_transcripts_job()
    assert results.count() == 0


def test_excludes_videos_with_empty_captions(ovs_platform):
    """Should not return videos with empty caption_urls"""
    VideoFactory.create(
        learning_resource__platform=ovs_platform,
        learning_resource__resource_type=LearningResourceType.video.name,
        learning_resource__published=True,
        transcript="",
        caption_urls=[],
    )
    results = get_ovs_videos_for_transcripts_job()
    assert results.count() == 0


def test_excludes_unpublished(ovs_platform):
    """Should not return unpublished videos"""
    VideoFactory.create(
        learning_resource__platform=ovs_platform,
        learning_resource__resource_type=LearningResourceType.video.name,
        learning_resource__published=False,
        transcript="",
    )
    results = get_ovs_videos_for_transcripts_job()
    assert results.count() == 0


def test_fetches_and_saves_transcript(mocker, ovs_platform):
    """Should fetch transcript, save to video, and update index"""
    video = VideoFactory.create(
        learning_resource__platform=ovs_platform,
        learning_resource__resource_type=LearningResourceType.video.name,
        learning_resource__published=True,
        transcript="",
        caption_urls=[{"language": "en", "url": "https://example.com/en.vtt"}],
    )
    mocker.patch(
        "learning_resources.etl.ovs.extract_text_from_url",
        return_value={"content": "Transcript text"},
    )
    mock_update_index = mocker.patch(
        "learning_resources.etl.ovs.update_index",
    )

    get_ovs_transcripts([video.learning_resource])

    video.refresh_from_db()
    assert video.transcript == "Transcript text"
    mock_update_index.assert_called_once_with(
        video.learning_resource, newly_created=False
    )


def test_skips_videos_without_captions(mocker, ovs_platform):
    """Should skip videos with no caption_urls"""
    video = VideoFactory.create(
        learning_resource__platform=ovs_platform,
        learning_resource__resource_type=LearningResourceType.video.name,
        learning_resource__published=True,
        transcript="",
        caption_urls=[],
    )
    mock_extract = mocker.patch(
        "learning_resources.etl.ovs.extract_text_from_url",
    )
    mock_update_index = mocker.patch(
        "learning_resources.etl.ovs.update_index",
    )

    get_ovs_transcripts([video.learning_resource])

    mock_extract.assert_not_called()
    mock_update_index.assert_not_called()
    video.refresh_from_db()
    assert video.transcript == ""


def test_skips_when_fetch_returns_empty(mocker, ovs_platform):
    """Should not save or reindex when transcript fetch returns empty"""
    video = VideoFactory.create(
        learning_resource__platform=ovs_platform,
        learning_resource__resource_type=LearningResourceType.video.name,
        learning_resource__published=True,
        transcript="",
        caption_urls=[{"language": "en", "url": "https://example.com/en.vtt"}],
    )
    mocker.patch(
        "learning_resources.etl.ovs.extract_text_from_url",
        return_value=None,
    )
    mock_update_index = mocker.patch(
        "learning_resources.etl.ovs.update_index",
    )

    get_ovs_transcripts([video.learning_resource])

    mock_update_index.assert_not_called()
    video.refresh_from_db()
    assert video.transcript == ""
