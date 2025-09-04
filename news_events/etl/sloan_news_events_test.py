"""Tests for MIT Sloan Executive Education news ETL pipeline"""

import pytest
from bs4 import BeautifulSoup

from news_events.constants import FeedType
from news_events.etl import sloan_news_events
from news_events.etl.utils import parse_date


@pytest.fixture
def mock_html_content():
    """Return mock HTML content matching the expected structure"""
    return """
    <html>
    <body>
        <div class="content-tiles-wrapper row blog-page-wrapper">
            <div class="content-tile col-12 col-md-4">
                <a class="content-tile-link text-decoration-none" href="/blog/real-estate-as-strategic-growth-engine.html">
                    <div class="menu-card menu-card-version-2 m-0">
                        <img class="img-fluid object-fit-cover dis-image menu-card-underline"
                            src="https://executive.mit.edu/dw/image/v2/BFHZ_PRD/on/demandware.static/-/Library-Sites-MSharedLibrary/default/dwcae74d72/images/blogImages/marios-gkortsilas-OAePEg3V93A-unsplash.jpg?sw=300"
                            alt="Real estate as a strategic growth engine"
                            data-image-path="https://executive.mit.edu/dw/image/v2/BFHZ_PRD/on/demandware.static/-/Library-Sites-MSharedLibrary/default/dwcae74d72/images/blogImages/marios-gkortsilas-OAePEg3V93A-unsplash.jpg?sw=300"
                            data-view-type="medium">
                        <div class="menu-card__content ellipsis-3-lines">
                            <div class="menu-card__disclaimer type-info menu-card-underline">
                                AI, Business Strategy, Operations, Faculty & Staff Thought Leadership
                            </div>
                            <h3 class="menu-card-underline">
                                Real estate as a strategic growth engine
                            </h3>
                            <p class="ellipsis-3-lines mb-3 menu-card-underline">
                                MIT thought leaders share perspectives on how space, technology, and people come together to shape the future of business.
                            </p>
                            <div class="menu-card__info type-info d-flex menu-card__infocustom menu-card-underline">
                                <span class="d-flex align-items-center">
                                    <i class="mr-1" width="16" height="16" data-lucide="message-square-quote" aria-hidden="true" focusable="false" role="img"></i>
                                    Blog Post
                                </span>
                                <span>Aug 15, 2024</span>
                            </div>
                        </div>
                    </div>
                </a>
            </div>
            <div class="content-tile col-12 col-md-4">
                <a class="content-tile-link text-decoration-none" href="/webinar/ai-future-business.html">
                    <div class="menu-card menu-card-version-2 m-0">
                        <img class="img-fluid object-fit-cover dis-image menu-card-underline"
                            src="https://executive.mit.edu/images/ai-webinar.jpg"
                            alt="AI and the Future of Business">
                        <div class="menu-card__content ellipsis-3-lines">
                            <div class="menu-card__disclaimer type-info menu-card-underline">
                                Technology, Innovation, Digital Transformation
                            </div>
                            <h3 class="menu-card-underline">
                                AI and the Future of Business
                            </h3>
                            <p class="ellipsis-3-lines mb-3 menu-card-underline">
                                Join experts as they discuss the transformative impact of AI on business operations and strategy.
                            </p>
                            <div class="menu-card__info type-info d-flex menu-card__infocustom menu-card-underline">
                                <span class="d-flex align-items-center">
                                    <i class="mr-1" width="16" height="16" data-lucide="video" aria-hidden="true" focusable="false" role="img"></i>
                                    Webinar
                                </span>
                                <span>Sep 20, 2024</span>
                            </div>
                        </div>
                    </div>
                </a>
            </div>
            <div class="content-tile col-12 col-md-4">
                <a class="content-tile-link text-decoration-none" href="/blog/leadership-crisis.html">
                    <div class="menu-card menu-card-version-2 m-0">
                        <img class="img-fluid object-fit-cover dis-image menu-card-underline"
                            src="https://executive.mit.edu/images/leadership.jpg"
                            alt="Leadership in Crisis">
                        <div class="menu-card__content ellipsis-3-lines">
                            <div class="menu-card__disclaimer type-info menu-card-underline">
                                Leadership, Management, Crisis Management
                            </div>
                            <h3 class="menu-card-underline">
                                Leadership in Times of Crisis
                            </h3>
                            <p class="ellipsis-3-lines mb-3 menu-card-underline">
                                How leaders can navigate uncertainty and guide their organizations through challenging times.
                            </p>
                            <div class="menu-card__info type-info d-flex menu-card__infocustom menu-card-underline">
                                <span class="d-flex align-items-center">
                                    <i class="mr-1" width="16" height="16" data-lucide="message-square-quote" aria-hidden="true" focusable="false" role="img"></i>
                                    Blog Post
                                </span>
                                <span>Jul 30, 2024</span>
                            </div>
                        </div>
                    </div>
                </a>
            </div>
        </div>
    </body>
    </html>
    """


