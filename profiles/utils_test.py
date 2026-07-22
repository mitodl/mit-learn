"""Tests for profiles.utils"""

import xml.etree.ElementTree as ET
from io import BytesIO
from urllib.parse import parse_qs, urlparse

import pytest
from django.core import mail
from PIL import Image

from main.factories import UserFactory
from main.utils import generate_filepath
from profiles.factories import (
    ProgramCertificateFactory,
    ProgramLetterFactory,
)
from profiles.utils import (
    DEFAULT_PROFILE_IMAGE,
    fetch_program_letter_template_data,
    generate_initials,
    generate_svg_avatar,
    image_uri,
    profile_image_upload_uri,
    profile_image_upload_uri_medium,
    profile_image_upload_uri_small,
    send_email,
    send_template_email,
    update_full_name,
    user_has_email_optin,
)


def test_upload_url(user):
    """
    profile_image_upload_uri should make an upload path with a timestamp
    """
    name = "name"
    ext = ".jpg"
    filename = f"{name}{ext}"
    url = profile_image_upload_uri(user.profile, filename)
    assert url.startswith(f"profile/{user.username}/{name}-")
    assert url.endswith(f"{ext}")


def test_small(user):
    """
    profile_image_upload_uri_small should make an upload path with a timestamp
    """
    name = "name"
    ext = ".jpg"
    filename = f"{name}{ext}"
    url = profile_image_upload_uri_small(user.profile, filename)
    assert url.startswith(f"profile/{user.username}/{name}-")
    assert url.endswith(f"_small{ext}")


def test_medium(user):
    """
    profile_image_upload_uri_medium should make an upload path with a timestamp
    """
    name = "name"
    ext = ".jpg"
    filename = f"{name}{ext}"
    url = profile_image_upload_uri_medium(user.profile, filename)
    assert url.startswith(f"profile/{user.username}/{name}-")
    assert url.endswith(f"_medium{ext}")


def test_too_long_name(user):
    """
    A name which is too long should get truncated to 100 characters
    """
    filename = "{}.jpg".format("a" * 150)
    full_path = profile_image_upload_uri(user.profile, filename)
    assert len(full_path) == 100
    assert full_path.startswith("profile/")
    assert full_path.endswith(".jpg")


def test_too_long_prefix(user):
    """
    A name which is too long should get truncated to 100 characters
    """
    filename = "{}.jpg".format("a" * 150)
    with pytest.raises(ValueError) as ex:  # noqa: PT011
        generate_filepath(filename, user.username, "x" * 150, "profile")
    assert str(ex.value).startswith("path is longer than max length even without name")


@pytest.mark.django_db
def test_profile_img_url_uploaded_image():
    """
    Test that the correct profile image URL is returned for a profile with an uploaded image
    """
    profile = UserFactory.create().profile
    image = Image.new("RGBA", size=(50, 50), color=(155, 0, 0))
    profile.image_small_file.save(
        "/profiles/realimage.jpg",
        BytesIO(image.tobytes()),
        True,  # noqa: FBT003
    )
    profile.save()
    assert image_uri(profile, "image_small") == profile.image_small_file.url


@pytest.mark.django_db
def test_profile_img_url_micromaster_image():
    """
    Test that the correct profile image URL is returned for a profile with a micromasters profile URL
    """
    profile = UserFactory.create().profile
    profile.image_file = profile.image_medium_file = profile.image_small_file = None
    profile.image_medium = "http://testserver/profiles/image.jpg"
    profile.save()
    assert image_uri(profile, "image_medium").endswith(profile.image_medium)


@pytest.mark.django_db
def test_profile_img_url_gravatar_fullname():
    """Test that the correct profile gravatar image URL is returned for a profile with a name"""
    profile = UserFactory.create().profile
    profile.image = profile.image_small = profile.image_medium = None
    profile.image_file = profile.image_medium_file = profile.image_small_file = None
    profile.save()
    profile_image = image_uri(profile, "image_small")
    assert profile_image.startswith("https://www.gravatar.com/avatar/")
    params_d = parse_qs(urlparse(profile_image).query)["d"][0]
    assert params_d.endswith(f"profile/{profile.user.username}/64/fff/579cf9.png")


@pytest.mark.django_db
def test_profile_img_url_gravatar_nameless():
    """Test that the correct profile gravatar image URL is returned for a profile with no name"""
    profile = UserFactory.create().profile
    profile.image = profile.image_small = profile.image_medium = None
    profile.image_file = profile.image_medium_file = profile.image_small_file = None
    profile.name = None
    profile.save()
    profile_image = image_uri(profile, "image_small")
    assert profile_image.startswith("https://www.gravatar.com/avatar/")
    params_d = parse_qs(urlparse(profile_image).query)["d"][0]
    assert params_d.endswith(DEFAULT_PROFILE_IMAGE)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("first_name", "last_name"),
    [
        ["Keihanaikukauakahihuliheekahaunaele", "van der Graaf"],  # noqa: PT007
        ["Jane", ""],  # noqa: PT007
        ["Joe", "FakeName10" * 16],  # noqa: PT007
    ],
)
def test_update_full_name(first_name, last_name):
    """Tests that user names are updated correctly"""
    user = UserFactory.create()
    update_full_name(user, f"{first_name} {last_name}")
    assert user.first_name == first_name[:30]
    assert user.last_name == last_name[:30]


