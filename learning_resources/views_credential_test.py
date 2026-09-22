"""Tests for the credential metadata API"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse

from learning_resources.constants import (
    GROUP_COURSE_AUTHORS,
    CredentialMetadataField,
    LearningResourceType,
    PlatformType,
)
from learning_resources.credentials import RESPONSE_SCHEMAS, CredentialMetadata
from learning_resources.etl.constants import MARKETING_PAGE_FILE_TYPE, ETLSource
from learning_resources.factories import (
    ContentFileFactory,
    CredentialMetadataConfigurationFactory,
    CredentialMetadataFactory,
    LearningResourceFactory,
    LearningResourcePlatformFactory,
)
from learning_resources.models import CredentialMetadata as CredentialMetadataModel
from learning_resources.models import (
    CredentialMetadataConfiguration,
    CredentialMetadataGenerationLog,
)

GENERATED = {
    "description": "A course about modelling fluid flow.",
    "criteria": ["Applied conservation laws"],
}


@pytest.fixture
def mock_generate(mocker):
    """Mock credential metadata generation"""
    return mocker.patch(
        "learning_resources.credentials.generate_credential_metadata",
        return_value=CredentialMetadata(fields=GENERATED, errors={}),
    )


def mitxonline_course(readable_id=None):
    """Create an MITx Online course, the only kind the endpoint generates for"""
    return LearningResourceFactory.create(
        is_course=True,
        etl_source=ETLSource.mitxonline.name,
        platform=LearningResourcePlatformFactory.create(
            code=PlatformType.mitxonline.name
        ),
        **({"readable_id": readable_id} if readable_id else {}),
    )


@pytest.fixture
def resource():
    """Return an MITx Online course, the only kind the endpoint generates for"""
    return mitxonline_course()


def credential_url():
    """Return the endpoint url"""
    return reverse("lr:v0:credential_metadata")


def generate(client, readable_id=None):
    """Post a generation request, optionally scoped to a resource"""
    body = {"resource_readable_id": readable_id} if readable_id else {}
    return client.post(credential_url(), body)


def fetch(client, readable_id):
    """Get the stored metadata for a resource"""
    return client.get(credential_url(), {"resource_readable_id": readable_id})


@pytest.mark.django_db(transaction=True)
def test_credential_metadata(client, django_user_model, resource, mocker):
    CredentialMetadataConfiguration.objects.all().delete()
    for field in CredentialMetadataField:
        CredentialMetadataConfigurationFactory.create(
            field=field.name, prompt=f"Generate the {field.name}."
        )
    canned = {
        RESPONSE_SCHEMAS[field]: {field: value} for field, value in GENERATED.items()
    }
    llm = mocker.Mock()
    llm.with_structured_output.side_effect = lambda schema: mocker.Mock(
        ainvoke=mocker.AsyncMock(return_value=canned[schema])
    )
    mocker.patch("learning_resources.credentials._get_llm", return_value=llm)

    ContentFileFactory.create(
        learning_resource=resource,
        file_type=MARKETING_PAGE_FILE_TYPE,
        content="## About this course\n\nLearn to model fluid flow.",
        published=True,
    )
    mocker.patch(
        "learning_resources.credentials.async_content_file_chunks_for_resource",
        return_value=[
            {
                "point_id": "point-1",
                "chunk_content": "A syllabus chunk long enough to be kept.",
                "title": "Syllabus",
                "file_extension": ".html",
                "file_type": "text",
            }
        ],
    )
    user = django_user_model.objects.create(is_staff=True)
    client.force_login(user)

    response = generate(client, resource.readable_id)

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": resource.readable_id,
        **GENERATED,
    }
    # The log rows are the evidence the request reached the generator, and
    # that the lazy user object arrived intact on the writing thread.
    generations = CredentialMetadataGenerationLog.objects.filter(
        learning_resource=resource
    )
    assert generations.count() == len(CredentialMetadataField)
    assert {generation.generated_by for generation in generations} == {user}


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_anonymous(client, resource, mock_generate):
    """An anonymous request generates nothing"""
    assert generate(client, resource.readable_id).status_code == 403
    mock_generate.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_non_author(
    client, django_user_model, resource, mock_generate
):
    """A logged-in user who is not a course author generates nothing"""
    client.force_login(django_user_model.objects.create())
    assert generate(client, resource.readable_id).status_code == 403
    mock_generate.assert_not_called()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("user_role", ["staff", "course_author"])
def test_credential_metadata_generates(
    client, django_user_model, resource, mock_generate, user_role
):
    """Staff and course authors get a draft for every field"""
    if user_role == "staff":
        user = django_user_model.objects.create(is_staff=True)
    else:
        user = django_user_model.objects.create()
        group, _ = Group.objects.get_or_create(name=GROUP_COURSE_AUTHORS)
        group.user_set.add(user)
    client.force_login(user)

    response = generate(client, resource.readable_id)

    assert response.status_code == 200
    # No errors key at all when every field generated, so a caller can test
    # for its presence rather than for an empty object.
    assert response.json() == {
        "resource_readable_id": resource.readable_id,
        **GENERATED,
    }
    assert mock_generate.call_args.args[0] == resource
    assert mock_generate.call_args.kwargs["user"] == user


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_reports_every_field_failing(
    client, django_user_model, resource, mock_generate
):
    """A response with no fields at all still says why"""
    client.force_login(django_user_model.objects.create(is_staff=True))
    errors = {
        "description": "The model returned no description.",
        "criteria": "litellm.Timeout: request timed out",
    }
    mock_generate.return_value = CredentialMetadata(fields={}, errors=errors)

    response = generate(client, resource.readable_id)

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": resource.readable_id,
        "errors": errors,
    }


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_requires_a_resource(
    client, django_user_model, mock_generate
):
    """The resource readable id is required"""
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = generate(client)

    assert response.status_code == 400
    assert "resource_readable_id" in response.json()
    mock_generate.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_unknown_resource(client, django_user_model, mock_generate):
    """An unknown readable id is a 404, not an empty draft"""
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = generate(client, "no-such-course")

    assert response.status_code == 404
    mock_generate.assert_not_called()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    ("resource_type", "etl_source"),
    [
        (LearningResourceType.course.name, ETLSource.xpro.name),
        (LearningResourceType.video.name, ETLSource.youtube.name),
        # A type with no prompts of its own, on the right source.
        (LearningResourceType.video.name, ETLSource.mitxonline.name),
    ],
)
def test_credential_metadata_rejects_unsupported_resources(
    client, django_user_model, mock_generate, resource_type, etl_source
):
    """
    Only the MITx Online types with prompts of their own are generated for.

    The prompts were validated against those, and another platform's content
    is differently shaped, so the endpoint says so instead of returning an
    unreviewed draft.
    """
    unsupported = LearningResourceFactory.create(
        resource_type=resource_type, etl_source=etl_source
    )
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = generate(client, unsupported.readable_id)

    assert response.status_code == 400
    assert unsupported.readable_id in str(response.json())
    mock_generate.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_omits_fields_it_could_not_generate(
    client, django_user_model, resource, mocker
):
    """
    A field that failed to generate is absent, not blank -- but is explained.

    Blank would overwrite a good value in the form it prepopulates; absent and
    unexplained would leave a caller unable to tell the failure from a course
    the model had nothing to say about.
    """
    mocker.patch(
        "learning_resources.credentials.generate_credential_metadata",
        return_value=CredentialMetadata(
            fields={"description": "Only this one worked."},
            errors={"criteria": "litellm.APIConnectionError: connection refused"},
        ),
    )
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = generate(client, resource.readable_id)

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": resource.readable_id,
        "description": "Only this one worked.",
        "errors": {"criteria": "litellm.APIConnectionError: connection refused"},
    }


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_post_answers_with_the_stored_row(
    client, django_user_model, resource, mocker
):
    """
    A POST reports what is now in force, not just what this run generated.

    The store merges: a field that failed keeps the value an earlier run
    stored. Answering with the generated fields alone made a POST and the GET
    straight after it disagree -- the POST omitted the surviving criteria, so
    a form prepopulated from it showed none until the page was reloaded.
    """
    CredentialMetadataFactory.create(
        learning_resource=resource,
        description="Stale",
        criteria=["PRESERVED OLD CRITERION"],
    )
    mocker.patch(
        "learning_resources.credentials.generate_credential_metadata",
        return_value=CredentialMetadata(
            fields={"description": "NEWLY GENERATED DESCRIPTION"},
            errors={"criteria": "provider blew up"},
        ),
    )
    client.force_login(django_user_model.objects.create(is_staff=True))

    generated = generate(client, resource.readable_id)
    fetched = fetch(client, resource.readable_id)

    assert generated.status_code == 200
    assert generated.json() == {
        "resource_readable_id": resource.readable_id,
        "description": "NEWLY GENERATED DESCRIPTION",
        "criteria": ["PRESERVED OLD CRITERION"],
        "errors": {"criteria": "provider blew up"},
    }
    # The two handlers agree on everything but the errors, which only the
    # generating one has to report.
    assert fetched.json() == {
        key: value for key, value in generated.json().items() if key != "errors"
    }


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_post_with_nothing_generated_or_stored(
    client, django_user_model, resource, mocker
):
    """
    A total failure against a resource with no stored row reports only errors.

    Re-reading the row must not invent fields: there is nothing stored and
    nothing was generated, so the response carries the explanations alone.
    """
    errors = {field.name: "provider blew up" for field in CredentialMetadataField}
    mocker.patch(
        "learning_resources.credentials.generate_credential_metadata",
        return_value=CredentialMetadata(fields={}, errors=errors),
    )
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = generate(client, resource.readable_id)

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": resource.readable_id,
        "errors": errors,
    }


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_generates_for_a_program(
    client, django_user_model, mock_generate
):
    """
    A program is generated for through the endpoint, like a course.

    Its prompts and its evidence differ -- its courses' criteria stand in for
    the content files a course retrieves -- but that is settled inside
    generation, so the endpoint resolves it the same way.
    """
    program = mitxonline_course()
    program.resource_type = LearningResourceType.program.name
    program.save()
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = generate(client, program.readable_id)

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": program.readable_id,
        **GENERATED,
    }
    assert mock_generate.called


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_program_reports_why_it_was_skipped(
    client, django_user_model, mocker
):
    """
    A program that could not be generated for says why, per field.

    Both reasons a program is skipped -- no marketing page, or a course
    without criteria yet -- reach the caller this way, so an author is not
    left looking at an empty form with no explanation.
    """
    program = mitxonline_course()
    program.resource_type = LearningResourceType.program.name
    program.save()
    detail = "Nothing was generated: the program is missing its courses' criteria."
    mocker.patch(
        "learning_resources.credentials.generate_credential_metadata",
        return_value=CredentialMetadata(
            fields={},
            errors={field.name: detail for field in CredentialMetadataField},
        ),
    )
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = generate(client, program.readable_id)

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": program.readable_id,
        "errors": {field.name: detail for field in CredentialMetadataField},
    }


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_get_never_generates(
    client, django_user_model, resource, mock_generate
):
    """
    A GET serves what is stored and never generates.

    Generation spends money per call and writes a generation log, so it must
    not be triggerable by a prefetch, a proxy retry, or a crafted link
    followed by a logged-in author -- none of which a CSRF check on GET would
    stop. GET used to answer 405 for that reason; now that it reads stored
    values instead, the money assertion is what survives from that test.
    """
    CredentialMetadataFactory.create(learning_resource=resource, **GENERATED)
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = fetch(client, resource.readable_id)

    assert response.status_code == 200
    mock_generate.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_get(client, django_user_model, resource):
    """Stored metadata is returned in the same shape the generate path uses"""
    CredentialMetadataFactory.create(learning_resource=resource, **GENERATED)
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = fetch(client, resource.readable_id)

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": resource.readable_id,
        **GENERATED,
    }


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_get_partial(client, django_user_model, resource):
    """
    Half a stored row returns only the half that exists.

    A field the generator could not produce is omitted rather than sent as a
    blank, matching the generate path: a caller prepopulating a form must not
    overwrite a good value with an empty one.
    """
    CredentialMetadataFactory.create(
        learning_resource=resource, description="Only this one worked.", criteria=[]
    )
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = fetch(client, resource.readable_id)

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": resource.readable_id,
        "description": "Only this one worked.",
    }


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_get_not_yet_generated(client, django_user_model, resource):
    """
    A resource with no stored metadata is a 404 that says so.

    Worded differently to the unknown-readable_id 404: one means come back
    after the sweep has run, the other means the id is wrong.
    """
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = fetch(client, resource.readable_id)

    assert response.status_code == 404
    assert "has been generated" in response.json()["detail"]


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_get_unknown_resource(client, django_user_model):
    """An unknown readable_id is a 404 about the resource, not the metadata"""
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = fetch(client, "course-v1:MITx+nope")

    assert response.status_code == 404
    assert "No learning resource" in response.json()["detail"]


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_get_non_mitxonline(client, django_user_model):
    """A non-MITx Online resource is rejected on read as it is on generate"""
    other = LearningResourceFactory.create(
        is_course=True,
        etl_source=ETLSource.mit_edx.name,
        platform=LearningResourcePlatformFactory.create(code=PlatformType.edx.name),
    )
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = fetch(client, other.readable_id)

    assert response.status_code == 400


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_get_requires_a_readable_id(client, django_user_model):
    """A GET with no readable_id is a 400, not a 500"""
    client.force_login(django_user_model.objects.create(is_staff=True))

    assert client.get(credential_url()).status_code == 400


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_get_anonymous(client, resource):
    """Stored metadata is author-only draft content"""
    CredentialMetadataFactory.create(learning_resource=resource, **GENERATED)

    assert fetch(client, resource.readable_id).status_code == 403


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_get_resolves_the_mitxonline_course(
    client, django_user_model
):
    """
    A readable id shared with another platform reads the MITx Online row.

    readable_id is unique only per (platform, resource_type), so the read has
    to pin the whole key. The edX row is created first and given different
    metadata, so a lookup that took whichever row came back first would serve
    it.
    """
    readable_id = "course-v1:MITx+18.01"
    edx_course = LearningResourceFactory.create(
        is_course=True,
        readable_id=readable_id,
        etl_source=ETLSource.mit_edx.name,
        platform=LearningResourcePlatformFactory.create(code=PlatformType.edx.name),
    )
    CredentialMetadataFactory.create(
        learning_resource=edx_course, description="The edX one."
    )
    CredentialMetadataFactory.create(
        learning_resource=mitxonline_course(readable_id), **GENERATED
    )
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = fetch(client, readable_id)

    assert response.status_code == 200
    assert response.json()["description"] == GENERATED["description"]


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_post_stores_what_it_generated(
    client, django_user_model, resource, mock_generate
):
    """
    A generate request replaces the stored metadata a GET will serve.

    The response shape is unchanged: storing is a side effect, so that the
    endpoint's regenerate path and the daily sweep leave the same state.
    """
    CredentialMetadataFactory.create(
        learning_resource=resource, description="Stale", criteria=["Stale"]
    )
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = generate(client, resource.readable_id)

    assert response.status_code == 200
    assert response.json() == {
        "resource_readable_id": resource.readable_id,
        **GENERATED,
    }
    stored = CredentialMetadataModel.objects.get(learning_resource=resource)
    assert stored.description == GENERATED["description"]
    assert stored.criteria == GENERATED["criteria"]


@pytest.mark.django_db(transaction=True)
def test_credential_metadata_resolves_the_mitxonline_course(
    client, django_user_model, mock_generate
):
    """
    A readable id shared with another platform resolves to the MITx Online row.

    readable_id is unique only per (platform, resource_type), so the lookup has
    to pin the whole key. The edX row is created first, so a lookup that took
    whichever row came back first would pick it.
    """
    readable_id = "course-v1:MITx+18.01"
    LearningResourceFactory.create(
        is_course=True,
        readable_id=readable_id,
        etl_source=ETLSource.mit_edx.name,
        platform=LearningResourcePlatformFactory.create(code=PlatformType.edx.name),
    )
    expected = mitxonline_course(readable_id)
    client.force_login(django_user_model.objects.create(is_staff=True))

    response = generate(client, readable_id)

    assert response.status_code == 200
    assert mock_generate.call_args.args[0] == expected
