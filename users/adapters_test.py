import pytest
from django.test import RequestFactory

from main.factories import UserFactory
from users.adapters import LearnUserAdapter


@pytest.mark.django_db
def test_save_related_creates_profile_and_favorites_if_missing(mocker, settings):
    """
    Test that saving a LearnUserAdapter creates a profile and default favorites list
    """
    settings.MITOL_AUTHENTICATION_PLUGINS = "learning_resources.plugins.FavoritesListPlugin,profiles.plugins.CreateProfilePlugin"

    # simulate a new and blank unsaved user
    user = UserFactory.create()
    user.scim_id = None
    user.global_id = None
    user.id = None
    scimUser = LearnUserAdapter(user)
    scimUser.request = RequestFactory()
    scimUser.obj.request = RequestFactory()
    scimUser.from_dict(
        {
            "userName": "test",
            "fullName": {"name": "test"},
            "externalId": 123,
            "profile": {},
        }
    )
    scimUser.save()
    user.refresh_from_db()
    assert user.user_lists.count() == 1
    # Profile should be linked to user and saved
    assert user.profile.user == user


@pytest.mark.django_db
def test_scim_patch_acquires_select_for_update_lock(mocker):
    """
    Verify that saving an existing user via LearnUserAdapter acquires a
    SELECT FOR UPDATE row-level lock to serialize concurrent PATCH requests.
    """
    user = UserFactory.create()
    adapter = LearnUserAdapter(user)
    adapter.request = RequestFactory()

    # Intercept select_for_update on the User manager and return a mock
    # queryset whose .get() returns the real user object so the rest of
    # save() can proceed normally.
    mock_qs = mocker.MagicMock()
    mock_qs.get.return_value = user
    mock_sfu = mocker.patch.object(
        adapter.obj.__class__.objects, "select_for_update", return_value=mock_qs
    )
    # Suppress the on_commit callback so Celery is not invoked in this test.
    mocker.patch("users.adapters.transaction.on_commit")

    adapter.save()

    mock_sfu.assert_called_once()
    mock_qs.get.assert_called_once_with(pk=user.pk)


@pytest.mark.django_db
def test_scim_patch_dispatches_reindex_task_asynchronously(mocker):
    """
    Verify that updating an existing user via LearnUserAdapter registers
    reindex_user_learning_paths.delay() as a post-commit callback rather
    than calling OpenSearch indexing synchronously during the HTTP request.
    """
    user = UserFactory.create()
    adapter = LearnUserAdapter(user)
    adapter.request = RequestFactory()

    mock_delay = mocker.patch("users.adapters.reindex_user_learning_paths.delay")
    # Make transaction.on_commit fire the callback immediately so we can
    # assert on it within the test transaction boundary.
    mocker.patch("users.adapters.transaction.on_commit", side_effect=lambda fn: fn())

    adapter.save()

    mock_delay.assert_called_once_with(user.pk)
