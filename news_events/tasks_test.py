"""Tests for news_events tasks"""

import pytest

from news_events import tasks


def test_get_medium_mit_news(mocker):
    """Task should call the medium_mit_news_etl pipeline"""
    mock_etl = mocker.patch(
        "news_events.etl.pipelines.medium_mit_news_etl", autospec=True
    )
    tasks.get_medium_mit_news.delay()
    mock_etl.assert_called_once()


def test_get_ol_events(mocker):
    """Task should call the ol_events_etl pipeline"""
    mock_etl = mocker.patch("news_events.etl.pipelines.ol_events_etl", autospec=True)
    tasks.get_ol_events.delay()
    mock_etl.assert_called_once()


def test_get_sloan_exec_news(mocker):
    """Task should call the sloan_exec_news_etl pipeline"""
    mock_etl = mocker.patch(
        "news_events.etl.pipelines.sloan_exec_news_etl", autospec=True
    )
    tasks.get_sloan_exec_news.delay()
    mock_etl.assert_called_once()


def test_get_mitpe_events(mocker):
    """Task should call the mitpe_events_etl pipeline"""
    mock_etl = mocker.patch("news_events.etl.pipelines.mitpe_events_etl", autospec=True)
    tasks.get_mitpe_events.delay()
    mock_etl.assert_called_once()


def test_get_mitpe_news(mocker):
    """Task should call the mitpe_news_etl pipeline"""
    mock_etl = mocker.patch("news_events.etl.pipelines.mitpe_news_etl", autospec=True)
    tasks.get_mitpe_news.delay()
    mock_etl.assert_called_once()


@pytest.mark.django_db()
def test_sync_article_to_news_success(mocker, user):
    """Task should sync published article to news feed"""
    from articles.models import Article

    # Create a published article
    article = Article.objects.create(
        title="Test Article",
        content={"type": "doc", "content": []},
        is_published=True,
        user=user,
    )

    mock_sync = mocker.patch(
        "news_events.etl.articles_news.sync_single_article_to_news", autospec=True
    )
    mock_clear_cache = mocker.patch(
        "news_events.tasks.clear_views_cache", autospec=True
    )

    # Execute the task directly (not via .delay())
    tasks.sync_article_to_news(article.id)

    mock_sync.assert_called_once_with(article)
    mock_clear_cache.assert_called_once()


@pytest.mark.django_db()
def test_sync_article_to_news_article_not_found(mocker, caplog):
    """Task should log warning if article doesn't exist"""
    mock_sync = mocker.patch(
        "news_events.etl.articles_news.sync_single_article_to_news", autospec=True
    )
    mock_clear_cache = mocker.patch(
        "news_events.tasks.clear_views_cache", autospec=True
    )

    # Execute task with non-existent article ID
    tasks.sync_article_to_news(99999)

    # Should not call sync or clear cache
    mock_sync.assert_not_called()
    mock_clear_cache.assert_not_called()

    # Should log warning
    assert "Article 99999 not found or not published" in caplog.text


@pytest.mark.django_db()
def test_sync_article_to_news_unpublished_article(mocker, user, caplog):
    """Task should skip unpublished articles"""
    from articles.models import Article

    # Create an unpublished article
    article = Article.objects.create(
        title="Draft Article",
        content={"type": "doc", "content": []},
        is_published=False,
        user=user,
    )

    mock_sync = mocker.patch(
        "news_events.etl.articles_news.sync_single_article_to_news", autospec=True
    )
    mock_clear_cache = mocker.patch(
        "news_events.tasks.clear_views_cache", autospec=True
    )

    tasks.sync_article_to_news(article.id)

    # Should not sync unpublished articles
    mock_sync.assert_not_called()
    mock_clear_cache.assert_not_called()

    # Should log warning
    assert f"Article {article.id} not found or not published" in caplog.text


@pytest.mark.django_db()
def test_sync_article_to_news_sync_failure(mocker, user):
    """Task should retry on sync failure"""
    from articles.models import Article

    article = Article.objects.create(
        title="Test Article",
        content={"type": "doc", "content": []},
        is_published=True,
        user=user,
    )

    # Mock sync to raise an exception
    mock_sync = mocker.patch(
        "news_events.etl.articles_news.sync_single_article_to_news",
        autospec=True,
        side_effect=Exception("Sync failed"),
    )
    mock_clear_cache = mocker.patch(
        "news_events.tasks.clear_views_cache", autospec=True
    )

    # Should raise exception to trigger retry
    with pytest.raises(Exception, match="Sync failed"):
        tasks.sync_article_to_news(article.id)

    mock_sync.assert_called_once_with(article)
    # Cache should not be cleared if sync fails
    mock_clear_cache.assert_not_called()
