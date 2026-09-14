"""Tests for reading and writing stored credential metadata"""

import pytest

from learning_resources.credentials_store import (
    save_credential_metadata,
    stored_credential_metadata,
)
from learning_resources.factories import (
    CredentialMetadataFactory,
    LearningResourceFactory,
)
from learning_resources.models import CredentialMetadata

pytestmark = pytest.mark.django_db


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

    An empty row would read as "generated nothing" rather than "not generated
    yet": the next non-overwriting sweep would skip the resource forever, and
    a GET would answer 200 with no fields instead of 404. One provider outage
    would otherwise permanently poison every resource it hit.
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
