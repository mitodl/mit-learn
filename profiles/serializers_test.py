# pylint: disable=unused-argument,too-many-arguments,redefined-outer-name
"""
Tests for serializers for profiles REST APIS
"""

import pytest
from keycloak.exceptions import KeycloakError
from rest_framework.exceptions import ValidationError

from learning_resources.factories import LearningResourceTopicFactory
from learning_resources.serializers import LearningResourceTopicSerializer
from profiles.models import Profile
from profiles.serializers import ProfileSerializer, UserSerializer
from profiles.utils import (
    IMAGE_MEDIUM,
    IMAGE_SMALL,
    image_uri,
)

small_gif = (
    b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x00\x00\x00\x21\xf9\x04"
    b"\x01\x0a\x00\x01\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02"
    b"\x02\x4c\x01\x00\x3b"
)
lr_delivery_keys = [key for key, _ in Profile.LearningResourceDelivery.choices]


def test_serialize_user(user):
    """
    Test serializing a user
    """
    assert UserSerializer(user).data == {
        "id": user.id,
        "username": user.username,
        "global_id": user.global_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_learning_path_editor": False,
        "is_article_editor": False,
        "profile": ProfileSerializer(user.profile).data,
        "is_authenticated": True,
    }


def test_serialize_create_user(db, mocker):
    """
    Test creating a user
    """
    profile = {
        "email_optin": True,
        "toc_optin": True,
        "bio": "bio",
        "headline": "headline",
        "placename": "",
    }

    serializer = UserSerializer(data={"email": "test@localhost", "profile": profile})
    serializer.is_valid(raise_exception=True)
    user = serializer.save()

    del profile["toc_optin"]  # is write-only

    profile.update(
        {
            "name": "",
            "image": None,
            "image_small": None,
            "image_medium": None,
            "image_file": None,
            "image_small_file": None,
            "image_medium_file": None,
            "profile_image_small": image_uri(user.profile, IMAGE_SMALL),
            "profile_image_medium": image_uri(user.profile, IMAGE_MEDIUM),
            "username": user.username,
            "topic_interests": LearningResourceTopicSerializer(
                user.profile.topic_interests, many=True
            ).data,
            "goals": user.profile.goals,
            "current_education": user.profile.current_education,
            "certificate_desired": user.profile.certificate_desired,
            "time_commitment": user.profile.time_commitment,
            "delivery": user.profile.delivery,
        }
    )
    assert UserSerializer(instance=user).data == {
        "id": user.id,
        "username": user.username,
        "global_id": user.global_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_learning_path_editor": False,
        "is_article_editor": False,
        "profile": {**profile, "preference_search_filters": {}},
        "is_authenticated": True,
    }


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("email_optin", True),
        ("email_optin", False),
        ("bio", "bio_value"),
        ("headline", "headline_value"),
        ("toc_optin", True),
        ("toc_optin", False),
    ],
)
def test_update_user_profile(mocker, user, key, value):
    """
    Test updating a profile via the UserSerializer
    """
    profile = user.profile

    serializer = UserSerializer(
        instance=user, data={"profile": {key: value}}, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()

    profile2 = Profile.objects.get(user=user)

    for prop in (
        "name",
        "image",
        "image_small",
        "image_medium",
        "email_optin",
        "toc_optin",
        "bio",
        "headline",
    ):
        if prop == key:
            if isinstance(value, bool):
                assert getattr(profile2, prop) is value
            else:
                assert getattr(profile2, prop) == value
        else:
            assert getattr(profile2, prop) == getattr(profile, prop)


def test_update_profile_syncs_email_optin_change(mocker, user):
    """Test that changing email_optin via ProfileSerializer syncs the new value to Keycloak"""
    sync_mock = mocker.patch("profiles.serializers.sync_email_optin_to_keycloak")
    profile = user.profile
    profile.email_optin = False
    profile.save(update_fields=["email_optin"])

    serializer = ProfileSerializer(
        instance=profile, data={"email_optin": True}, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()

    sync_mock.assert_called_once_with(user, email_optin=True)


def test_update_profile_skips_keycloak_sync_when_unchanged(mocker, user):
    """Test that resubmitting the same email_optin value doesn't call Keycloak"""
    sync_mock = mocker.patch("profiles.serializers.sync_email_optin_to_keycloak")
    profile = user.profile
    profile.email_optin = True
    profile.save(update_fields=["email_optin"])

    serializer = ProfileSerializer(
        instance=profile, data={"email_optin": True}, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()

    sync_mock.assert_not_called()


def test_update_profile_skips_keycloak_sync_for_null_email_optin(mocker, user):
    """A null email_optin means no preference expressed, so don't push an opt-out"""
    sync_mock = mocker.patch("profiles.serializers.sync_email_optin_to_keycloak")
    profile = user.profile
    profile.email_optin = True
    profile.save(update_fields=["email_optin"])

    serializer = ProfileSerializer(
        instance=profile, data={"email_optin": None}, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()

    sync_mock.assert_not_called()


def test_update_profile_email_optin_sync_failure_prevents_save(mocker, user):
    """Test that a Keycloak sync failure is translated into a ValidationError and rolls back the profile update"""
    mocker.patch(
        "profiles.serializers.sync_email_optin_to_keycloak",
        side_effect=KeycloakError("boom"),
    )
    profile = user.profile
    profile.email_optin = False
    profile.save(update_fields=["email_optin"])

    serializer = ProfileSerializer(
        instance=profile, data={"email_optin": True}, partial=True
    )
    serializer.is_valid(raise_exception=True)
    with pytest.raises(ValidationError):
        serializer.save()

    assert Profile.objects.get(user=user).email_optin is False


@pytest.mark.parametrize(
    ("topic_interests", "errors"),
    [
        ("just_a_string", ["Should be a list of topic integer ids"]),
        (["id_as_string"], ["Should be a list of topic integer ids"]),
        ([{"id": 1}], ["Should be a list of topic integer ids"]),
        ([99999999], ["Invalid id(s): 99999999"]),  # missing topic
    ],
)
def test_serializer_profile_topic_interests_invalid(user, topic_interests, errors):
    """Test that invalid topic_interests are rejected"""

    serializer = ProfileSerializer(
        instance=user,
        data={
            "topic_interests": topic_interests,
        },
        partial=True,
    )

    serializer.is_valid()

    assert serializer.errors == {
        "topic_interests": errors,
    }


@pytest.mark.parametrize(
    ("data", "is_valid"),
    [
        ({}, True),
        ("notjson", False),
        ({"bad": "json"}, False),
        (None, True),
        ({"value": "city"}, True),
    ],
)
def test_location_validation(user, data, is_valid):
    """Test that lcoation validation works correctly"""
    serializer = ProfileSerializer(
        instance=user.profile, data={"location": data}, partial=True
    )
    assert serializer.is_valid(raise_exception=False) is is_valid


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("bio", "bio_value"),
        ("headline", "headline_value"),
        ("location", {"value": "Hobbiton, The Shire, Middle-Earth"}),
        ("delivery", lr_delivery_keys),
        ("certificate_desired", Profile.CertificateDesired.YES.value),
    ],
)
def test_update_profile(mocker, user, key, value):
    """
    Test updating a profile via the ProfileSerializer
    """
    topic_ids = [topic.id for topic in LearningResourceTopicFactory.create_batch(2)]
    profile = user.profile

    serializer = ProfileSerializer(
        instance=user.profile,
        data={key: value, "topic_interests": topic_ids},
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()

    profile2 = Profile.objects.first()

    for prop in (
        "name",
        "email_optin",
        "toc_optin",
        "bio",
        "headline",
        "location",
        "delivery",
        "certificate_desired",
        "topic_interests",
    ):
        if prop == key:
            if isinstance(value, bool):
                assert getattr(profile2, prop) is value
            else:
                assert getattr(profile2, prop) == value
        else:
            assert getattr(profile2, prop) == getattr(profile, prop)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("cert_desired", "cert_filter"),
    [
        (Profile.CertificateDesired.YES.value, True),
        (Profile.CertificateDesired.NO.value, False),
        (Profile.CertificateDesired.NOT_SURE_YET.value, None),
        ("", None),
    ],
)
@pytest.mark.parametrize("topics", [["Biology", "Chemistry"], []])
@pytest.mark.parametrize("lr_delivery", [lr_delivery_keys, []])
def test_serialize_profile_preference_search_filters(
    user, cert_desired, cert_filter, topics, lr_delivery
):
    """Tests that the ProfileSerializer includes search filters when an option is set via the context"""
    profile = user.profile
    profile.certificate_desired = cert_desired
    profile.delivery = lr_delivery
    if topics:
        profile.topic_interests.set(
            [LearningResourceTopicFactory.create(name=topic) for topic in topics]
        )
    profile.save()

    search_filters = ProfileSerializer(profile).data["preference_search_filters"]
    assert search_filters.get("certification", None) == cert_filter
    assert sorted(search_filters.get("topic", [])) == sorted(topics if topics else [])
    assert search_filters.get("delivery", None) == (
        lr_delivery if lr_delivery else None
    )
