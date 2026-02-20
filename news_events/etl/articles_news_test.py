"""Tests for Articles News ETL"""

import pytest

from news_events.etl import articles_news


@pytest.fixture
def mock_articles(mocker):
    """Mock Article.objects.filter"""
    mock_user = mocker.Mock()
    mock_user.first_name = "John"
    mock_user.last_name = "Doe"
    mock_user.username = "johndoe"

    mock_article = mocker.Mock()
    mock_article.id = 1
    mock_article.title = "Test Article"
    mock_article.slug = "test-article"
    mock_article.content = {
        "blocks": [
            {"type": "paragraph", "text": "This is test content."},
            {"type": "paragraph", "text": "More content here."},
        ]
    }
    mock_article.user = mock_user
    mock_article.created_on = mocker.Mock()
    mock_article.created_on.isoformat.return_value = "2024-01-01T00:00:00Z"
    mock_article.updated_on = mocker.Mock()

    mock_article.publish_date = mocker.Mock()
    mock_article.publish_date.isoformat.return_value = "2024-01-01T00:00:00Z"

    mock_queryset = mocker.Mock()
    mock_queryset.select_related.return_value = [mock_article]

    mocker.patch(
        "news_events.etl.articles_news.Article.objects.filter",
        return_value=mock_queryset,
    )

    return [mock_article]


def test_extract(mock_articles):
    """Test extract function returns article data"""
    result = articles_news.extract()

    assert len(result) == 1
    assert result[0]["title"] == "Test Article"
    assert result[0]["slug"] == "test-article"
    assert result[0]["id"] == 1


def test_transform_items():
    """Test transform_items converts articles to feed format"""

    # Create a mock datetime object
    from datetime import UTC, datetime

    mock_datetime = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)

    # Create a simple user class
    class MockUser:
        first_name = "John"
        last_name = "Doe"
        username = "johndoe"

    articles_data = [
        {
            "id": 1,
            "title": "Test Article",
            "slug": "test-article",
            "content": {"blocks": [{"text": "Test content"}]},
            "user": MockUser(),
            "created_on": mock_datetime,
            "publish_date": mock_datetime,
        }
    ]

    result = articles_news.transform_items(articles_data)

    assert len(result) == 1
    assert result[0]["guid"] == "article-1"
    assert result[0]["title"] == "Test Article"
    assert result[0]["url"] == "/news/test-article"
    assert result[0]["detail"]["authors"] == ["John Doe"]
    assert result[0]["detail"]["publish_date"] == "2024-01-01T00:00:00+00:00"


def test_extract_text_from_content():
    """Test text extraction from JSON content"""
    # ProseMirror structure (actual format)
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "First paragraph."}],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Second paragraph."}],
            },
        ],
    }

    result = articles_news.extract_text_from_content(content_json)

    assert "First paragraph." in result
    assert "Second paragraph." in result


def test_extract_text_from_nested_prosemirror():
    """Test text extraction from nested ProseMirror content"""
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "banner",
                "content": [
                    {
                        "type": "heading",
                        "content": [{"type": "text", "text": "Heading text"}],
                    }
                ],
            },
            {"type": "paragraph", "content": [{"type": "text", "text": "Body text"}]},
        ],
    }

    result = articles_news.extract_text_from_content(content_json)

    assert "Heading text" in result
    assert "Body text" in result


def test_extract_text_from_empty_content():
    """Test text extraction with empty content"""
    result = articles_news.extract_text_from_content({})
    assert result == ""

    result = articles_news.extract_text_from_content(None)
    assert result == ""


def test_extract_image_from_content():
    """Test image extraction from JSON content"""
    # ProseMirror imageWithCaption (actual format used)
    content_json = {
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Some text"}]},
            {
                "type": "imageWithCaption",
                "attrs": {
                    "src": "http://example.com/image.webp",
                    "alt": "download",
                    "title": "download",
                    "caption": "Image caption",
                },
            },
        ],
    }

    result = articles_news.extract_image_from_content(content_json)

    assert result is not None
    assert result["url"] == "http://example.com/image.webp"
    assert result["alt"] == "download"
    assert result["description"] == "Image caption"


def test_extract_image_from_prosemirror_image():
    """Test image extraction from ProseMirror image node"""
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "image",
                "attrs": {
                    "src": "http://example.com/photo.jpg",
                    "alt": "Photo alt text",
                    "title": "Photo title",
                },
            }
        ],
    }

    result = articles_news.extract_image_from_content(content_json)

    assert result is not None
    assert result["url"] == "http://example.com/photo.jpg"
    assert result["alt"] == "Photo alt text"


