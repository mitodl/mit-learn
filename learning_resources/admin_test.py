"""Tests for learning_resources admin"""

import pytest
from django.contrib.admin.sites import site
from django.contrib.admin.widgets import AdminTextareaWidget
from django.test import RequestFactory
from django.urls import reverse

from learning_resources.admin import CredentialMetadataAdmin, TutorProblemFileAdmin
from learning_resources.factories import (
    CredentialMetadataFactory,
    LearningResourceRunFactory,
    TutorProblemFileFactory,
)
from learning_resources.models import CredentialMetadata, TutorProblemFile


@pytest.mark.django_db
def test_tutor_problem_file_changelist_query_count(
    admin_user, django_assert_num_queries
):
    """Changelist query count should not grow with the number of rows"""
    for _ in range(5):
        TutorProblemFileFactory.create(run=LearningResourceRunFactory.create())
    request = RequestFactory().get(
        reverse("admin:learning_resources_tutorproblemfile_changelist")
    )
    request.user = admin_user
    model_admin = TutorProblemFileAdmin(TutorProblemFile, site)
    with django_assert_num_queries(3):
        model_admin.changelist_view(request).render()


@pytest.fixture
def criteria_field():
    """Return the `criteria` form field as the admin change form builds it"""
    model_admin = CredentialMetadataAdmin(CredentialMetadata, site)
    return model_admin.get_form(None)().fields["criteria"]


@pytest.mark.django_db
def test_credential_metadata_criteria_is_a_textarea(criteria_field):
    """
    `criteria` gets a textarea, like `description` beside it.

    An ArrayField otherwise renders through SimpleArrayField, a CharField
    subclass, so it lands in a one-line TextInput too small to read the
    criteria it holds.
    """
    assert isinstance(criteria_field.widget, AdminTextareaWidget)


@pytest.mark.django_db
def test_credential_metadata_criteria_is_one_per_line(criteria_field):
    """The stored list is shown a criterion per line, and read back the same"""
    stored = ["Applied conservation laws", "Modelled fluid flow"]

    shown = criteria_field.prepare_value(stored)

    assert shown == "Applied conservation laws\nModelled fluid flow"
    assert criteria_field.clean(shown) == stored


@pytest.mark.django_db
def test_credential_metadata_criteria_keeps_a_comma(criteria_field):
    """
    A criterion containing a comma survives a round trip.

    Comma-separated, `SimpleArrayField` would cut this one in two on save,
    with no way to escape it -- and criteria are prose, so commas are
    ordinary.
    """
    stored = ["Applied conservation laws, including mass and momentum"]

    assert criteria_field.clean(criteria_field.prepare_value(stored)) == stored


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("submitted", "expected"),
    [
        # Browsers submit CRLF from a textarea.
        ("One\r\nTwo", ["One", "Two"]),
        # A trailing newline or a gap between entries is not an empty
        # criterion.
        ("One\n\n\nTwo\n", ["One", "Two"]),
        ("   \n", []),
        ("", []),
    ],
)
def test_credential_metadata_criteria_cleans_whitespace(
    criteria_field, submitted, expected
):
    """Line endings and blank lines do not become criteria"""
    assert criteria_field.clean(submitted) == expected


@pytest.mark.django_db
def test_credential_metadata_change_view_renders(admin_user):
    """The change form itself still renders with the overridden field"""
    stored = CredentialMetadataFactory.create(criteria=["Did a thing"])
    request = RequestFactory().get(
        reverse("admin:learning_resources_credentialmetadata_change", args=(stored.id,))
    )
    request.user = admin_user

    response = CredentialMetadataAdmin(CredentialMetadata, site).change_view(
        request, str(stored.id)
    )

    assert response.status_code == 200
    assert b"Did a thing" in response.render().content
