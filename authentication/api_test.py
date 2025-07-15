"""API tests"""

import pytest
from django.contrib.auth import get_user_model

from authentication import api
from main.factories import UserFactory
from profiles.models import Profile

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.mark.django_db
@pytest.mark.parametrize(
    "profile_data",
    [
        {"name": "My Name", "image": "http://localhost/image.jpg"},
        # None,
    ],
)
def test_create_user(profile_data):
    """Tests that a user and associated objects are created"""
    email = "email@localhost"
    username = "username"
    user = api.create_user(username, email, profile_data, {"first_name": "Bob"})

    assert isinstance(user, User)
    assert user.email == email
    assert user.username == username
    assert user.first_name == "Bob"

    if "name" in profile_data:
        assert user.profile.name == profile_data["name"]
    else:
        assert user.profile.name is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    "profile_data",
    [
        {"name": "My Name", "image": "http://localhost/image.jpg"},
        # None,
    ],
)
def test_new_user_has_favorites_list(profile_data):
    """Tests that a user created via the API has a favorites list"""
    email = "email@localhost"
    username = "username"
    user = api.create_user(username, email, profile_data, {"first_name": "Bob"})

    assert isinstance(user, User)
    assert user.email == email
    assert user.username == username
    assert user.first_name == "Bob"

    user.refresh_from_db()
    assert user.user_lists.count() == 1


@pytest.mark.parametrize(
    "mock_method",
    ["profiles.api.ensure_profile"],
)
def test_create_user_errors(mocker, mock_method):
    """Test that we don't end up in a partial state if there are errors"""
    mocker.patch(mock_method, side_effect=Exception("error"))

    with pytest.raises(Exception):  # noqa: B017, PT011
        api.create_user(
            "username",
            "email@localhost",
            {"name": "My Name", "image": "http://localhost/image.jpg"},
        )

    assert User.objects.all().count() == 0
    assert Profile.objects.count() == 0


@pytest.mark.parametrize("is_new", [True, False])
def test_user_created_actions(mocker, is_new):
    """
    Tests that user_created_actions creates a favorites list for new users only
    """
    user = UserFactory.create()
    kwargs = {
        "user": user,
        "is_new": is_new,
        "details": {},
    }

    api.user_created_actions(**kwargs)
    assert user.user_lists.count() == (1 if is_new else 0)
