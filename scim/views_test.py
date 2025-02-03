import itertools
import json
import operator
import random
from collections.abc import Callable
from functools import reduce
from types import SimpleNamespace

import pytest
from anys import ANY_STR
from deepmerge import always_merger
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from django_scim import constants as djs_constants

from main.factories import UserFactory
from scim import constants

User = get_user_model()


@pytest.fixture
def scim_client(staff_user):
    """Test client for scim"""
    client = Client()
    client.force_login(staff_user)
    return client


def test_scim_user_post(scim_client):
    """Test that we can create a user via SCIM API"""
    user_q = User.objects.filter(profile__scim_external_id="1")
    assert not user_q.exists()

    resp = scim_client.post(
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


def test_scim_user_put(scim_client):
    """Test that a user can be updated via PUT"""
    user = UserFactory.create()

    resp = scim_client.put(
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


def test_scim_user_patch(scim_client):
    """Test that a user can be updated via PATCH"""
    user = UserFactory.create()

    resp = scim_client.patch(
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


def _user_to_scim_payload(user):
    """Test util to serialize a user to a SCIM representation"""
    return {
        "schemas": [djs_constants.SchemaURI.USER],
        "emails": [{"value": user.email, "primary": True}],
        "userName": user.username,
        "emailOptIn": 1 if user.profile.email_optin else 0,
        "fullName": user.profile.name,
        "name": {
            "givenName": user.first_name,
            "familyName": user.last_name,
        },
    }


USER_FIELD_TYPES: dict[str, type] = {
    "username": str,
    "email": str,
    "first_name": str,
    "last_name": str,
    "profile.email_optin": bool,
    "profile.name": str,
}

USER_FIELDS_TO_SCIM: dict[str, Callable] = {
    "username": lambda value: {"userName": value},
    "email": lambda value: {"emails": [{"value": value, "primary": True}]},
    "first_name": lambda value: {"name": {"givenName": value}},
    "last_name": lambda value: {"name": {"familyName": value}},
    "profile.email_optin": lambda value: {"emailOptIn": 1 if value else 0},
    "profile.name": lambda value: {"fullName": value},
}


def _post_operation(data, bulk_id_gen):
    """Operation for a bulk POST"""
    bulk_id = str(next(bulk_id_gen))
    return SimpleNamespace(
        payload={
            "method": "post",
            "bulkId": bulk_id,
            "path": "/Users",
            "data": _user_to_scim_payload(data),
        },
        user=None,
        expected_user_state=data,
        expected_response={
            "method": "post",
            "location": ANY_STR,
            "bulkId": bulk_id,
            "status": "201",
            "id": ANY_STR,
        },
    )


def _put_operation(user, data, bulk_id_gen):
    """Operation for a bulk PUT"""
    bulk_id = str(next(bulk_id_gen))
    return SimpleNamespace(
        payload={
            "method": "put",
            "bulkId": bulk_id,
            "path": f"/Users/{user.profile.scim_id}",
            "data": _user_to_scim_payload(data),
        },
        user=user,
        expected_user_state=data,
        expected_response={
            "method": "put",
            "location": ANY_STR,
            "bulkId": bulk_id,
            "status": "200",
            "id": str(user.profile.scim_id),
        },
    )


def _patch_operation(user, data, fields_to_patch, bulk_id_gen):
    """Operation for a bulk PUT"""

    def _expected_patch_value(field):
        field_getter = operator.attrgetter(field)
        return field_getter(data if field in fields_to_patch else user)

    bulk_id = str(next(bulk_id_gen))
    field_updates = [
        mk_scim_value(operator.attrgetter(user_path)(data))
        for user_path, mk_scim_value in USER_FIELDS_TO_SCIM.items()
        if user_path in fields_to_patch
    ]

    return SimpleNamespace(
        payload={
            "method": "patch",
            "bulkId": bulk_id,
            "path": f"/Users/{user.profile.scim_id}",
            "data": {
                "schemas": [djs_constants.SchemaURI.PATCH_OP],
                "Operations": [
                    {
                        "op": "replace",
                        "value": reduce(always_merger.merge, field_updates, {}),
                    }
                ],
            },
        },
        user=user,
        expected_user_state=SimpleNamespace(
            email=_expected_patch_value("email"),
            username=_expected_patch_value("username"),
            first_name=_expected_patch_value("first_name"),
            last_name=_expected_patch_value("last_name"),
            profile=SimpleNamespace(
                name=_expected_patch_value("profile.name"),
                email_optin=_expected_patch_value("profile.email_optin"),
            ),
        ),
        expected_response={
            "method": "patch",
            "location": ANY_STR,
            "bulkId": bulk_id,
            "status": "200",
            "id": str(user.profile.scim_id),
        },
    )


def _delete_operation(user, bulk_id_gen):
    """Operation for a bulk DELETE"""
    bulk_id = str(next(bulk_id_gen))
    return SimpleNamespace(
        payload={
            "method": "delete",
            "bulkId": bulk_id,
            "path": f"/Users/{user.profile.scim_id}",
        },
        user=user,
        expected_user_state=None,
        expected_response={
            "method": "delete",
            "bulkId": bulk_id,
            "status": "204",
        },
    )


@pytest.fixture
def bulk_test_data():
    """Test data for the /Bulk API tests"""
    existing_users = UserFactory.create_batch(500)
    remaining_users = set(existing_users)

    users_to_put = random.sample(sorted(remaining_users, key=lambda user: user.id), 100)
    remaining_users = remaining_users - set(users_to_put)

    users_to_patch = random.sample(
        sorted(remaining_users, key=lambda user: user.id), 100
    )
    remaining_users = remaining_users - set(users_to_patch)

    users_to_delete = random.sample(
        sorted(remaining_users, key=lambda user: user.id), 100
    )
    remaining_users = remaining_users - set(users_to_delete)

    user_post_data = UserFactory.build_batch(100)
    user_put_data = UserFactory.build_batch(len(users_to_put))
    user_patch_data = UserFactory.build_batch(len(users_to_patch))

    bulk_id_gen = itertools.count()

    post_operations = [_post_operation(data, bulk_id_gen) for data in user_post_data]
    put_operations = [
        _put_operation(user, data, bulk_id_gen)
        for user, data in zip(users_to_put, user_put_data)
    ]
    patch_operations = [
        _patch_operation(user, patch_data, fields_to_patch, bulk_id_gen)
        for user, patch_data, fields_to_patch in [
            (
                user,
                patch_data,
                # random number of field updates
                list(
                    random.sample(
                        list(USER_FIELDS_TO_SCIM.keys()),
                        random.randint(1, len(USER_FIELDS_TO_SCIM.keys())),  # noqa: S311
                    )
                ),
            )
            for user, patch_data in zip(users_to_patch, user_patch_data)
        ]
    ]
    delete_operations = [
        _delete_operation(user, bulk_id_gen) for user in users_to_delete
    ]

    operations = [
        *post_operations,
        *patch_operations,
        *put_operations,
        *delete_operations,
    ]
    random.shuffle(operations)

    return SimpleNamespace(
        existing_users=existing_users,
        remaining_users=remaining_users,
        post_operations=post_operations,
        patch_operations=patch_operations,
        put_operations=put_operations,
        delete_operations=delete_operations,
        operations=operations,
    )


def test_bulk_post(scim_client, bulk_test_data):
    """Verify that bulk operations work as expected"""
    user_count = User.objects.count()

    resp = scim_client.post(
        reverse("ol-scim:bulk"),
        content_type="application/scim+json",
        data=json.dumps(
            {
                "schemas": [constants.SchemaURI.BULK_REQUEST],
                "Operations": [
                    operation.payload for operation in bulk_test_data.operations
                ],
            }
        ),
    )

    assert resp.status_code == 200

    # singular user is the staff user
    assert User.objects.count() == user_count + len(bulk_test_data.post_operations)

    results_by_bulk_id = {
        op_result["bulkId"]: op_result for op_result in resp.json()["Operations"]
    }

    for operation in bulk_test_data.operations:
        assert (
            results_by_bulk_id[operation.payload["bulkId"]]
            == operation.expected_response
        )

        if operation in bulk_test_data.delete_operations:
            user = User.objects.get(id=operation.user.id)
            assert not user.is_active
        else:
            if operation in bulk_test_data.post_operations:
                user = User.objects.get(username=operation.expected_user_state.username)
            else:
                user = User.objects.get(id=operation.user.id)

            for key, key_type in USER_FIELD_TYPES.items():
                attr_getter = operator.attrgetter(key)

                actual_value = attr_getter(user)
                expected_value = attr_getter(operation.expected_user_state)

                if key_type is bool or key_type is None:
                    assert actual_value is expected_value
                else:
                    assert actual_value == expected_value