@pytest.fixture
def sample_content_tiles(mock_html_content):
    """Return parsed BeautifulSoup content tiles for testing"""
    soup = BeautifulSoup(mock_html_content, "html.parser")
    content_wrapper = soup.find(
        "div", class_="content-tiles-wrapper row blog-page-wrapper"
    )
    return content_wrapper.find_all("div", class_="content-tile col-12 col-md-4")


@pytest.fixture(autouse=True)
def mock_requests_get(mocker, mock_html_content):
    """Mock requests.get to return HTML content"""
    mock_response = mocker.Mock()
    mock_response.content = mock_html_content.encode("utf-8")
    mock_response.raise_for_status.return_value = None
    mocker.patch(
        "news_events.etl.sloan_news_events.requests.get", return_value=mock_response
    )


def test_extract():
    """Extract function should return list of BeautifulSoup content tile elements"""
    result = sloan_news_events.extract()
    assert isinstance(result, list)
    assert len(result) == 3  # Three content tiles in our mock HTML

    # Verify each item is a BeautifulSoup element with expected structure
    for tile in result:
        assert tile.name == "div"
        assert "content-tile" in tile.get("class", [])
        assert tile.find("a", class_="content-tile-link") is not None
        assert tile.find("h3", class_="menu-card-underline") is not None


def test_transform_item_blog_post(sample_content_tiles):
    """Test transform_item with a blog post content tile"""
    blog_tile = sample_content_tiles[0]  # First tile is a blog post
    result = sloan_news_events.transform_item(blog_tile)

    # Test basic structure
    assert isinstance(result, dict)
    assert result["type"] == "news"

    # Test guid generation from href hash
    import hashlib

    expected_guid = hashlib.md5(  # noqa: S324
        b"/blog/real-estate-as-strategic-growth-engine.html"
    ).hexdigest()
    assert result["guid"] == expected_guid

    # Test URL construction
    assert (
        result["url"]
        == "https://executive.mit.edu/blog/real-estate-as-strategic-growth-engine.html"
    )

    # Test title extraction
    assert result["title"] == "Real estate as a strategic growth engine"

    # Test summary and content
    expected_text = "MIT thought leaders share perspectives on how space, technology, and people come together to shape the future of business."
    assert expected_text in result["summary"]
    assert expected_text in result["content"]

    # Test image data
    assert (
        result["image"]["url"]
        == "https://executive.mit.edu/dw/image/v2/BFHZ_PRD/on/demandware.static/-/Library-Sites-MSharedLibrary/default/dwcae74d72/images/blogImages/marios-gkortsilas-OAePEg3V93A-unsplash.jpg?sw=300"
    )
    assert result["image"]["alt"] == "Real estate as a strategic growth engine"
    assert result["image"]["description"] == "Real estate as a strategic growth engine"

    # Test topics parsing
    expected_topics = [
        "AI",
        "Business Strategy",
        "Operations",
        "Faculty & Staff Thought Leadership",
    ]
    assert result["detail"].get("topics") == expected_topics

    # Test publish date
    assert result["detail"].get("publish_date") == parse_date("Aug 15, 2024")


