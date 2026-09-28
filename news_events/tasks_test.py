"""Tests for news_events tasks"""

import pytest

from news_events import tasks


@pytest.fixture(autouse=True)
def _mock_cdn_purge(mocker):
    """Auto-mock CDN purge tasks for all tests in this module"""
    mocker.patch("website_content.tasks.fastly_purge_relative_url")
    mocker.patch("website_content.tasks.fastly_purge_relative_url.delay")
    mocker.patch("website_content.tasks.fastly_purge_website_content_list.delay")


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


@pytest.mark.django_db
def test_sync_article_to_news_success(mocker, user):
    """Task should sync published website content item to news feed"""
    from website_content.models import WebsiteContent

    content = WebsiteContent.objects.create(
        title="Test Article",
        content={"type": "doc", "content": []},
        is_published=True,
        user=user,
        content_type="news",
    )

    mock_sync = mocker.patch(
        "news_events.etl.articles_news.sync_single_website_content_news_to_news",
        autospec=True,
    )

    tasks.sync_website_content_to_news(content.id)

    mock_sync.assert_called_once_with(content)


@pytest.mark.django_db
def test_sync_article_to_news_article_not_found(mocker, caplog):
    """Task should log warning if content item doesn't exist"""
    mock_sync = mocker.patch(
        "news_events.etl.articles_news.sync_single_website_content_news_to_news",
        autospec=True,
    )

    tasks.sync_website_content_to_news(99999)

    mock_sync.assert_not_called()

    assert "WebsiteContent 99999 not found or not published" in caplog.text


@pytest.mark.django_db
def test_sync_article_to_news_unpublished_article(mocker, user, caplog):
    """Task should skip unpublished content items"""
    from website_content.models import WebsiteContent

    content = WebsiteContent.objects.create(
        title="Draft Article",
        content={"type": "doc", "content": []},
        is_published=False,
        user=user,
        content_type="news",
    )

    mock_sync = mocker.patch(
        "news_events.etl.articles_news.sync_single_website_content_news_to_news",
        autospec=True,
    )

    tasks.sync_website_content_to_news(content.id)

    mock_sync.assert_not_called()

    assert f"WebsiteContent {content.id} not found or not published" in caplog.text


@pytest.mark.django_db
def test_sync_article_to_news_sync_failure(mocker, user):
    """Task should retry on sync failure"""
    from website_content.models import WebsiteContent

    content = WebsiteContent.objects.create(
        title="Test Article",
        content={"type": "doc", "content": []},
        is_published=True,
        user=user,
        content_type="news",
    )

    mock_sync = mocker.patch(
        "news_events.etl.articles_news.sync_single_website_content_news_to_news",
        autospec=True,
        side_effect=Exception("Sync failed"),
    )

    with pytest.raises(Exception, match="Sync failed"):
        tasks.sync_website_content_to_news(content.id)

    mock_sync.assert_called_once_with(content)


def _news_content(user, *, is_published):
    from website_content.models import WebsiteContent

    return WebsiteContent.objects.create(
        title="Test Article",
        content={"type": "doc", "content": []},
        is_published=is_published,
        user=user,
        content_type="news",
    )


@pytest.mark.django_db
def test_sync_website_content_to_news_removes_an_entry_it_must_not_keep():
    """
    Finding the item unpublished removes any feed entry, rather than skipping.

    That is what makes a retry effective: the reconciliation below runs inside
    the task's own try, so a delete that fails there retries the whole task --
    and the retry arrives here, with the row already unpublished. Skipping
    would strand the entry it had just created.
    """
    from news_events.constants import FeedType
    from news_events.etl.articles_news import website_content_feed_guid
    from news_events.models import FeedItem, FeedSource
    from website_content.factories import WebsiteContentFactory

    content = WebsiteContentFactory.create(is_published=False, content_type="news")
    source = FeedSource.objects.create(
        title="MIT Learn Articles", url="/news", feed_type=FeedType.news.name
    )
    guid = website_content_feed_guid(content.id)
    FeedItem.objects.create(
        guid=guid, source=source, title=content.title, url="/news/stranded"
    )

    tasks.sync_website_content_to_news.delay(content.id)

    assert not FeedItem.objects.filter(guid=guid).exists()


@pytest.mark.django_db
def test_sync_website_content_to_news_undoes_itself_if_unpublished_meanwhile(mocker):
    """
    A sync that overtakes an unpublish reconciles against the row.

    Unpublishing removes the feed entry in the request, so it can land after
    this task has read the item as published but before the task writes -- and
    there is nothing queued behind it to notice. Left alone, the sync would put
    the story back in the feed after it was taken down.
    """
    from news_events.etl import articles_news
    from news_events.models import FeedItem
    from website_content.factories import WebsiteContentFactory
    from website_content.models import WebsiteContent

    content = WebsiteContentFactory.create(is_published=True, content_type="news")
    real_sync = articles_news.sync_single_website_content_news_to_news

    def unpublish_then_sync(item):
        """Stand in for the editor's unpublish, after the published check."""
        WebsiteContent.objects.filter(id=item.id).update(is_published=False)
        return real_sync(item)

    mocker.patch(
        "news_events.etl.articles_news.sync_single_website_content_news_to_news",
        side_effect=unpublish_then_sync,
    )

    tasks.sync_website_content_to_news.delay(content.id)

    guid = articles_news.website_content_feed_guid(content.id)
    assert not FeedItem.objects.filter(guid=guid).exists()


def test_delete_website_content_from_news_removes_the_entry(mocker, user):
    """The ordinary case: the item is unpublished, so its entry goes"""
    content = _news_content(user, is_published=False)
    mock_delete = mocker.patch(
        "news_events.etl.articles_news.delete_website_content_news_from_news",
        autospec=True,
        return_value=1,
    )

    tasks.delete_website_content_from_news(content.id)

    mock_delete.assert_called_once_with(content.id)


@pytest.mark.django_db
def test_delete_website_content_from_news_skips_republished(mocker, user, caplog):
    """
    A queued delete can run after the item was republished. Deleting then would
    strip the entry the republish just recreated, so the task must stand down.
    """
    content = _news_content(user, is_published=True)
    mock_delete = mocker.patch(
        "news_events.etl.articles_news.delete_website_content_news_from_news",
        autospec=True,
    )

    tasks.delete_website_content_from_news(content.id)

    mock_delete.assert_not_called()
    assert (
        f"WebsiteContent {content.id} is published again, skipping news feed removal"
        in caplog.text
    )


@pytest.mark.django_db
def test_delete_website_content_from_news_deletes_when_row_is_gone(mocker):
    """Content hard-deleted since the task was queued still gets cleaned up"""
    mock_delete = mocker.patch(
        "news_events.etl.articles_news.delete_website_content_news_from_news",
        autospec=True,
        return_value=1,
    )

    tasks.delete_website_content_from_news(99999)

    mock_delete.assert_called_once_with(99999)


@pytest.mark.django_db
def test_delete_website_content_from_news_deletes_when_soft_deleted(mocker, user):
    """
    A soft-deleted row must not keep its feed entry alive. It is hidden by the
    default manager even though `is_published` is still True on the row, which
    is exactly why the guard queries through `objects`.
    """
    content = _news_content(user, is_published=True)
    content.delete()  # SOFT_DELETE: the row survives, hidden from `objects`
    mock_delete = mocker.patch(
        "news_events.etl.articles_news.delete_website_content_news_from_news",
        autospec=True,
        return_value=1,
    )

    tasks.delete_website_content_from_news(content.id)

    mock_delete.assert_called_once_with(content.id)
