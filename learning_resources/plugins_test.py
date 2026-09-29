"""Tests for learning_resources plugins"""

import pytest
from django.db import DatabaseError

from learning_resources.constants import FAVORITES_TITLE
from learning_resources.factories import UserListFactory
from learning_resources.plugins import (
    FavoritesListPlugin,
    WebsiteContentLearningResourcePlugin,
)
from main.factories import UserFactory


@pytest.mark.django_db
@pytest.mark.parametrize("existing_list", [True, False])
def test_favorites_plugin_user_created(existing_list):
    """A UserList with title favorites should be created if it doesn't exist"""
    user = UserFactory.create()
    if existing_list:
        UserListFactory.create(
            author=user, title=FAVORITES_TITLE, description="My Favorites"
        )
    FavoritesListPlugin().user_created(user, user_data={})
    user.refresh_from_db()
    assert user.user_lists.count() == 1


@pytest.mark.django_db
def test_website_content_published_hook_defers_to_a_task_on_commit(mocker):
    """
    Publishing queues its task through on_commit.

    Deferred so the task cannot read the content item before the write that
    triggered it has landed, and so the indexing is not on the request.
    """
    from website_content.factories import WebsiteContentFactory

    content = WebsiteContentFactory.create(is_published=True, content_type="article")
    mock_on_commit = mocker.patch("learning_resources.plugins.transaction.on_commit")
    mock_task = mocker.patch(
        "learning_resources.tasks.sync_website_content_learning_resource.delay"
    )

    WebsiteContentLearningResourcePlugin().website_content_published(content)

    assert mock_on_commit.call_count == 1
    # Nothing is queued until the transaction actually commits.
    assert mock_task.called is False

    mock_on_commit.call_args[0][0]()

    mock_task.assert_called_once_with(content.id)


@pytest.mark.django_db
def test_website_content_unpublished_hook_runs_in_the_request(mocker):
    """
    Unpublishing does not defer: the resource row is what the APIs read, so a
    flag left to a worker keeps serving an article the editor has taken down.
    """
    from website_content.factories import WebsiteContentFactory

    content = WebsiteContentFactory.create(is_published=False, content_type="article")
    mock_on_commit = mocker.patch("learning_resources.plugins.transaction.on_commit")
    mock_unpublish = mocker.patch(
        "learning_resources.api.unpublish_website_content_learning_resource"
    )

    WebsiteContentLearningResourcePlugin().website_content_unpublished(content)

    mock_unpublish.assert_called_once_with(content.id)
    assert mock_on_commit.called is False


@pytest.mark.django_db
@pytest.mark.parametrize(
    "failure",
    [
        # Racing the sync task for the same row.
        DatabaseError("deadlock detected"),
        # A broker that cannot be reached escapes `try_with_retry_as_task`,
        # whose own fallback is an unguarded `.delay()`.
        OSError("[Errno 111] Connection refused"),
        # Anything else the search or vector hooks raise.
        RuntimeError("boom"),
    ],
)
def test_website_content_unpublished_hook_queues_task_on_failure(mocker, failure):
    """
    Any failure hands off to the retrying task rather than raising.

    The editor's unpublish must not fail over the index, and a retried request
    would not help: `perform_update` fires this hook only on the
    published->unpublished transition, which has already committed.
    """
    from website_content.factories import WebsiteContentFactory

    content = WebsiteContentFactory.create(is_published=False, content_type="article")
    mock_on_commit = mocker.patch("learning_resources.plugins.transaction.on_commit")
    mocker.patch(
        "learning_resources.api.unpublish_website_content_learning_resource",
        side_effect=failure,
    )
    mock_task = mocker.patch(
        "learning_resources.tasks.unpublish_website_content_learning_resource_task.delay"
    )

    WebsiteContentLearningResourcePlugin().website_content_unpublished(content)

    assert mock_on_commit.call_count == 1
    mock_on_commit.call_args[0][0]()
    mock_task.assert_called_once_with(content.id)


@pytest.mark.django_db
def test_website_content_unpublished_hook_survives_an_unreachable_broker(mocker):
    """
    Queueing needs the broker, which may be what failed in the first place.

    There is nothing further to try at that point, so it is logged and the
    indexes are left to the next reindex -- the editor's unpublish still
    stands, since the rows it owns are already correct.
    """
    from website_content.factories import WebsiteContentFactory

    content = WebsiteContentFactory.create(is_published=False, content_type="article")
    mocker.patch(
        "learning_resources.api.unpublish_website_content_learning_resource",
        side_effect=OSError("[Errno 111] Connection refused"),
    )
    mocker.patch(
        "learning_resources.tasks.unpublish_website_content_learning_resource_task.delay",
        side_effect=OSError("[Errno 111] Connection refused"),
    )

    # Raising nothing is the assertion.
    WebsiteContentLearningResourcePlugin().website_content_unpublished(content)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "hook", ["website_content_published", "website_content_unpublished"]
)
def test_website_content_hooks_skip_news(mocker, hook):
    """
    News is never mirrored into a learning resource.

    It has the news feed, which `WebsiteContentNewsPlugin` syncs it into, and
    is not meant to turn up as a learning resource -- so neither hook should
    queue anything for it.
    """
    from website_content.factories import WebsiteContentFactory

    content = WebsiteContentFactory.create(is_published=True, content_type="news")
    mock_on_commit = mocker.patch("learning_resources.plugins.transaction.on_commit")
    mock_unpublish = mocker.patch(
        "learning_resources.api.unpublish_website_content_learning_resource"
    )

    getattr(WebsiteContentLearningResourcePlugin(), hook)(content)

    assert mock_on_commit.called is False
    assert mock_unpublish.called is False
