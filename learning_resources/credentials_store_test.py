"""Tests for reading and writing stored credential metadata"""

import pytest

from learning_resources.constants import (
    CredentialMetadataField,
    LearningResourceType,
)
from learning_resources.credentials_store import (
    active_credential_metadata_fields,
    incomplete_credential_metadata_query,
    missing_credential_metadata_fields,
    save_credential_metadata,
    stored_credential_metadata,
)
from learning_resources.factories import (
    CredentialMetadataConfigurationFactory,
    CredentialMetadataFactory,
    LearningResourceFactory,
)
from learning_resources.models import (
    CredentialMetadata,
    CredentialMetadataConfiguration,
    LearningResource,
)

pytestmark = pytest.mark.django_db

COURSE = LearningResourceType.course.name


@pytest.fixture
def resource():
    """Return a course to store metadata against"""
    return LearningResourceFactory.create(is_course=True)


def test_stored_credential_metadata_none(resource):
    """A resource with no metadata reads as None, not an exception"""
    assert stored_credential_metadata(resource) is None


def test_stored_credential_metadata(resource):
    """A stored row is read back"""
    stored = CredentialMetadataFactory.create(learning_resource=resource)

    assert stored_credential_metadata(resource) == stored


def test_save_credential_metadata_creates(resource):
    """Generated fields are stored"""
    saved = save_credential_metadata(
        resource, {"description": "A course.", "criteria": ["Did a thing"]}
    )

    assert saved.learning_resource == resource
    assert saved.description == "A course."
    assert saved.criteria == ["Did a thing"]


def test_save_credential_metadata_updates(resource):
    """A second save replaces the stored values rather than adding a row"""
    save_credential_metadata(resource, {"description": "First", "criteria": ["One"]})
    save_credential_metadata(resource, {"description": "Second", "criteria": ["Two"]})

    stored = stored_credential_metadata(resource)
    assert CredentialMetadata.objects.filter(learning_resource=resource).count() == 1
    assert stored.description == "Second"
    assert stored.criteria == ["Two"]


def test_save_credential_metadata_keeps_a_field_that_failed(resource):
    """
    A field missing from a later generation keeps its previous value.

    The generator omits a field it could not produce, so writing the whole
    model every time would let one failed field blank a good value.
    """
    save_credential_metadata(resource, {"description": "Good", "criteria": ["Good"]})
    save_credential_metadata(resource, {"description": "Regenerated"})

    stored = stored_credential_metadata(resource)
    assert stored.description == "Regenerated"
    assert stored.criteria == ["Good"]


@pytest.mark.parametrize(
    "fields", [{}, {"description": "", "criteria": []}, {"criteria": []}]
)
def test_save_credential_metadata_writes_nothing_when_empty(resource, fields):
    """
    A generation that produced nothing stores nothing.

    """
    assert save_credential_metadata(resource, fields) is None
    assert not CredentialMetadata.objects.filter(learning_resource=resource).exists()


def test_save_credential_metadata_ignores_an_unknown_field(resource):
    """
    A field with no column is dropped, not passed to the ORM.

    The keys come from CredentialMetadataField; adding a member there without
    a migration would otherwise raise FieldError on every resource in a sweep.
    """
    saved = save_credential_metadata(
        resource, {"description": "A course.", "alignment": ["Some standard"]}
    )

    assert saved.description == "A course."
    assert not hasattr(saved, "alignment")


@pytest.fixture
def configurations():
    """
    One active configuration per credential metadata field.

    Created here rather than relying on migration 0124's seed, which a
    transactional test elsewhere deletes without restoring.
    """
    CredentialMetadataConfiguration.objects.all().delete()
    return [
        CredentialMetadataConfigurationFactory.create(field=field.name)
        for field in CredentialMetadataField
    ]


def test_active_credential_metadata_fields(configurations):
    """Every active configuration's field is reported"""
    assert active_credential_metadata_fields(COURSE) == sorted(
        field.name for field in CredentialMetadataField
    )


def test_active_credential_metadata_fields_skips_inactive(configurations):
    """A field whose configuration is switched off is not reported"""
    CredentialMetadataConfiguration.objects.filter(
        field=CredentialMetadataField.criteria.name
    ).update(is_active=False)

    assert active_credential_metadata_fields(COURSE) == [
        CredentialMetadataField.description.name
    ]