def test_get_svg_avatar():
    """Test that an svg with correct attributes is created"""
    username = "Test User"
    color = "afafaf"
    bgcolor = "dedede"
    size = 92
    svg = generate_svg_avatar(username, size, color, bgcolor)
    root = ET.fromstring(svg)  # noqa: S314
    assert root.tag == "{http://www.w3.org/2000/svg}svg"
    circle = root.find("{http://www.w3.org/2000/svg}circle")
    assert circle.get("cx") == str(int(size / 2))
    assert f"#{bgcolor}" in circle.get("style")
    text = root.find("{http://www.w3.org/2000/svg}text")
    assert text.get("fill") == f"#{color}"
    assert text.text == "TU"


@pytest.mark.parametrize(
    ("text", "initials"),
    [
        ["Test User", "TU"],  # noqa: PT007
        ["another user", "AU"],  # noqa: PT007
        ["Test Van Der Graaf", "TG"],  # noqa: PT007
        ["Test", "T"],  # noqa: PT007
        [None, None],  # noqa: PT007
        [" ", None],  # noqa: PT007
    ],
)
def test_generate_initials(text, initials):
    """Test that expected initials are returned from text"""
    assert generate_initials(text) == initials


@pytest.mark.django_db
def test_fetch_program_letter_template_data_malformed_api_response(
    mocker, user, settings
):
    """
    Tests that a malformed response from micromasters api
    causes fetch_program_letter_template_data to return None
    """
    settings.DATABASE_ROUTERS = []
    settings.MICROMASTERS_CMS_API_URL = "http://test.com"
    mm_api_response = mocker.Mock()
    mm_api_response.configure_mock(**{"json.return_value": {"some": "json"}})
    mocker.patch("requests.get", return_value=mm_api_response)
    cert = ProgramCertificateFactory(user_email=user.email, micromasters_program_id=1)
    program_letter = ProgramLetterFactory(user=user, certificate=cert)
    assert fetch_program_letter_template_data(program_letter) is None


@pytest.mark.django_db
def test_fetch_program_letter_template_data_has_results(mocker, user, settings):
    """
    Tests that a response from micromasters api
    with a result returns properly
    """
    settings.DATABASE_ROUTERS = []
    settings.MICROMASTERS_CMS_API_URL = "http://test.com"
    expected_item = {"test": "test"}
    mm_api_response = mocker.Mock()
    mm_api_response.configure_mock(
        **{
            "json.return_value": {
                "meta": {"total_count": 1},
                "items": [expected_item],
            },
        }
    )
    mocker.patch("requests.get", return_value=mm_api_response)
    cert = ProgramCertificateFactory(user_email=user.email, micromasters_program_id=1)
    program_letter = ProgramLetterFactory(user=user, certificate=cert)
    assert fetch_program_letter_template_data(program_letter) == expected_item


# ---------------------------------------------------------------------------
# user_has_email_optin tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("email_optin", [True, None])
def test_user_has_email_optin_true_or_none(email_optin):
    """user_has_email_optin is True when email_optin is True or None."""
    user = UserFactory.create(profile__email_optin=email_optin)
    assert user_has_email_optin(user) is True


@pytest.mark.django_db
def test_user_has_email_optin_false():
    """user_has_email_optin is False when the user opted out."""
    user = UserFactory.create(profile__email_optin=False)
    assert user_has_email_optin(user) is False


@pytest.mark.django_db
def test_user_has_email_optin_no_profile():
    """user_has_email_optin is False when the user has no profile."""
    user = UserFactory.create(no_profile=True)
    assert user_has_email_optin(user) is False


