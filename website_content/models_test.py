"""Tests for website_content models"""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from website_content.constants import WebsiteContentType
from website_content.models import WebsiteContent

User = get_user_model()


@pytest.mark.django_db
@patch("website_content.tasks.fastly_purge_website_content_list.delay")
@patch("website_content.tasks.fastly_purge_relative_url")
@patch("website_content.tasks.fastly_purge_relative_url.delay")
class TestWebsiteContentModel:
    """Tests for WebsiteContent model"""

    def test_get_url_news_with_slug(
        self,
        _mock_queue_purge_delay,  # noqa: PT019
        _mock_purge_url,  # noqa: PT019
        _mock_queue_list,  # noqa: PT019
    ):
        """Test that get_url returns /news/slug for news content"""
        user = User.objects.create_user(username="testuser", email="test@example.com")
        content = WebsiteContent.objects.create(
            title="Test News",
            content={"type": "doc", "content": []},
            is_published=True,
            user=user,
            content_type=WebsiteContentType.news.name,
        )

        assert content.get_url() == f"/news/{content.slug}"

    def test_get_url_article_with_slug(
        self,
        _mock_queue_purge_delay,  # noqa: PT019
        _mock_purge_url,  # noqa: PT019
        _mock_queue_list,  # noqa: PT019
    ):
        """Test that get_url returns /articles/slug for article content"""
        user = User.objects.create_user(
            username="testuser_art", email="art@example.com"
        )
        content = WebsiteContent.objects.create(
            title="Test Article Page",
            content={"type": "doc", "content": []},
            is_published=True,
            user=user,
            content_type=WebsiteContentType.article.name,
        )

        assert content.get_url() == f"/articles/{content.slug}"

    def test_get_url_without_slug(
        self,
        _mock_queue_purge_delay,  # noqa: PT019
        _mock_purge_url,  # noqa: PT019
        _mock_queue_list,  # noqa: PT019
    ):
        """Test that get_url returns None for unpublished content without a slug"""
        user = User.objects.create_user(username="testuser2", email="test2@example.com")
        content = WebsiteContent.objects.create(
            title="Draft Content",
            content={"type": "doc", "content": []},
            is_published=False,
            user=user,
            content_type=WebsiteContentType.news.name,
        )

        assert content.get_url() is None

    def test_slug_generation_on_publish(
        self,
        _mock_queue_purge_delay,  # noqa: PT019
        _mock_purge_url,  # noqa: PT019
        _mock_queue_list,  # noqa: PT019
    ):
        """Test that slug is generated when content is published"""
        user = User.objects.create_user(username="testuser4", email="test4@example.com")
        content = WebsiteContent.objects.create(
            title="Test Content Title",
            content={"type": "doc", "content": []},
            is_published=False,
            user=user,
            content_type=WebsiteContentType.news.name,
        )

        assert content.slug is None

        content.is_published = True
        content.save()

        assert content.slug is not None
        assert content.slug == "test-content-title"
        assert content.get_url() == "/news/test-content-title"

    def test_content_type_defaults_to_news(
        self,
        _mock_queue_purge_delay,  # noqa: PT019
        _mock_purge_url,  # noqa: PT019
        _mock_queue_list,  # noqa: PT019
    ):
        """Test that content_type defaults to 'news'"""
        user = User.objects.create_user(username="testuser5", email="test5@example.com")
        content = WebsiteContent.objects.create(
            title="News Piece",
            content={},
            user=user,
        )

        assert content.content_type == WebsiteContentType.news.name

    def test_cover_image_set_from_content_on_create(
        self,
        _mock_queue_purge_delay,  # noqa: PT019
        _mock_purge_url,  # noqa: PT019
        _mock_queue_list,  # noqa: PT019
    ):
        """cover_image is derived from the first image node when the record is created."""
        user = User.objects.create_user(username="testuser6", email="test6@example.com")
        content = WebsiteContent.objects.create(
            title="Has Image",
            content={
                "type": "doc",
                "content": [
                    {
                        "type": "imageWithCaption",
                        "attrs": {"src": "https://example.com/first.jpg", "alt": ""},
                    }
                ],
            },
            user=user,
        )

        assert content.cover_image == "https://example.com/first.jpg"

    def test_cover_image_empty_when_no_image_in_content(
        self,
        _mock_queue_purge_delay,  # noqa: PT019
        _mock_purge_url,  # noqa: PT019
        _mock_queue_list,  # noqa: PT019
    ):
        """cover_image is empty string when the content contains no image nodes."""
        user = User.objects.create_user(username="testuser7", email="test7@example.com")
        content = WebsiteContent.objects.create(
            title="No Image",
            content={"type": "doc", "content": []},
            user=user,
        )

        assert content.cover_image == ""

    def test_cover_image_updates_when_content_image_changes(
        self,
        _mock_queue_purge_delay,  # noqa: PT019
        _mock_purge_url,  # noqa: PT019
        _mock_queue_list,  # noqa: PT019
    ):
        """cover_image is re-derived on every save, so swapping the image is reflected."""
        user = User.objects.create_user(username="testuser8", email="test8@example.com")
        content = WebsiteContent.objects.create(
            title="Changing Image",
            content={
                "type": "doc",
                "content": [
                    {
                        "type": "imageWithCaption",
                        "attrs": {"src": "https://example.com/original.jpg", "alt": ""},
                    }
                ],
            },
            user=user,
        )
        assert content.cover_image == "https://example.com/original.jpg"

        content.content = {
            "type": "doc",
            "content": [
                {
                    "type": "imageWithCaption",
                    "attrs": {"src": "https://example.com/updated.jpg", "alt": ""},
                }
            ],
        }
        content.save()

        assert content.cover_image == "https://example.com/updated.jpg"

    def test_cover_image_cleared_when_image_removed_from_content(
        self,
        _mock_queue_purge_delay,  # noqa: PT019
        _mock_purge_url,  # noqa: PT019
        _mock_queue_list,  # noqa: PT019
    ):
        """cover_image is cleared to '' when the author removes all images from content."""
        user = User.objects.create_user(username="testuser9", email="test9@example.com")
        content = WebsiteContent.objects.create(
            title="Image Removed",
            content={
                "type": "doc",
                "content": [
                    {
                        "type": "imageWithCaption",
                        "attrs": {
                            "src": "https://example.com/soon-gone.jpg",
                            "alt": "",
                        },
                    }
                ],
            },
            user=user,
        )
        assert content.cover_image == "https://example.com/soon-gone.jpg"

        content.content = {"type": "doc", "content": []}
        content.save()

        assert content.cover_image == ""
