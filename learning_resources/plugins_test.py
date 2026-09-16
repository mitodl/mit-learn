"""Tests for learning_resources plugins"""

import pytest

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
@pytest.mark.parametrize(
    ("hook", "task_name"),
    [
        (
            "website_content_published",
            "sync_website_content_learning_resource",
        ),
        (
            "website_content_unpublished",
            "unpublish_website_content_learning_resource_task",
        ),
    ],
)
def test_website_content_hooks_defer_to_a_task_on_commit(mocker, hook, task_name):
    """
    Both hooks queue their task through on_commit.

    Deferred so the task cannot read the content item before the write that
    triggered it has landed, and so a slow index is not on the request.
    """
    from website_content.factories import WebsiteContentFactory

    content = WebsiteContentFactory.create(is_published=True)
    mock_on_commit = mocker.patch("learning_resources.plugins.transaction.on_commit")
    mock_task = mocker.patch(f"learning_resources.tasks.{task_name}.delay")

    getattr(WebsiteContentLearningResourcePlugin(), hook)(content)

    assert mock_on_commit.call_count == 1
    # Nothing is queued until the transaction actually commits.
    assert mock_task.called is False

    mock_on_commit.call_args[0][0]()

    mock_task.assert_called_once_with(content.id)
