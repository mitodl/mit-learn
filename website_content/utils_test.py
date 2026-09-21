"""Tests for website_content utilities"""

from website_content.utils import (
    extract_image_from_content,
    extract_text_from_content,
)

MIT_LEARN_EMBED_URL = "https://rc.learn.mit.edu/video/123/embed"


class TestExtractImageFromContentImageNodes:
    """Tests for inline image node extraction in extract_image_from_content."""

    def test_returns_image_with_caption_src(self):
        """Extracts src, alt, and caption from an imageWithCaption node."""
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "imageWithCaption",
                    "attrs": {
                        "src": "https://example.com/photo.jpg",
                        "alt": "A photo",
                        "caption": "The caption",
                    },
                }
            ],
        }
        result = extract_image_from_content(content)
        assert result == {
            "url": "https://example.com/photo.jpg",
            "alt": "A photo",
            "description": "The caption",
        }

    def test_returns_image_node_src(self):
        """Extracts src and alt from a plain ProseMirror image node."""
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "image",
                    "attrs": {"src": "https://example.com/img.png", "alt": "Alt text"},
                }
            ],
        }
        result = extract_image_from_content(content)
        assert result == {
            "url": "https://example.com/img.png",
            "alt": "Alt text",
            "description": "Alt text",
        }

    def test_image_node_takes_priority_over_media_embed(self, mocker):
        """An imageWithCaption earlier in the doc wins; the DB is never queried."""
        mock_get = mocker.patch(
            "learning_resources.models.LearningResource.objects.get"
        )
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "imageWithCaption",
                    "attrs": {"src": "https://example.com/real.jpg", "alt": "real"},
                },
                {
                    "type": "mediaEmbed",
                    "attrs": {"mitLearnVideoId": 123, "src": MIT_LEARN_EMBED_URL},
                },
            ],
        }
        result = extract_image_from_content(content)
        assert result["url"] == "https://example.com/real.jpg"
        mock_get.assert_not_called()

    def test_returns_none_for_empty_content(self):
        """Returns None for empty dict and None input."""
        assert extract_image_from_content({}) is None
        assert extract_image_from_content(None) is None

    def test_returns_none_when_no_image_nodes(self):
        """Returns None when the document contains only text, no images."""
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Just text"}],
                }
            ],
        }
        assert extract_image_from_content(content) is None


class TestExtractImageFromContentMediaEmbed:
    """Tests for the mediaEmbed fallback path in extract_image_from_content."""

    def _doc(self, *nodes):
        return {"type": "doc", "content": list(nodes)}

    def _media_embed(self, **attrs):
        return {"type": "mediaEmbed", "attrs": attrs}

    def test_returns_cover_image_from_mit_learn_video_id(self, mocker):
        """Looks up cover_image_url from the Video record when mitLearnVideoId is set."""
        mock_video = mocker.Mock()
        mock_video.cover_image_url = "https://cdn.example.com/thumb.png"
        mocker.patch(
            "learning_resources.models.Video.objects.filter",
            return_value=mocker.Mock(first=mocker.Mock(return_value=mock_video)),
        )
        content = self._doc(
            self._media_embed(mitLearnVideoId=123, src=MIT_LEARN_EMBED_URL)
        )

        result = extract_image_from_content(content)

        assert result == {
            "url": "https://cdn.example.com/thumb.png",
            "alt": "",
            "description": "",
        }

    def test_returns_none_when_video_not_found(self, mocker):
        """Returns None gracefully when no Video record exists for the given ID."""
        mocker.patch(
            "learning_resources.models.Video.objects.filter",
            return_value=mocker.Mock(first=mocker.Mock(return_value=None)),
        )
        content = self._doc(
            self._media_embed(mitLearnVideoId=999, src=MIT_LEARN_EMBED_URL)
        )

        assert extract_image_from_content(content) is None

    def test_returns_none_when_no_mit_learn_video_id(self):
        """Returns None for a mediaEmbed with no mitLearnVideoId (e.g. a YouTube embed)."""
        content = self._doc(self._media_embed(src="https://www.youtube.com/embed/abc"))
        assert extract_image_from_content(content) is None

    def test_finds_media_embed_nested_inside_content(self, mocker):
        """Finds a mediaEmbed node even when it is nested inside another container node."""
        mock_video = mocker.Mock()
        mock_video.cover_image_url = "https://cdn.example.com/deep-thumb.png"
        mocker.patch(
            "learning_resources.models.Video.objects.filter",
            return_value=mocker.Mock(first=mocker.Mock(return_value=mock_video)),
        )
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "section",
                    "content": [
                        self._media_embed(mitLearnVideoId=123, src=MIT_LEARN_EMBED_URL)
                    ],
                }
            ],
        }

        result = extract_image_from_content(content)

        assert result == {
            "url": "https://cdn.example.com/deep-thumb.png",
            "alt": "",
            "description": "",
        }


class TestExtractTextFromContent:
    """Tests for extract_text_from_content."""

    def test_adjacent_text_nodes_are_not_separated(self):
        """
        Text nodes within a block are contiguous characters that differ only by
        their marks, so joining them with anything would break words apart.
        """
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "un"},
                        {
                            "type": "text",
                            "text": "avoidable",
                            "marks": [{"type": "bold"}],
                        },
                    ],
                }
            ],
        }

        assert extract_text_from_content(content) == "unavoidable"

    def test_blocks_are_separated(self):
        """Without a boundary the last word of a block runs into the next."""
        content = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [{"type": "text", "text": "first"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "second"}]},
            ],
        }

        assert extract_text_from_content(content) == "first second"

    def test_whitespace_is_collapsed(self):
        """Leading, trailing and repeated whitespace do not reach the index."""
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "  spaced \n out  "}],
                }
            ],
        }

        assert extract_text_from_content(content) == "spaced out"

    def test_nested_blocks_are_reached(self):
        """Text inside a banner or list still has to be found."""
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "banner",
                    "content": [
                        {
                            "type": "heading",
                            "attrs": {"level": 1},
                            "content": [{"type": "text", "text": "Headline"}],
                        }
                    ],
                },
                {"type": "paragraph", "content": [{"type": "text", "text": "Body"}]},
            ],
        }

        assert extract_text_from_content(content) == "Headline Body"

    def test_empty_and_textless_documents(self):
        """A document with no text at all yields an empty string, not None."""
        assert extract_text_from_content(None) == ""
        assert extract_text_from_content({}) == ""
        assert (
            extract_text_from_content(
                {"type": "doc", "content": [{"type": "paragraph", "content": []}]}
            )
            == ""
        )