def test_active_credential_metadata_fields_with_none_active(configurations):
    """No active configuration means a generation would produce nothing"""
    CredentialMetadataConfiguration.objects.update(is_active=False)

    assert active_credential_metadata_fields(COURSE) == []


def test_active_credential_metadata_fields_skips_a_field_with_no_column(
    configurations,
):
    """
    A configured field with nowhere to store it is not reported.

    Same whitelist as the writer: adding a CredentialMetadataField member
    without a migration must not produce a filter on a column that does not
    exist.
    """
    CredentialMetadataConfiguration.objects.filter(
        field=CredentialMetadataField.criteria.name
    ).update(field="alignment")

    assert active_credential_metadata_fields(COURSE) == [
        CredentialMetadataField.description.name
    ]


@pytest.mark.parametrize(
    ("stored", "fields", "expected"),
    [
        (None, ["description", "criteria"], True),
        (
            {"description": "A course", "criteria": ["Did a thing"]},
            ["description", "criteria"],
            False,
        ),
        (
            {"description": "A course", "criteria": []},
            ["description", "criteria"],
            True,
        ),
        ({"description": "A course", "criteria": []}, ["description"], False),
        ({"description": "A course", "criteria": []}, ["criteria"], True),
        ({"description": "", "criteria": ["Did a thing"]}, ["description"], True),
        ({"description": "", "criteria": ["Did a thing"]}, ["criteria"], False),
    ],
)
def test_incomplete_credential_metadata_query(resource, stored, fields, expected):
    """
    The filter matches a resource missing any of the fields asked for.

    `stored` is None for a resource with no metadata row at all, which always
    matches: nothing has been generated for it.
    """
    if stored is not None:
        CredentialMetadataFactory.create(learning_resource=resource, **stored)

    matches = (
        LearningResource.objects.filter(incomplete_credential_metadata_query(fields))
        .filter(id=resource.id)
        .exists()
    )

    assert matches is expected


@pytest.mark.parametrize(
    ("stored", "fields", "expected"),
    [
        (None, ["criteria", "description"], ["criteria", "description"]),
        (
            {"description": "A course", "criteria": ["Did a thing"]},
            ["criteria", "description"],
            [],
        ),
        (
            {"description": "A course", "criteria": []},
            ["criteria", "description"],
            ["criteria"],
        ),
        (
            {"description": "", "criteria": ["Did a thing"]},
            ["criteria", "description"],
            ["description"],
        ),
        # Only what was asked for: a field with no active configuration is
        # nobody's to generate, however empty its column is.
        ({"description": "", "criteria": []}, ["criteria"], ["criteria"]),
    ],
)
def test_missing_credential_metadata_fields(resource, stored, fields, expected):
    """
    Only the fields still holding their column default come back.

    This is what scopes a regeneration: the fields left out are already in
    force, and generating them again would both cost a call and replace them.
    """
    if stored is not None:
        CredentialMetadataFactory.create(learning_resource=resource, **stored)

    assert missing_credential_metadata_fields(resource, fields) == expected


def test_missing_credential_metadata_fields_without_active_configurations(resource):
    """Nothing is configured, so nothing is missing -- there is nothing to ask for"""
    CredentialMetadataFactory.create(learning_resource=resource, description="")

    assert missing_credential_metadata_fields(resource, []) == []


def test_active_credential_metadata_fields_ignores_another_resource_type(
    configurations,
):
    """
    A configuration written for one resource type does not answer for another.

    Prompts are per resource type, so a program row is not a course row --
    reporting it would have the course sweep requeue every course for a field
    nothing will generate.
    """
    CredentialMetadataConfiguration.objects.filter(
        field=CredentialMetadataField.criteria.name
    ).update(resource_type=LearningResourceType.program.name)

    assert active_credential_metadata_fields(COURSE) == [
        CredentialMetadataField.description.name
    ]
    assert active_credential_metadata_fields(LearningResourceType.program.name) == [
        CredentialMetadataField.criteria.name
    ]
