"""Tests for articles API functions"""

import pytest


@pytest.mark.django_db
def test_article_published_actions_triggers_hook(mocker, user):
    """Test that article_published_actions triggers the plugin hook for published articles"""
    from articles.api import article_published_actions
    from articles.models import Article

    # Mock CDN purge tasks
    mocker.patch("articles.tasks.queue_fastly_purge_article.delay")
    mocker.patch("articles.tasks.queue_fastly_purge_articles_list.delay")

    # Create a published article
    article = Article.objects.create(
        title="Published Article",
        content={"type": "doc", "content": []},
        is_published=True,
        user=user,
    )

    # Mock the plugin manager and hook
    mock_pm = mocker.MagicMock()
    mock_hook = mocker.MagicMock()
    mock_pm.hook = mock_hook
    mocker.patch("articles.api.get_plugin_manager", return_value=mock_pm)

    # Call the function
    article_published_actions(article=article)

    # Verify hook was called with the article
    mock_hook.article_published.assert_called_once_with(article=article)


@pytest.mark.django_db
def test_article_published_actions_skips_unpublished(mocker, user, caplog):
    """Test that article_published_actions skips unpublished articles"""
    from articles.api import article_published_actions
    from articles.models import Article

    # Create an unpublished article
    article = Article.objects.create(
        title="Draft Article",
        content={"type": "doc", "content": []},
        is_published=False,
        user=user,
    )

    # Mock the plugin manager
    mock_pm = mocker.MagicMock()
    mock_hook = mocker.MagicMock()
    mock_pm.hook = mock_hook
    mocker.patch("articles.api.get_plugin_manager", return_value=mock_pm)

    # Call the function
    article_published_actions(article=article)

    # Verify hook was NOT called
    mock_hook.article_published.assert_not_called()

    # Verify log message
    assert (
        f"Article {article.id} is not published, skipping plugin actions" in caplog.text
    )


@pytest.mark.django_db
def test_article_published_actions_logs_execution(mocker, user, caplog):
    """Test that article_published_actions logs when triggering plugins"""
    from articles.api import article_published_actions
    from articles.models import Article

    # Mock CDN purge tasks
    mocker.patch("articles.tasks.queue_fastly_purge_article.delay")
    mocker.patch("articles.tasks.queue_fastly_purge_articles_list.delay")

    # Create a published article
    article = Article.objects.create(
        title="Test Article",
        content={"type": "doc", "content": []},
        is_published=True,
        user=user,
    )

    # Mock the plugin manager
    mock_pm = mocker.MagicMock()
    mock_hook = mocker.MagicMock()
    mock_pm.hook = mock_hook
    mocker.patch("articles.api.get_plugin_manager", return_value=mock_pm)

    # Call the function
    article_published_actions(article=article)

    # Verify logging
    assert "Triggering article_published plugins for article" in caplog.text
    assert f"id={article.id}" in caplog.text
    assert f"title={article.title}" in caplog.text


@pytest.mark.django_db
class TestPurgeArticleOnSave:
    """Tests for purge_article_on_save function"""

    def test_purge_on_published_article(self, mocker):
        """Test that CDN purge is triggered for a published article"""
        from articles.api import purge_article_on_save
        from articles.factories import ArticleFactory

        # Mock call_fastly_purge_api to fail so it falls back to Celery task
        mocker.patch("articles.tasks.call_fastly_purge_api", return_value=False)

        mock_purge_article = mocker.patch(
            "articles.tasks.queue_fastly_purge_article.delay"
        )
        mock_purge_list = mocker.patch(
            "articles.tasks.queue_fastly_purge_articles_list.delay"
        )

        article = ArticleFactory(is_published=True)

        purge_article_on_save(article)

        mock_purge_article.assert_called_once_with(article.id)
        mock_purge_list.assert_called_once()

    def test_no_purge_on_unpublished_article(self, mocker):
        """Test that CDN purge is NOT triggered for unpublished articles"""
        from articles.api import purge_article_on_save
        from articles.factories import ArticleFactory

        mock_purge_article = mocker.patch(
            "articles.tasks.queue_fastly_purge_article.delay"
        )
        mock_purge_list = mocker.patch(
            "articles.tasks.queue_fastly_purge_articles_list.delay"
        )

        article = ArticleFactory(is_published=False)

        purge_article_on_save(article)

        mock_purge_article.assert_not_called()
        mock_purge_list.assert_not_called()

    def test_no_purge_on_article_without_slug(self, mocker):
        """Test that CDN purge is NOT triggered for articles without slug"""
        from articles.api import purge_article_on_save
        from articles.factories import ArticleFactory

        mock_purge_article = mocker.patch(
            "articles.tasks.queue_fastly_purge_article.delay"
        )
        mock_purge_list = mocker.patch(
            "articles.tasks.queue_fastly_purge_articles_list.delay"
        )

        article = ArticleFactory(is_published=True)
        article.slug = None

        purge_article_on_save(article)

        mock_purge_article.assert_not_called()
        mock_purge_list.assert_not_called()

    def test_purge_on_article_with_slug(self, mocker):
        """Test that CDN purge is triggered when article has slug and is published"""
        from articles.api import purge_article_on_save
        from articles.factories import ArticleFactory

        # Mock call_fastly_purge_api to fail so it falls back to Celery task
        mocker.patch("articles.tasks.call_fastly_purge_api", return_value=False)

        mock_purge_article = mocker.patch(
            "articles.tasks.queue_fastly_purge_article.delay"
        )
        mock_purge_list = mocker.patch(
            "articles.tasks.queue_fastly_purge_articles_list.delay"
        )

        article = ArticleFactory(is_published=True, slug="test-article")

        purge_article_on_save(article)

        mock_purge_article.assert_called_once_with(article.id)
        mock_purge_list.assert_called_once()
