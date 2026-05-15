"""Tests for website_content API functions"""

import pytest


@pytest.mark.django_db
def test_content_published_actions_triggers_hook(mocker, user):
    """Test that content_published_actions triggers the plugin hook for published items"""
    from website_content.api import content_published_actions
    from website_content.models import WebsiteContent

    mocker.patch("website_content.tasks.fastly_purge_relative_url")
    mocker.patch("website_content.tasks.fastly_purge_website_content_list.delay")

    content = WebsiteContent.objects.create(
        title="Published Article",
        content={"type": "doc", "content": []},
        is_published=True,
        user=user,
        content_type="news",
    )

    mock_pm = mocker.MagicMock()
    mock_hook = mocker.MagicMock()
    mock_pm.hook = mock_hook
    mocker.patch("website_content.api.get_plugin_manager", return_value=mock_pm)

    content_published_actions(content=content)

    mock_hook.website_content_published.assert_called_once_with(content=content)


@pytest.mark.django_db
def test_content_published_actions_skips_unpublished(mocker, user, caplog):
    """Test that content_published_actions skips unpublished items"""
    from website_content.api import content_published_actions
    from website_content.models import WebsiteContent

    content = WebsiteContent.objects.create(
        title="Draft Article",
        content={"type": "doc", "content": []},
        is_published=False,
        user=user,
        content_type="news",
    )

    mock_pm = mocker.MagicMock()
    mock_hook = mocker.MagicMock()
    mock_pm.hook = mock_hook
    mocker.patch("website_content.api.get_plugin_manager", return_value=mock_pm)

    content_published_actions(content=content)

    mock_hook.website_content_published.assert_not_called()

    assert (
        f"WebsiteContent {content.id} is not published, skipping plugin actions"
        in caplog.text
    )


@pytest.mark.django_db
def test_content_published_actions_logs_execution(mocker, user, caplog):
    """Test that content_published_actions logs when triggering plugins"""
    from website_content.api import content_published_actions
    from website_content.models import WebsiteContent

    mocker.patch("website_content.tasks.fastly_purge_relative_url")
    mocker.patch("website_content.tasks.fastly_purge_relative_url.delay")
    mocker.patch("website_content.tasks.fastly_purge_website_content_list.delay")

    content = WebsiteContent.objects.create(
        title="Test Article",
        content={"type": "doc", "content": []},
        is_published=True,
        user=user,
        content_type="news",
    )

    mock_pm = mocker.MagicMock()
    mock_hook = mocker.MagicMock()
    mock_pm.hook = mock_hook
    mocker.patch("website_content.api.get_plugin_manager", return_value=mock_pm)

    content_published_actions(content=content)

    assert "Triggering website_content_published plugins" in caplog.text
    assert f"id={content.id}" in caplog.text
    assert f"title={content.title}" in caplog.text
