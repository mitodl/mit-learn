from contextlib import contextmanager
from importlib import reload
from unittest.mock import patch

from news_events.constants import FeedType
from news_events.etl import pipelines


@contextmanager
def reload_mocked_pipeline(*patchers):
    """Create a context that is rolled back after executing the pipeline"""
    mocks = [patcher.start() for patcher in patchers]

    reload(pipelines)

    yield mocks

    for patcher in patchers:
        patcher.stop()

    reload(pipelines)


def test_medium_mit_news_etl():
    """Verify that medium mit news pipeline executes correctly"""
    with reload_mocked_pipeline(
        patch("news_events.etl.medium_mit_news.extract", autospec=True),
        patch("news_events.etl.medium_mit_news.transform", autospec=False),
        patch("news_events.etl.loaders.load_feed_sources", autospec=True),
    ) as patches:
        mock_extract, mock_transform, mock_load_sources = patches
        result = pipelines.medium_mit_news_etl()

    mock_extract.assert_called_once_with()

    # each of these should be called with the return value of the extract
    mock_transform.assert_called_once_with(mock_extract.return_value)

    # load_courses should be called *only* with the return value of transform
    mock_load_sources.assert_called_once_with(
        FeedType.news.name,
        mock_transform.return_value,
    )

    assert result == mock_load_sources.return_value


def test_ol_events_etl():
    """Verify that medium OL events pipeline executes correctly"""
    with reload_mocked_pipeline(
        patch("news_events.etl.ol_events.extract", autospec=True),
        patch("news_events.etl.ol_events.transform", autospec=False),
        patch("news_events.etl.loaders.load_feed_sources", autospec=True),
    ) as patches:
        mock_extract, mock_transform, mock_load_sources = patches
        result = pipelines.ol_events_etl()

    mock_extract.assert_called_once_with()

    # each of these should be called with the return value of the extract
    mock_transform.assert_called_once_with(mock_extract.return_value)

    # load_courses should be called *only* with the return value of transform
    mock_load_sources.assert_called_once_with(
        FeedType.events.name,
        mock_transform.return_value,
    )

    assert result == mock_load_sources.return_value
