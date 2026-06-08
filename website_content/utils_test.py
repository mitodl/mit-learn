"""Tests for website_content utilities"""

from website_content.utils import extract_image_from_content, fetch_odl_video_thumbnail

ODL_EMBED_URL = "https://video.odl.mit.edu/videos/abc123/embed/"

ODL_SETTINGS_HTML = (
    "<html><body><script>var SETTINGS = "
    '{"video": {"videothumbnail_set": [{"cloudfront_url": "https://cdn.example.com/thumb.png"}]}};</script></body></html>'
)


# ---------------------------------------------------------------------------
# fetch_odl_video_thumbnail
# ---------------------------------------------------------------------------


class TestFetchOdlVideoThumbnail:
    def test_rejects_non_https_scheme(self):
        assert (
            fetch_odl_video_thumbnail("http://video.odl.mit.edu/videos/x/embed/")
            is None
        )

    def test_rejects_non_odl_hostname(self):
        assert fetch_odl_video_thumbnail("https://evil.com/videos/x/embed/") is None

    def test_rejects_subdomain_spoofing(self):
        # "video.odl.mit.edu" as a path segment, not hostname
        assert (
            fetch_odl_video_thumbnail(
                "https://evil.com/video.odl.mit.edu/videos/x/embed/"
            )
            is None
        )

    def test_returns_thumbnail_url_on_success(self, mocker):
        mock_resp = mocker.Mock()
        mock_resp.text = ODL_SETTINGS_HTML
        mock_resp.raise_for_status = mocker.Mock()
        mocker.patch("website_content.utils.requests.get", return_value=mock_resp)

        result = fetch_odl_video_thumbnail(ODL_EMBED_URL)

        assert result == "https://cdn.example.com/thumb.png"

    def test_returns_none_when_settings_block_absent(self, mocker):
        mock_resp = mocker.Mock()
        mock_resp.text = "<html><body>no settings here</body></html>"
        mock_resp.raise_for_status = mocker.Mock()
        mocker.patch("website_content.utils.requests.get", return_value=mock_resp)

        assert fetch_odl_video_thumbnail(ODL_EMBED_URL) is None

    def test_returns_none_on_invalid_json(self, mocker):
        mock_resp = mocker.Mock()
        mock_resp.text = "<script>var SETTINGS = {not: valid json};</script>"
        mock_resp.raise_for_status = mocker.Mock()
        mocker.patch("website_content.utils.requests.get", return_value=mock_resp)

        assert fetch_odl_video_thumbnail(ODL_EMBED_URL) is None

    def test_returns_none_when_thumbnail_set_empty(self, mocker):
        mock_resp = mocker.Mock()
        mock_resp.text = (
            '<script>var SETTINGS = {"video": {"videothumbnail_set": []}};</script>'
        )
        mock_resp.raise_for_status = mocker.Mock()
        mocker.patch("website_content.utils.requests.get", return_value=mock_resp)

        assert fetch_odl_video_thumbnail(ODL_EMBED_URL) is None

    def test_returns_none_on_request_exception(self, mocker):
        import requests

        mocker.patch(
            "website_content.utils.requests.get",
            side_effect=requests.RequestException("timeout"),
        )

        assert fetch_odl_video_thumbnail(ODL_EMBED_URL) is None


# ---------------------------------------------------------------------------
# extract_image_from_content — mediaEmbed fallback
# ---------------------------------------------------------------------------


class TestExtractImageFromContentMediaEmbed:
    def _doc(self, *nodes):
        return {"type": "doc", "content": list(nodes)}

    def _media_embed(self, **attrs):
        return {"type": "mediaEmbed", "attrs": attrs}

    def test_returns_cover_image_url_without_network_call(self, mocker):
        mock_fetch = mocker.patch("website_content.utils.fetch_odl_video_thumbnail")
        content = self._doc(
            self._media_embed(
                src=ODL_EMBED_URL,
                coverImageUrl="https://cdn.example.com/stored-cover.png",
            )
        )

        result = extract_image_from_content(content)

        assert result == {
            "url": "https://cdn.example.com/stored-cover.png",
            "alt": "",
            "description": "",
        }
        mock_fetch.assert_not_called()

    def test_fetches_odl_thumbnail_when_no_cover_image_url(self, mocker):
        mocker.patch(
            "website_content.utils.fetch_odl_video_thumbnail",
            return_value="https://cdn.example.com/fetched-thumb.png",
        )
        content = self._doc(self._media_embed(src=ODL_EMBED_URL))

        result = extract_image_from_content(content)

        assert result == {
            "url": "https://cdn.example.com/fetched-thumb.png",
            "alt": "",
            "description": "",
        }

    def test_returns_none_when_odl_fetch_fails(self, mocker):
        mocker.patch(
            "website_content.utils.fetch_odl_video_thumbnail", return_value=None
        )
        content = self._doc(self._media_embed(src=ODL_EMBED_URL))

        assert extract_image_from_content(content) is None

    def test_does_not_fetch_for_non_odl_src(self, mocker):
        mock_fetch = mocker.patch("website_content.utils.fetch_odl_video_thumbnail")
        content = self._doc(self._media_embed(src="https://www.youtube.com/embed/abc"))

        result = extract_image_from_content(content)

        assert result is None
        mock_fetch.assert_not_called()

    def test_image_node_takes_priority_over_media_embed(self, mocker):
        mock_fetch = mocker.patch("website_content.utils.fetch_odl_video_thumbnail")
        content = self._doc(
            {
                "type": "imageWithCaption",
                "attrs": {"src": "https://example.com/real-image.jpg", "alt": "real"},
            },
            self._media_embed(
                src=ODL_EMBED_URL,
                coverImageUrl="https://cdn.example.com/embed-cover.png",
            ),
        )

        result = extract_image_from_content(content)

        assert result["url"] == "https://example.com/real-image.jpg"
        mock_fetch.assert_not_called()

    def test_finds_media_embed_nested_inside_content(self, mocker):
        mocker.patch(
            "website_content.utils.fetch_odl_video_thumbnail",
            return_value="https://cdn.example.com/deep-thumb.png",
        )
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "section",
                    "content": [self._media_embed(src=ODL_EMBED_URL)],
                }
            ],
        }

        result = extract_image_from_content(content)

        assert result == {
            "url": "https://cdn.example.com/deep-thumb.png",
            "alt": "",
            "description": "",
        }

    def test_cover_image_url_takes_priority_over_odl_fetch(self, mocker):
        mock_fetch = mocker.patch("website_content.utils.fetch_odl_video_thumbnail")
        content = self._doc(
            self._media_embed(
                src=ODL_EMBED_URL,
                coverImageUrl="https://cdn.example.com/cover.png",
            )
        )

        result = extract_image_from_content(content)

        assert result["url"] == "https://cdn.example.com/cover.png"
        mock_fetch.assert_not_called()
