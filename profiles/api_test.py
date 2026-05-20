"""Profile API tests"""

import pytest
from mitol.keycloak.data_models import UserAttributes

from main.factories import UserFactory
from profiles import api
from profiles.api import (
    get_site_type_from_url,
    sync_to_keycloak,
)
from profiles.models import (
    FACEBOOK_DOMAIN,
    LINKEDIN_DOMAIN,
    PERSONAL_SITE_TYPE,
    TWITTER_DOMAIN,
    Profile,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "profile_data", [{"image": "http://localhost:image.jpg"}, {}, None]
)
@pytest.mark.parametrize("no_profile", [True, False])
def test_ensure_profile(profile_data, no_profile):
    """Test that it creates a profile from the data"""
    user = UserFactory.create(email="testuser@example.com", no_profile=no_profile)
    profile = api.ensure_profile(user, profile_data=profile_data)

    assert isinstance(profile, Profile)

    if no_profile:
        if profile_data and "image" in profile_data:
            assert profile.image == profile_data["image"]
        else:
            assert not profile.image


@pytest.mark.parametrize(
    ("url", "exp_site_type"),
    [
        ("http://facebook.co.uk", FACEBOOK_DOMAIN),
        ("HTTP://FACEBOOK.CO.UK", FACEBOOK_DOMAIN),
        ("http://twitter.com", TWITTER_DOMAIN),
        ("https://www.linkedin.com", LINKEDIN_DOMAIN),
        ("https://not.a.socialsite.ca", PERSONAL_SITE_TYPE),
        ("bad_url", PERSONAL_SITE_TYPE),
    ],
)
def test_get_site_type_from_url(url, exp_site_type):
    """Test that get_site_type_from_url returns the expected site type for a given URL value"""
    assert get_site_type_from_url(url) == exp_site_type


def test_sync_to_keycloak(mocker):
    """Test that syncing to keycloak correctly maps attributes"""
    user = UserFactory.create()
    mock_api = mocker.patch("profiles.api.keycloak_api")

    sync_to_keycloak(user.profile, ["location"])
    mock_api.update_user.assert_not_called()

    sync_to_keycloak(user.profile, ["name"])
    mock_api.update_user.assert_called_once_with(
        user.global_id,
        attributes=UserAttributes(
            full_name=user.profile.name,
        ),
    )