def test_transform_item_webinar(sample_content_tiles):
    """Test transform_item with a webinar content tile"""
    webinar_tile = sample_content_tiles[1]  # Second tile is a webinar
    result = sloan_news_events.transform_item(webinar_tile)

    # Test basic structure
    assert isinstance(result, dict)
    assert result["type"] == FeedType.events.name  # Should be event for webinars

    # Test guid generation
    import hashlib

    expected_guid = hashlib.md5(b"/webinar/ai-future-business.html").hexdigest()  # noqa: S324
    assert result["guid"] == expected_guid

    # Test URL construction
    assert result["url"] == "https://executive.mit.edu/webinar/ai-future-business.html"

    # Test title extraction
    assert result["title"] == "AI and the Future of Business"

    # Test summary and content
    expected_text = "Join experts as they discuss the transformative impact of AI on business operations and strategy."
    assert expected_text in result["summary"]
    assert expected_text in result["content"]

    # Test image data
    assert result["image"]["url"] == "https://executive.mit.edu/images/ai-webinar.jpg"
    assert result["image"]["alt"] == "AI and the Future of Business"

    # Test that webinar events don't have topics field (they have different detail structure)
    assert "topics" not in result["detail"]

    # Test webinar-specific fields
    assert result["detail"].get("event_type") == ["Webinar"]
    assert result["detail"].get("location") == ["Online"]

    # Test event datetime
    assert result["detail"].get("event_datetime") == parse_date("Sep 20, 2024")


def test_transform_item_missing_elements():
    """Test transform_item handles missing elements gracefully"""
    # Create minimal HTML with missing optional elements
    minimal_html = """
    <div class="content-tile col-12 col-md-4">
        <a class="content-tile-link text-decoration-none" href="/test.html">
            <div class="menu-card menu-card-version-2 m-0">
                <div class="menu-card__content ellipsis-3-lines">
                    <h3 class="menu-card-underline">Test Title</h3>
                </div>
            </div>
        </a>
    </div>
    """

    soup = BeautifulSoup(minimal_html, "html.parser")
    tile = soup.find("div", class_="content-tile")
    result = sloan_news_events.transform_item(tile)

    # Should handle missing elements gracefully
    assert result["title"] == "Test Title"
    assert result["url"] == "https://executive.mit.edu/test.html"
    assert result["summary"] == ""
    assert result["content"] == ""
    assert result["image"]["url"] == ""
    assert result["image"]["alt"] == ""
    assert result["detail"]["topics"] == []
    assert result["detail"]["publish_date"] is None
    assert result["type"] == "news"  # Default type


def test_transform_item_empty_element():
    """Test transform_item handles completely empty/malformed elements"""
    empty_html = '<div class="content-tile col-12 col-md-4"></div>'
    soup = BeautifulSoup(empty_html, "html.parser")
    tile = soup.find("div", class_="content-tile")
    result = sloan_news_events.transform_item(tile)

    # Should return None for empty elements without href
    assert result is None


def test_transform_items(sample_content_tiles):
    """Test transform_items function separates news and webinar items"""
    news_items, webinar_items = sloan_news_events.transform_items(sample_content_tiles)

    # Should have 2 news items and 1 webinar item based on our mock data
    assert len(news_items) == 2
    assert len(webinar_items) == 1

    # Verify news items
    assert all(item.get("type") != "event" for item in news_items)
    assert news_items[0]["title"] == "Real estate as a strategic growth engine"
    assert news_items[1]["title"] == "Leadership in Times of Crisis"

    # Verify webinar items
    assert webinar_items[0]["title"] == "AI and the Future of Business"

    # Ensure type field is removed from returned items
    for item in news_items + webinar_items:
        assert "type" not in item


def test_transform_items_empty_list():
    """Test transform_items handles empty input gracefully"""
    news_items, webinar_items = sloan_news_events.transform_items([])

    assert news_items == []
    assert webinar_items == []


