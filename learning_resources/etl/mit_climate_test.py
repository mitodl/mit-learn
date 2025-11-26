from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest

from learning_resources.etl.mit_climate import extract_articles, transform_article


@pytest.fixture
def sample_article_data():
    return {
        "title": "Sample Article",
        "uuid": "12345",
        "url": "/sample-article",
        "summary": "This is a summary.",
        "footnotes": "These are footnotes.",
        "byline": "By Author",
        "created": "2023-10-01T12:00:00Z",
    }


@pytest.mark.django_db
def test_transform_article(sample_article_data, settings):
    """
    Test transforming a single article
    """

    result = transform_article(sample_article_data)

    assert result["title"] == "Sample Article"
    assert result["readable_id"] == "12345"
    assert result["url"] == f"{settings.MIT_CLIMATE_BASE_URL}/sample-article"
    assert result["description"] == "This is a summary."
    assert result["full_description"] == (
        "This is a summary.\nThese are footnotes.\nBy Author"
    )
    assert result["published"] is True
    assert result["created_on"] == datetime(2023, 10, 1, 16, 0, tzinfo=ZoneInfo("UTC"))


@patch("learning_resources.etl.mit_climate.retrieve_feed")
@patch("learning_resources.etl.mit_climate.settings")
def test_extract_articles(mock_settings, mock_retrieve_feed, sample_article_data):
    """
    Test extracting articles from multiple feeds
    """
    mock_settings.MIT_CLIMATE_EXPLAINERS_API_URL = "https://example.com/feed1"
    mock_settings.ASK_MIT_CLIMATE_API_URL = "https://example.com/feed2"
    mock_retrieve_feed.side_effect = [
        [sample_article_data],  # First feed response
        [sample_article_data],  # Second feed response
    ]

    articles = extract_articles()

    assert len(articles) == 2
    assert articles[0]["title"] == "Sample Article"
    assert articles[1]["title"] == "Sample Article"
    mock_retrieve_feed.assert_any_call("https://example.com/feed1")
    mock_retrieve_feed.assert_any_call("https://example.com/feed2")