def test_extract_image_editorjs_format():
    """Test image extraction from EditorJS format"""
    # EditorJS style image
    content_json = {
        "blocks": [
            {"type": "paragraph", "text": "Some text"},
            {
                "type": "image",
                "data": {
                    "file": {"url": "https://example.com/image.jpg"},
                    "caption": "Test image caption",
                },
            },
        ]
    }

    result = articles_news.extract_image_from_content(content_json)

    assert result is not None
    assert result["url"] == "https://example.com/image.jpg"
    assert result["alt"] == "Test image caption"
    assert result["description"] == "Test image caption"


def test_extract_image_from_nested_structure():
    """Test image extraction from nested JSON structure"""
    content_json = {
        "content": {
            "blocks": [
                {
                    "type": "media",
                    "image": {
                        "url": "https://example.com/nested.png",
                        "alt": "Nested image",
                        "description": "A nested image",
                    },
                }
            ]
        }
    }

    result = articles_news.extract_image_from_content(content_json)

    assert result is not None
    assert result["url"] == "https://example.com/nested.png"
    assert result["alt"] == "Nested image"


def test_extract_image_returns_none_when_no_image():
    """Test image extraction returns None when no image found"""
    content_json = {"blocks": [{"type": "paragraph", "text": "Just text, no images"}]}

    result = articles_news.extract_image_from_content(content_json)
    assert result is None

    result = articles_news.extract_image_from_content({})
    assert result is None

    result = articles_news.extract_image_from_content(None)
    assert result is None


def test_extract_summary_from_banner_with_banner_paragraph():
    """Test extracting summary from banner paragraph"""
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "banner",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": "This is the banner summary text.",
                            }
                        ],
                    }
                ],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "This is a regular paragraph."}],
            },
        ],
    }

    result = articles_news.extract_summary_from_banner(content_json)

    assert result == "This is the banner summary text."


def test_extract_summary_from_banner_fallback_to_first_paragraph():
    """Test fallback to first paragraph when no banner paragraph"""
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "banner",
                "content": [
                    {
                        "type": "heading",
                        "content": [{"type": "text", "text": "Just a heading"}],
                    }
                ],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "First regular paragraph text."}],
            },
        ],
    }

    result = articles_news.extract_summary_from_banner(content_json)

    assert result == "First regular paragraph text."


def test_extract_summary_from_banner_no_banner_node():
    """Test extracting summary when there's no banner node at all"""
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "First paragraph without banner."}
                ],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Second paragraph."}],
            },
        ],
    }

    result = articles_news.extract_summary_from_banner(content_json)

    assert result == "First paragraph without banner."


def test_extract_summary_from_banner_multiple_text_nodes():
    """Test extracting summary with multiple text nodes in paragraph"""
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "banner",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {"type": "text", "text": "This is "},
                            {"type": "text", "text": "a multi-part "},
                            {"type": "text", "text": "summary."},
                        ],
                    }
                ],
            }
        ],
    }

    result = articles_news.extract_summary_from_banner(content_json)

    # Text parts are joined without extra spaces
    assert result == "This is a multi-part summary."


def test_extract_summary_from_banner_with_links():
    """Test extracting summary with links preserves anchor tags"""
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "banner",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {"type": "text", "text": "Visit "},
                            {
                                "type": "text",
                                "text": "MIT Learn",
                                "marks": [
                                    {
                                        "type": "link",
                                        "attrs": {
                                            "href": "https://learn.mit.edu",
                                            "target": "_blank",
                                            "rel": "noopener noreferrer nofollow",
                                        },
                                    }
                                ],
                            },
                            {"type": "text", "text": " for more information."},
                        ],
                    }
                ],
            }
        ],
    }

    result = articles_news.extract_summary_from_banner(content_json)

    assert (
        result
        == 'Visit <a href="https://learn.mit.edu" target="_blank" rel="noopener noreferrer nofollow">MIT Learn</a> for more information.'
    )


def test_extract_summary_from_banner_with_multiple_links():
    """Test extracting summary with multiple links"""
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "banner",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {"type": "text", "text": "Check out "},
                            {
                                "type": "text",
                                "text": "MIT",
                                "marks": [
                                    {
                                        "type": "link",
                                        "attrs": {
                                            "href": "https://mit.edu",
                                            "target": "_blank",
                                            "rel": "noopener noreferrer nofollow",
                                        },
                                    }
                                ],
                            },
                            {"type": "text", "text": " and "},
                            {
                                "type": "text",
                                "text": "Google",
                                "marks": [
                                    {
                                        "type": "link",
                                        "attrs": {
                                            "href": "https://google.com",
                                            "target": "_blank",
                                            "rel": "noopener noreferrer",
                                        },
                                    }
                                ],
                            },
                            {"type": "text", "text": " for details."},
                        ],
                    }
                ],
            }
        ],
    }

    result = articles_news.extract_summary_from_banner(content_json)

    assert (
        result
        == 'Check out <a href="https://mit.edu" target="_blank" rel="noopener noreferrer nofollow">MIT</a> and <a href="https://google.com" target="_blank" rel="noopener noreferrer">Google</a> for details.'
    )