def test_transform():
    """Test transform function returns news and webinar feeds"""
    transformed_data = sloan_news_events.transform(sloan_news_events.extract())

    # Should return 2 feeds: news and events
    assert len(transformed_data) == 2

    # Verify news feed structure
    news_feed = transformed_data[0]
    assert (
        news_feed["title"] == f"{sloan_news_events.SLOAN_EXEC_TITLE} - Blog & Stories"
    )
    assert news_feed["url"] == sloan_news_events.SLOAN_EXEC_NEWS_URL
    assert news_feed["feed_type"] == FeedType.news.name
    assert (
        news_feed["description"]
        == f"{sloan_news_events.SLOAN_EXEC_TITLE} - Blog & Stories"
    )

    # Verify events feed structure
    events_feed = transformed_data[1]
    assert events_feed["title"] == f"{sloan_news_events.SLOAN_EXEC_TITLE} - Webinars"
    assert events_feed["url"] == sloan_news_events.SLOAN_EXEC_WEBINARS_URL
    assert events_feed["feed_type"] == FeedType.events.name
    # Verify items in feeds
    news_items = list(news_feed["items"])
    webinar_items = list(events_feed["items"])

    # Should have 2 news items and 1 webinar item
    assert len(news_items) == 2
    assert len(webinar_items) == 1

    # Verify content structure
    assert news_items[0]["title"] == "Real estate as a strategic growth engine"
    assert news_items[0]["detail"]["publish_date"] == parse_date("Aug 15, 2024")
    assert webinar_items[0]["title"] == "AI and the Future of Business"


def test_extract_missing_wrapper(mocker):
    """Test extract handles missing content wrapper gracefully"""
    # Mock HTML without the expected wrapper
    html_without_wrapper = "<html><body><div>No wrapper here</div></body></html>"
    mock_response = mocker.Mock()
    mock_response.content = html_without_wrapper.encode("utf-8")
    mock_response.raise_for_status.return_value = None
    mocker.patch(
        "news_events.etl.sloan_news_events.requests.get", return_value=mock_response
    )

    mock_log = mocker.patch("news_events.etl.sloan_news_events.log.warning")
    result = sloan_news_events.extract()

    assert result == []
    mock_log.assert_called_once_with("Could not find content-tiles-wrapper")


def test_extract_http_error(mocker):
    """Test extract handles HTTP errors properly"""
    mock_response = mocker.Mock()
    mock_response.raise_for_status.side_effect = Exception("HTTP 404 Error")
    mocker.patch(
        "news_events.etl.sloan_news_events.requests.get", return_value=mock_response
    )

    # Should propagate the exception
    with pytest.raises(Exception, match="HTTP 404 Error"):
        sloan_news_events.extract()


def test_extract_empty_content_tiles(mocker):
    """Test extract when no content tiles are found"""
    # HTML with wrapper but no content tiles
    html_with_empty_wrapper = """
    <html>
    <body>
        <div class="content-tiles-wrapper row blog-page-wrapper">
            <!-- No content tiles here -->
        </div>
    </body>
    </html>
    """
    mock_response = mocker.Mock()
    mock_response.content = html_with_empty_wrapper.encode("utf-8")
    mock_response.raise_for_status.return_value = None
    mocker.patch(
        "news_events.etl.sloan_news_events.requests.get", return_value=mock_response
    )

    result = sloan_news_events.extract()
    assert result == []


def test_transform_item_malformed_topics():
    """Test transform_item handles malformed topics gracefully"""
    malformed_html = """
    <div class="content-tile col-12 col-md-4">
        <a class="content-tile-link text-decoration-none" href="/test.html">
            <div class="menu-card menu-card-version-2 m-0">
                <div class="menu-card__content ellipsis-3-lines">
                    <div class="menu-card__disclaimer type-info menu-card-underline">
                        , , , Multiple,Commas,,,With,Empty,Values,
                    </div>
                    <h3 class="menu-card-underline">Test Title</h3>
                </div>
            </div>
        </a>
    </div>
    """

    soup = BeautifulSoup(malformed_html, "html.parser")
    tile = soup.find("div", class_="content-tile")
    result = sloan_news_events.transform_item(tile)

    # Should filter out empty strings from topics
    expected_topics = ["Multiple", "Commas", "With", "Empty", "Values"]
    assert result["detail"]["topics"] == expected_topics


