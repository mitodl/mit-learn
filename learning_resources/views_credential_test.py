"""Tests for the credential metadata API"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

from learning_resources.constants import GROUP_COURSE_AUTHORS
from learning_resources.factories import LearningResourceFactory

GENERATED = {
    "description": "A course about modelling fluid flow.",
    "criteria": "- Applied conservation laws",
    "criteria_skills": ["Applied conservation laws"],
    "learning_goals": ["Model fluid flow"],
}


@pytest.fixture
def mock_generate(mocker):
    """Mock credential metadata generation"""
    return mocker.patch(
        "learning_resources.views.generate_credential_metadata",
        return_value=GENERATED,
    )


@pytest.fixture
def resource():
    """Return a course to generate credential metadata for"""
    return LearningResourceFactory.create(is_course=True)


def credential_url(readable_id=None):
    """Return the endpoint url, optionally scoped to a resource"""
    url = reverse("lr:v0:credential_metadata")
    return f"{url}?resource_readable_id={readable_id}" if readable_id else url


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_anonymous(client, resource, mock_generate):
    """An anonymous request generates nothing"""
    assert client.get(credential_url(resource.readable_id)).status_code == 403
    mock_generate.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_non_author(
    client, django_user_model, resource, mock_generate
):
    """A logged-in user who is not a course author generates nothing"""
    client.force_login(django_user_model.objects.create())
    assert client.get(credential_url(resource.readable_id)).status_code == 403
    mock_generate.assert_not_called()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("user_role", ["staff", "course_author"])
def test_credential_metadata_generates(
    client, django_user_model, resource, mock_generate, user_role
):
    """Staff and course authors get a full set of drafts"""
    if user_role == "staff":
        user = django_user_model.objects.create(is_staff=True)
    else:
        user = django_user_model.objects.create()
        group, _ = Group.objects.get_or_create(name=GROUP_COURSE_AUTHORS)
        group.user_set.add(user)
    client.force_login(user)

    response = client.get(credential_url(resource.readable_id))

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": resource.readable_id,
        **GENERATED,
    }
    assert mock_generate.call_args.args[0] == resource
    assert mock_generate.call_args.kwargs["user"] == user


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_requires_a_resource(
    client, django_user_model, mock_generate
):
    """The resource readable id is required"""
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = client.get(credential_url())

    assert response.status_code == 400
    assert "resource_readable_id" in response.json()
    mock_generate.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_unknown_resource(client, django_user_model, mock_generate):
    """An unknown readable id is a 404, not an empty draft"""
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = client.get(credential_url("no-such-course"))

    assert response.status_code == 404
    mock_generate.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_omits_fields_it_could_not_generate(
    client, django_user_model, resource, mocker
):
    """A field that failed to generate is absent, not blank"""
    mocker.patch(
        "learning_resources.views.generate_credential_metadata",
        return_value={"description": "Only this one worked."},
    )
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = client.get(credential_url(resource.readable_id))

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": resource.readable_id,
        "description": "Only this one worked.",
    }