def test_extract_summary_from_banner_empty_content():
    """Test extracting summary from empty content"""
    result = articles_news.extract_summary_from_banner({})
    assert result == ""

    result = articles_news.extract_summary_from_banner(None)
    assert result == ""


def test_extract_summary_from_banner_no_paragraphs():
    """Test extracting summary when there are no paragraphs"""
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "banner",
                "content": [
                    {
                        "type": "heading",
                        "content": [{"type": "text", "text": "Only heading"}],
                    }
                ],
            },
            {
                "type": "image",
                "attrs": {"src": "http://example.com/image.jpg"},
            },
        ],
    }

    result = articles_news.extract_summary_from_banner(content_json)

    assert result == ""


def test_extract_summary_from_banner_empty_paragraphs():
    """Test extracting summary when paragraphs are empty"""
    content_json = {
        "type": "doc",
        "content": [
            {
                "type": "banner",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "   "}],
                    }
                ],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Non-empty paragraph."}],
            },
        ],
    }

    result = articles_news.extract_summary_from_banner(content_json)

    # Should skip empty/whitespace-only banner paragraph and use first non-empty
    assert result == "Non-empty paragraph."


def test_transform(mock_articles):
    """Test full transform pipeline"""
    articles_data = articles_news.extract()
    result = articles_news.transform(articles_data)

    assert len(result) == 1
    assert result[0]["title"] == "MIT Learn Articles"
    assert result[0]["feed_type"] == "news"
    assert result[0]["url"] == "/news"
    assert "items" in result[0]
    assert len(result[0]["items"]) == 1


def test_transform_with_no_articles():
    """Test transform with empty data"""
    result = articles_news.transform([])
    assert result == []


def test_extract_single_article():
    """Test extracting a single article"""
    from datetime import UTC, datetime

    # Create a mock user
    class User:
        first_name = "John"
        last_name = "Doe"
        username = "johndoe"

    # Create a mock article
    class MockArticle:
        id = 1
        title = "Test Article"
        slug = "test-article"
        content = {"blocks": [{"text": "Test content"}]}
        created_on = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        updated_on = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        publish_date = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        user = User()

    result = articles_news.extract_single_article(MockArticle())

    assert result["id"] == 1
    assert result["title"] == "Test Article"
    assert result["slug"] == "test-article"


def test_transform_single_article():
    """Test transforming a single article"""
    from datetime import UTC, datetime

    class MockUser:
        first_name = "John"
        last_name = "Doe"
        username = "johndoe"

    article_data = {
        "id": 1,
        "title": "Test Article",
        "slug": "test-article",
        "content": {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [{"type": "text", "text": "Test"}]}
            ],
        },
        "user": MockUser(),
        "created_on": datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC),
        "publish_date": datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC),
    }

    result = articles_news.transform_single_article(article_data)

    assert result is not None
    assert result["guid"] == "article-1"
    assert result["title"] == "Test Article"
    assert result["url"] == "/news/test-article"


def test_sync_single_article_to_news(mocker):
    """Test syncing a single article to news feed"""
    from datetime import UTC, datetime

    # Mock the FeedSource and loaders
    mock_source = mocker.Mock()
    mock_get_or_create = mocker.patch(
        "news_events.models.FeedSource.objects.get_or_create",
        return_value=(mock_source, True),
    )
    mock_load_feed_item = mocker.patch("news_events.etl.loaders.load_feed_item")

    # Create a mock user
    class User:
        first_name = "John"
        last_name = "Doe"
        username = "johndoe"

    # Create a mock article
    class MockArticle:
        id = 1
        title = "Test Article"
        slug = "test-article"
        content = {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [{"type": "text", "text": "Test"}]}
            ],
        }
        is_published = True
        created_on = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        updated_on = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        publish_date = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        user = User()

    # Sync the article
    articles_news.sync_single_article_to_news(MockArticle())

    # Verify FeedSource was created/retrieved
    mock_get_or_create.assert_called_once()

    # Verify load_feed_item was called
    mock_load_feed_item.assert_called_once()
    call_args = mock_load_feed_item.call_args
    assert call_args[0][0] == mock_source  # First arg is the source
    assert call_args[0][1]["guid"] == "article-1"  # Second arg is item_data


def test_sync_single_article_unpublished(mocker):
    """Test that unpublished articles are not synced"""
    mock_load_feed_item = mocker.patch("news_events.etl.loaders.load_feed_item")

    # Create an unpublished article
    class MockArticle:
        is_published = False

    # Sync the article
    articles_news.sync_single_article_to_news(MockArticle())

    # Verify load_feed_item was NOT called
    mock_load_feed_item.assert_not_called()