def test_transform_item_special_characters():
    """Test transform_item handles special characters and encoding properly"""
    special_chars_html = """
    <div class="content-tile col-12 col-md-4">
        <a class="content-tile-link text-decoration-none" href="/test-émojis-ñoño.html">
            <div class="menu-card menu-card-version-2 m-0">
                <div class="menu-card__content ellipsis-3-lines">
                    <h3 class="menu-card-underline">Title with émojis & ñoño characters</h3>
                    <p class="ellipsis-3-lines mb-3 menu-card-underline">
                        Content with "quotes" & special chars like: café, naïve, résumé
                    </p>
                </div>
            </div>
        </a>
    </div>
    """

    soup = BeautifulSoup(special_chars_html, "html.parser")
    tile = soup.find("div", class_="content-tile")
    result = sloan_news_events.transform_item(tile)

    # Should preserve special characters
    assert result["title"] == "Title with émojis & ñoño characters"
    assert "café, naïve, résumé" in result["summary"]
    assert result["url"] == "https://executive.mit.edu/test-émojis-ñoño.html"


def test_transform_with_mixed_content_types(mocker):
    """Test transform function with various content types and edge cases"""
    # Create a mix of valid and problematic content
    mixed_html = """
    <html>
    <body>
        <div class="content-tiles-wrapper row blog-page-wrapper">
            <!-- Valid blog post -->
            <div class="content-tile col-12 col-md-4">
                <a class="content-tile-link text-decoration-none" href="/blog/valid-post.html">
                    <div class="menu-card menu-card-version-2 m-0">
                        <div class="menu-card__content ellipsis-3-lines">
                            <h3 class="menu-card-underline">Valid Blog Post</h3>
                            <div class="menu-card__info type-info d-flex menu-card__infocustom menu-card-underline">
                                <span>Blog Post</span>
                                <span>Jan 1, 2024</span>
                            </div>
                        </div>
                    </div>
                </a>
            </div>
            <!-- Valid webinar -->
            <div class="content-tile col-12 col-md-4">
                <a class="content-tile-link text-decoration-none" href="/webinar/valid-webinar.html">
                    <div class="menu-card menu-card-version-2 m-0">
                        <div class="menu-card__content ellipsis-3-lines">
                            <h3 class="menu-card-underline">Valid Webinar</h3>
                            <div class="menu-card__info type-info d-flex menu-card__infocustom menu-card-underline">
                                <span>Webinar</span>
                                <span>Feb 1, 2024</span>
                            </div>
                        </div>
                    </div>
                </a>
            </div>
            <!-- Malformed tile - missing link -->
            <div class="content-tile col-12 col-md-4">
                <div class="menu-card menu-card-version-2 m-0">
                    <div class="menu-card__content ellipsis-3-lines">
                        <h3 class="menu-card-underline">No Link Title</h3>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """

    mock_response = type(
        "MockResponse",
        (),
        {"content": mixed_html.encode("utf-8"), "raise_for_status": lambda: None},
    )()

    with mocker.patch(
        "news_events.etl.sloan_news_events.requests.get", return_value=mock_response
    ):
        result = sloan_news_events.transform(sloan_news_events.extract())

    # Should handle all tiles, even malformed ones
    news_feed = result[0]
    events_feed = result[1]

    news_items = list(news_feed["items"])
    webinar_items = list(events_feed["items"])

    # Should have 1 news item and 1 webinar (malformed item is filtered out)
    assert len(news_items) == 1
    assert len(webinar_items) == 1

    # Valid items should be processed correctly
    assert news_items[0]["title"] == "Valid Blog Post"
    assert webinar_items[0]["title"] == "Valid Webinar"
