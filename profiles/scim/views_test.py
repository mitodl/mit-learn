import json

from django.contrib.auth import get_user_model
from django.urls import reverse
from django_scim import constants

User = get_user_model()


def test_scim_post_user(staff_client):
    """Test that we can create a user via SCIM API"""
    user_q = User.objects.filter(profile__scim_external_id="1")
    assert not user_q.exists()

    resp = staff_client.post(
        reverse("scim:users"),
        content_type="application/scim+json",
        data=json.dumps(
            {
                "schemas": [constants.SchemaURI.USER],
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

    # test an update
    resp = staff_client.put(
        f"{reverse('scim:users')}/{user.profile.scim_id}",
        content_type="application/scim+json",
        data=json.dumps(
            {
                "schemas": [constants.SchemaURI.USER],
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

    user = user_q.first()

    assert user is not None
    assert user.email == "jsmith@example.com"
    assert user.username == "jsmith"
    assert user.first_name == "Jimmy"
    assert user.last_name == "Smith"
    assert user.profile.name == "Jimmy Smith"
    assert user.profile.email_optin is False

    resp = staff_client.patch(
        f"{reverse('scim:users')}/{user.profile.scim_id}",
        content_type="application/scim+json",
        data=json.dumps(
            {
                "schemas": [constants.SchemaURI.PATCH_OP],
                "Operations": [
                    {
                        "op": "replace",
                        # yes, the value we get from scim-for-keycloak is a JSON encoded string...inside JSON...
                        "value": json.dumps(
                            {
                                "schemas": [constants.SchemaURI.USER],
                                "emailOptIn": 1,
                                "fullName": "Billy Bob",
                            }
                        ),
                    }
                ],
            }
        ),
    )

    assert resp.status_code == 200, f"Error response: {resp.content}"

    user = user_q.first()

    assert user is not None
    assert user.email == "jsmith@example.com"
    assert user.username == "jsmith"
    assert user.first_name == "Jimmy"
    assert user.last_name == "Smith"
    assert user.profile.name == "Billy Bob"
    assert user.profile.email_optin is True