# send_email tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_send_email_adds_list_unsubscribe_headers_when_url_provided():
    """send_email adds List-Unsubscribe headers when unsubscribe_url is given."""
    user = UserFactory.create()

    send_email(
        user,
        "Test",
        "<p>content</p>",
        text_only=False,
        unsubscribe_url="https://api.example.com/api/v1/users/unsubscribe/token/",
    )

    assert len(mail.outbox) == 1
    assert mail.outbox[0].extra_headers == {
        "List-Unsubscribe": "<https://api.example.com/api/v1/users/unsubscribe/token/>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }


@pytest.mark.django_db
def test_send_email_no_list_unsubscribe_headers_without_url():
    """send_email does not set List-Unsubscribe headers when no URL is given."""
    user = UserFactory.create()

    send_email(user, "Test", "<p>content</p>", text_only=False)

    assert len(mail.outbox) == 1
    assert mail.outbox[0].extra_headers == {}


# ---------------------------------------------------------------------------
# send_template_email tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_send_template_email_transactional_no_unsubscribe_url(mocker):
    """When is_transactional=True, no unsubscribe_url is passed."""
    mock_send_email = mocker.patch("profiles.utils.send_email")
    user = UserFactory.create()

    send_template_email(
        user,
        "Test",
        "email/welcome_email.html",
        context={"display_name": "Test"},
        is_transactional=True,
    )

    mock_send_email.assert_called_once()
    call_kwargs = mock_send_email.call_args.kwargs
    assert call_kwargs.get("unsubscribe_url") is None


@pytest.mark.django_db
def test_send_template_email_not_transactional_sets_unsubscribe_url(mocker, settings):
    """When is_transactional=False, unsubscribe_url is set from the user."""
    settings.MITOL_API_BASE_URL = "https://api.example.com"
    settings.APP_BASE_URL = "https://learn.example.com"
    mock_send_email = mocker.patch("profiles.utils.send_email")
    user = UserFactory.create(profile__email_optin=True)

    send_template_email(
        user,
        "Test",
        "email/email_base.html",
        context={"display_name": "Test"},
        is_transactional=False,
    )

    mock_send_email.assert_called_once()
    # The List-Unsubscribe header URL is still API-rooted (RFC 8058 one-click)
    call_kwargs = mock_send_email.call_args.kwargs
    assert call_kwargs["unsubscribe_url"]
    assert call_kwargs["unsubscribe_url"].startswith("https://api.example.com")
    # The UUID is embedded in the signed token but should not be a standalone path segment
    segments = urlparse(call_kwargs["unsubscribe_url"]).path.strip("/").split("/")
    assert str(user.unsubscribe_uuid) not in segments

    # The footer link rendered into the email body points at the frontend page
    html_content = mock_send_email.call_args.args[2]
    assert "https://learn.example.com/unsubscribe?" in html_content
    assert "https://api.example.com" not in html_content


@pytest.mark.django_db
@pytest.mark.parametrize("email_optin", [True, None])
def test_send_template_email_not_transactional_opted_in_sends(mocker, email_optin):
    """When is_transactional=False and email_optin is True or None, the email sends."""
    mock_send_email = mocker.patch("profiles.utils.send_email")
    user = UserFactory.create(profile__email_optin=email_optin)

    send_template_email(
        user,
        "Test",
        "email/welcome_email.html",
        context={"display_name": "Test"},
        is_transactional=False,
    )

    mock_send_email.assert_called_once()


@pytest.mark.django_db
def test_send_template_email_not_transactional_opted_out_skips(mocker):
    """When is_transactional=False and email_optin is False, the email is not sent."""
    mock_send_email = mocker.patch("profiles.utils.send_email")
    user = UserFactory.create(profile__email_optin=False)

    result = send_template_email(
        user,
        "Test",
        "email/welcome_email.html",
        context={"display_name": "Test"},
        is_transactional=False,
    )

    assert result is None
    mock_send_email.assert_not_called()


@pytest.mark.django_db
def test_send_template_email_transactional_opted_out_still_sends(mocker, settings):
    """Transactional emails bypass email_optin even when the user opted out."""
    settings.MITOL_API_BASE_URL = "https://api.example.com"
    mock_send_email = mocker.patch("profiles.utils.send_email")
    user = UserFactory.create(profile__email_optin=False)

    send_template_email(
        user,
        "Test",
        "email/welcome_email.html",
        context={"display_name": "Test"},
        is_transactional=True,
    )

    mock_send_email.assert_called_once()


@pytest.mark.django_db
def test_send_template_email_not_transactional_no_profile_skips(mocker):
    """When is_transactional=False and the user has no profile, the email is not sent."""
    mock_send_email = mocker.patch("profiles.utils.send_email")
    user = UserFactory.create(no_profile=True)

    result = send_template_email(
        user,
        "Test",
        "email/welcome_email.html",
        context={"display_name": "Test"},
        is_transactional=False,
    )

    assert result is None
    mock_send_email.assert_not_called()


@pytest.mark.django_db
def test_send_template_email_transactional_no_profile_still_sends(mocker):
    """Transactional emails bypass the opt-in check even when there's no profile."""
    mock_send_email = mocker.patch("profiles.utils.send_email")
    user = UserFactory.create(no_profile=True)

    send_template_email(
        user,
        "Test",
        "email/welcome_email.html",
        context={"display_name": "Test"},
        is_transactional=True,
    )

    mock_send_email.assert_called_once()
