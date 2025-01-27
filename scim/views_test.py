import json

from django.contrib.auth import get_user_model
from django.urls import reverse
from django_scim import constants as djs_constants

from main.factories import UserFactory
from scim import constants

User = get_user_model()


def test_scim_user_post(staff_client):
    """Test that we can create a user via SCIM API"""
    user_q = User.objects.filter(profile__scim_external_id="1")
    assert not user_q.exists()

    resp = staff_client.post(
        reverse("scim:users"),
        content_type="application/scim+json",
        data=json.dumps(
            {
                "schemas": [djs_constants.SchemaURI.USER],
                "emails": [{"value": "jdoe@example.com", "primary": True}],
                "active": True,
                "userName": "jdoe",
                "externalId": "1",
                "name": {
                    "familyName": "Doe",
                    "givenName": "John",
                },
                "fullName": "John Smith Doe",
                "emailOptIn": 1,
            }
        ),
    )

    assert resp.status_code == 201, f"Error response: {resp.content}"

    user = user_q.first()

    assert user is not None
    assert user.email == "jdoe@example.com"
    assert user.username == "jdoe"
    assert user.first_name == "John"
    assert user.last_name == "Doe"
    assert user.profile.name == "John Smith Doe"
    assert user.profile.email_optin is True


def test_scim_user_put(staff_client):
    """Test that a user can be updated via PUT"""
    user = UserFactory.create()

    resp = staff_client.put(
        f"{reverse('scim:users')}/{user.profile.scim_id}",
        content_type="application/scim+json",
        data=json.dumps(
            {
                "schemas": [djs_constants.SchemaURI.USER],
                "emails": [{"value": "jsmith@example.com", "primary": True}],
                "active": True,
                "userName": "jsmith",
                "externalId": "1",
                "name": {
                    "familyName": "Smith",
                    "givenName": "Jimmy",
                },
                "fullName": "Jimmy Smith",
                "emailOptIn": 0,
            }
        ),
    )

    assert resp.status_code == 200, f"Error response: {resp.content}"

    user.refresh_from_db()

    assert user.email == "jsmith@example.com"
    assert user.username == "jsmith"
    assert user.first_name == "Jimmy"
    assert user.last_name == "Smith"
    assert user.profile.name == "Jimmy Smith"
    assert user.profile.email_optin is False


def test_scim_user_patch(staff_client):
    """Test that a user can be updated via PATCH"""
    user = UserFactory.create()

    resp = staff_client.patch(
        f"{reverse('scim:users')}/{user.profile.scim_id}",
        content_type="application/scim+json",
        data=json.dumps(
            {
                "schemas": [djs_constants.SchemaURI.PATCH_OP],
                "Operations": [
                    {
                        "op": "replace",
                        # yes, the value we get from scim-for-keycloak is a JSON encoded string...inside JSON...
                        "value": json.dumps(
                            {
                                "schemas": [djs_constants.SchemaURI.USER],
                                "emailOptIn": 1,
                                "fullName": "Billy Bob",
                                "name": {
                                    "givenName": "Billy",
                                    "familyName": "Bob",
                                },
                            }
                        ),
                    }
                ],
            }
        ),
    )

    assert resp.status_code == 200, f"Error response: {resp.content}"

    user_updated = User.objects.get(pk=user.id)

    assert user_updated.email == user.email
    assert user_updated.username == user.username
    assert user_updated.first_name == "Billy"
    assert user_updated.last_name == "Bob"
    assert user_updated.profile.name == "Billy Bob"
    assert user_updated.profile.email_optin is True


def test_bulk_post(staff_client):
    user = UserFactory.create()

    resp = staff_client.post(
        reverse("ol-scim:bulk"),
        data=json.dumps(
            {
                "schemas": [constants.SchemaURI.BULK_REQUEST],
                "Operations": [
                    {
                        "method": "post",
                        "path": "/Users",
                        "bulkId": "1234",
                        "data": {
                            "schemas": [djs_constants.SchemaURI.USER],
                            "email": "test@example.com",
                            "emailOptIn": 1,
                            "fullName": "Billy Bob",
                            "name": {
                                "givenName": "Billy",
                                "familyName": "Bob",
                            },
                        },
                    }
                ],
            }
        ),
    )
