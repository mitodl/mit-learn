"""Profile API tests"""

import pytest
from keycloak.exceptions import KeycloakError
from mitol.keycloak.data_models import UserAttributes

from main.factories import UserFactory
from profiles import api
from profiles.api import (
    get_site_type_from_url,
    sync_email_optin_to_keycloak,
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
def test_ensure_profile(mocker, profile_data, no_profile):
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


def test_sync_email_optin_to_keycloak_not_configured(mocker):
    """Test that no Keycloak call is made if the admin client isn't configured"""
    mocker.patch.object(
        api.keycloak_api, "is_admin_client_configured", return_value=False
    )
    update_user_mock = mocker.patch.object(api.keycloak_api, "update_user")
    user = UserFactory.build(global_id="some-global-id")

    sync_email_optin_to_keycloak(user, email_optin=True)

    update_user_mock.assert_not_called()


def test_sync_email_optin_to_keycloak_no_global_id(mocker):
    """Test that no Keycloak call is made if the user has no global_id"""
    mocker.patch.object(
        api.keycloak_api, "is_admin_client_configured", return_value=True
    )
    update_user_mock = mocker.patch.object(api.keycloak_api, "update_user")
    user = UserFactory.build(global_id=None)

    sync_email_optin_to_keycloak(user, email_optin=True)

    update_user_mock.assert_not_called()


def test_sync_email_optin_to_keycloak_success(mocker):
    """Test that the Keycloak admin client is called with the expected attributes"""
    mocker.patch.object(
        api.keycloak_api, "is_admin_client_configured", return_value=True
    )
    update_user_mock = mocker.patch.object(api.keycloak_api, "update_user")
    user = UserFactory.build(global_id="some-global-id")

    sync_email_optin_to_keycloak(user, email_optin=True)

    update_user_mock.assert_called_once_with(
        "some-global-id", attributes=UserAttributes(email_optin=True)
    )


def test_sync_email_optin_to_keycloak_failure(mocker):
    """Test that a KeycloakError from the admin client propagates unchanged"""
    mocker.patch.object(
        api.keycloak_api, "is_admin_client_configured", return_value=True
    )
    mocker.patch.object(
        api.keycloak_api, "update_user", side_effect=KeycloakError("boom")
    )
    user = UserFactory.build(global_id="some-global-id")

    with pytest.raises(KeycloakError):
        sync_email_optin_to_keycloak(user, email_optin=True)
