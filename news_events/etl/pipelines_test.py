from contextlib import contextmanager
from importlib import reload
from unittest.mock import patch

import pytest

from learning_resources.factories import ETLSourceOwnershipFactory
from learning_resources.models import ETLSourceOwnership
from news_events.constants import FeedType
from news_events.etl import pipelines

# Every pipeline checks ETLSourceOwnership before it extracts.
pytestmark = pytest.mark.django_db


@contextmanager
def reload_mocked_pipeline(*patchers):
    """Create a context that is rolled back after executing the pipeline"""
    mocks = [patcher.start() for patcher in patchers]

    reload(pipelines)

    yield mocks

    for patcher in patchers:
        patcher.stop()

    reload(pipelines)


def test_ol_events_etl():
    """Verify that the OL events pipeline executes correctly"""
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


def test_sloan_edtech_news_etl():
    """Verify that the Sloan news pipeline executes correctly"""
    with reload_mocked_pipeline(
        patch("news_events.etl.sloan_exec_news.extract", autospec=True),
        patch("news_events.etl.sloan_exec_news.transform", autospec=False),
        patch("news_events.etl.loaders.load_feed_sources", autospec=True),
    ) as patches:
        mock_extract, mock_transform, mock_load_sources = patches
        result = pipelines.sloan_exec_news_etl()

    mock_extract.assert_called_once_with()

    # each of these should be called with the return value of the extract
    mock_transform.assert_called_once_with(mock_extract.return_value)

    # load_courses should be called *only* with the return value of transform
    mock_load_sources.assert_called_once_with(
        FeedType.news.name,
        mock_transform.return_value,
    )
    assert result == mock_load_sources.return_value


def test_mitpe_news_etl():
    """Verify that the mitpe news pipeline executes correctly"""
    with reload_mocked_pipeline(
        patch("news_events.etl.mitpe_news.extract", autospec=True),
        patch("news_events.etl.mitpe_news.transform", autospec=False),
        patch("news_events.etl.loaders.load_feed_sources", autospec=True),
    ) as patches:
        mock_extract, mock_transform, mock_load_sources = patches
        result = pipelines.mitpe_news_etl()

    mock_extract.assert_called_once_with()

    # each of these should be called with the return value of the extract
    mock_transform.assert_called_once_with(mock_extract.return_value)

    # load_courses should be called *only* with the return value of transform
    mock_load_sources.assert_called_once_with(
        FeedType.news.name,
        mock_transform.return_value,
    )

    assert result == mock_load_sources.return_value


def test_mitpe_events_etl():
    """Verify that the mitpe events pipeline executes correctly"""
    with reload_mocked_pipeline(
        patch("news_events.etl.mitpe_events.extract", autospec=True),
        patch("news_events.etl.mitpe_events.transform", autospec=False),
        patch("news_events.etl.loaders.load_feed_sources", autospec=True),
    ) as patches:
        mock_extract, mock_transform, mock_load_sources = patches
        result = pipelines.mitpe_events_etl()

    mock_extract.assert_called_once_with()

    # each of these should be called with the return value of the extract
    mock_transform.assert_called_once_with(mock_extract.return_value)

    # load_courses should be called *only* with the return value of transform
    mock_load_sources.assert_called_once_with(
        FeedType.events.name,
        mock_transform.return_value,
    )

    assert result == mock_load_sources.return_value


@pytest.mark.parametrize("owner", list(ETLSourceOwnership.Pipeline))
@pytest.mark.parametrize(
    ("pipeline", "module", "feed", "feed_type"),
    [
        ("medium_mit_news_etl", "medium_mit_news", "medium_mit_news", FeedType.news),
        ("sloan_exec_news_etl", "sloan_exec_news", "sloan_exec_news", FeedType.news),
        ("sloan_webinars_etl", "sloan_webinars", "sloan_webinars", FeedType.events),
        ("ol_events_etl", "ol_events", "ol_events", FeedType.events),
        ("mitpe_news_etl", "mitpe_news", "mitpe_news", FeedType.news),
        ("mitpe_events_etl", "mitpe_events", "mitpe_events", FeedType.events),
        ("articles_news_etl", "articles_news", "articles_news", FeedType.news),
    ],
)
def test_feed_pipelines_run_only_while_legacy_owns_the_feed(
    owner, pipeline, module, feed, feed_type
):
    """A feed cut over elsewhere is neither fetched nor loaded"""
    ETLSourceOwnershipFactory.create(
        etl_source=feed, resource_type=feed_type.name, owner=owner
    )
    with reload_mocked_pipeline(
        patch(f"news_events.etl.{module}.extract", autospec=True),
        patch(f"news_events.etl.{module}.transform", autospec=False),
        patch("news_events.etl.loaders.load_feed_sources", autospec=True),
    ) as (mock_extract, _, mock_load_sources):
        result = getattr(pipelines, pipeline)()

    legacy = owner == ETLSourceOwnership.Pipeline.LEGACY
    assert mock_extract.called is legacy
    assert mock_load_sources.called is legacy
    if not legacy:
        assert result == []
