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
