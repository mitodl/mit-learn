"""Tests for website_content API functions"""

import pytest

from website_content.api import purge_content_on_save
from website_content.constants import WebsiteContentType
from website_content.factories import WebsiteContentFactory


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("slug", "is_published", "expect_purge"),
    [
        ("test-article", True, True),
        ("test-article", False, False),
        ("", True, False),
        ("", False, False),
    ],
)
def test_purge_content_on_save(mocker, slug, is_published, expect_purge):
    """
    CDN purge should only fire when the content is published AND has a slug.
    Asserts on call_fastly_purge_api (the lowest plumbing before the HTTP call)
    so the test is independent of FASTLY_API_KEY being set in the test env.
    @single_task uses a Redis lock so fastly_purge_website_content_list.delay
    is mocked to avoid that dependency in unit tests.
    """
    mock_purge_api = mocker.patch("website_content.tasks.call_fastly_purge_api")
    mock_purge_api.return_value = {"status": "ok", "id": "abc"}
    mocker.patch("website_content.tasks.fastly_purge_website_content_list.delay")

    content = WebsiteContentFactory.build(
        is_published=is_published,
        slug=slug or None,
        content_type=WebsiteContentType.news.name,
    )

    purge_content_on_save(content)

    if expect_purge:
        assert mock_purge_api.called
    else:
        mock_purge_api.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("content_type", "expected_listing"),
    [
        (WebsiteContentType.news.name, "/news"),
        (WebsiteContentType.article.name, "/articles"),
    ],
)
def test_purge_content_on_save_listing_url(mocker, content_type, expected_listing):
    """
    The listing-page purge task should be enqueued with the URL matching
    the content's content_type.
    """
    mocker.patch("website_content.tasks.call_fastly_purge_api").return_value = {
        "status": "ok",
        "id": "abc",
    }
    mock_purge_list = mocker.patch(
        "website_content.tasks.fastly_purge_website_content_list.delay"
    )

    content = WebsiteContentFactory.build(
        is_published=True,
        slug="some-slug",
        content_type=content_type,
    )
    mocker.patch.object(
        type(content), "get_url", return_value=f"/{content_type}/some-slug"
    )

    purge_content_on_save(content)

    mock_purge_list.assert_called_once_with(expected_listing)


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
