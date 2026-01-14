"""Tests for articles API functions"""

import pytest


@pytest.mark.django_db
def test_article_published_actions_triggers_hook(mocker, user):
    """Test that article_published_actions triggers the plugin hook for published articles"""
    from articles.api import article_published_actions
    from articles.models import Article

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
