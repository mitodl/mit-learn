import hashlib
import hmac
import json

import pytest
from django.urls import reverse

from learning_resources.constants import LearningResourceType
from learning_resources.etl.constants import (
    CourseLoaderConfig,
    ETLSource,
    ProgramLoaderConfig,
)
from learning_resources.etl.ownership import current_pipeline
from learning_resources.factories import ETLSourceOwnershipFactory, ProgramFactory
from learning_resources.models import ETLSourceOwnership, LearningResource

WEBHOOK_URL_NAME = "webhooks:v1:learning_resources_webhook"


@pytest.fixture(autouse=True)
def webhook_owns_every_pair(request):
    """Hand the webhook every pair, so routing tests don't depend on ownership."""
    if "django_db" not in request.keywords:
        return
    for etl_source in ETLSource:
        for resource_type in LearningResourceType:
            ETLSourceOwnershipFactory.create(
                etl_source=etl_source.name,
                resource_type=resource_type.name,
                owner=ETLSourceOwnership.Pipeline.WEBHOOK,
            )


def _post(client, settings, payload, *, signature=None):
    """POST a JSON payload to the learning_resources webhook, signing the body."""
    body = json.dumps(payload)
    if signature is None:
        signature = hmac.new(
            settings.WEBHOOK_SECRET.encode(),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
    return client.post(
        reverse(WEBHOOK_URL_NAME),
        data=body,
        content_type="application/json",
        headers={"X-MITLearn-Signature": signature},
    )


def _resource(readable_id, etl_source, resource_type, **extra):
    return {
        "readable_id": readable_id,
        "etl_source": etl_source,
        "resource_type": resource_type,
        "title": f"Title {readable_id}",
        **extra,
    }


@pytest.mark.django_db
def test_courses_routed_to_load_courses(settings, client, mocker):
    """Course resources are routed to load_courses with their etl_source."""
    mock_clear = mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])

    payload = {
        "resources": [
            _resource(
                "course-1", ETLSource.mitpe.name, LearningResourceType.course.name
            ),
            _resource(
                "course-2", ETLSource.mitpe.name, LearningResourceType.course.name
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    mock_load_courses.assert_called_once()
    etl_source_arg, courses_arg = mock_load_courses.call_args.args
    assert etl_source_arg == ETLSource.mitpe.name
    assert [r["readable_id"] for r in courses_arg] == ["course-1", "course-2"]
    mock_load_programs.assert_not_called()
    mock_clear.assert_called_once()


@pytest.mark.django_db
def test_groups_by_source_and_type(settings, client, mocker):
    """Resources are grouped by (etl_source, resource_type) before dispatch."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])

    payload = {
        "resources": [
            _resource(
                "c-mitpe", ETLSource.mitpe.name, LearningResourceType.course.name
            ),
            _resource("c-oll", ETLSource.oll.name, LearningResourceType.course.name),
            _resource(
                "p-edx", ETLSource.mit_edx.name, LearningResourceType.program.name
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    # one load_courses call per distinct etl_source that has course resources
    assert mock_load_courses.call_count == 2
    called_sources = {call.args[0] for call in mock_load_courses.call_args_list}
    assert called_sources == {ETLSource.mitpe.name, ETLSource.oll.name}
    mock_load_programs.assert_called_once()
    assert mock_load_programs.call_args.args[0] == ETLSource.mit_edx.name


@pytest.mark.django_db
def test_programs_fetch_existing_child_courses(settings, client, mocker):
    """
    Program child courses are looked up, not upserted, matching the legacy
    program pipelines: producers send child courses as readable_id references.
    """
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])

    payload = {
        "resources": [
            _resource(
                "p-edx",
                ETLSource.mit_edx.name,
                LearningResourceType.program.name,
                courses=[{"readable_id": "MITx+6.00.1x"}],
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    assert mock_load_programs.call_args.kwargs["config"] == ProgramLoaderConfig(
        courses=CourseLoaderConfig(fetch_only=True), prune=True
    )


@pytest.mark.django_db
def test_videos_routed_and_podcasts_skipped(settings, client, mocker):
    """Video resources reach load_videos; podcasts have no route and are skipped."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_videos = mocker.patch("webhooks.views.load_videos", return_value=[])

    payload = {
        "resources": [
            _resource("v1", ETLSource.youtube.name, LearningResourceType.video.name),
            _resource(
                "pod1", ETLSource.podcast.name, LearningResourceType.podcast.name
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    mock_load_videos.assert_called_once()
    assert [r["readable_id"] for r in mock_load_videos.call_args.args[0]] == ["v1"]
    assert not LearningResource.objects.filter(readable_id="pod1").exists()


@pytest.mark.django_db
def test_documents_routed_to_load_documents(settings, client, mocker):
    """Document resources (e.g. MIT Climate articles) route to load_documents."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_documents = mocker.patch("webhooks.views.load_documents", return_value=[])
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])

    payload = {
        "resources": [
            _resource(
                "climate-1",
                ETLSource.mit_climate.name,
                LearningResourceType.document.name,
                resource_category="Article",
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    mock_load_documents.assert_called_once()
    etl_source_arg, docs_arg = mock_load_documents.call_args.args
    assert etl_source_arg == ETLSource.mit_climate.name
    assert [r["readable_id"] for r in docs_arg] == ["climate-1"]
    mock_load_courses.assert_not_called()


@pytest.mark.django_db
def test_unsupported_resource_type_skipped(settings, client, mocker):
    """A resource_type with no loader (e.g. mit_climate 'article') is skipped, not 500."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])
    mock_load_documents = mocker.patch("webhooks.views.load_documents", return_value=[])
    mock_load_videos = mocker.patch("webhooks.views.load_videos", return_value=[])

    payload = {
        "resources": [
            _resource("mystery-1", ETLSource.mit_climate.name, "some_unknown_type"),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    mock_load_courses.assert_not_called()
    mock_load_programs.assert_not_called()
    mock_load_documents.assert_not_called()
    mock_load_videos.assert_not_called()


@pytest.mark.django_db
def test_missing_required_field_returns_400(settings, client, mocker):
    """A resource missing readable_id/etl_source/resource_type is rejected."""
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    payload = {
        "resources": [
            {
                "etl_source": ETLSource.mitpe.name,
                "resource_type": LearningResourceType.course.name,
            },
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 400
    mock_load_courses.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize("payload", [{"resources": []}, {"resources": [], "sync": []}])
def test_empty_batch_returns_400(settings, client, mocker, payload):
    """
    A batch with no resources and no sync pairs is rejected: it names no
    (etl_source, resource_type), so accepting it would report success while
    pruning nothing.
    """
    mock_clear = mocker.patch("webhooks.views.clear_views_cache")
    response = _post(client, settings, payload)

    assert response.status_code == 400
    mock_clear.assert_not_called()


@pytest.mark.django_db
def test_sync_pair_without_resources_prunes(settings, client, mocker):
    """
    A sync-declared pair with no resources runs its loader with an empty set
    and prune_empty, while a declared pair that has resources loads normally.
    """
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])

    payload = {
        "resources": [
            _resource(
                "course-1", ETLSource.mitpe.name, LearningResourceType.course.name
            ),
        ],
        "sync": [
            {
                "etl_source": ETLSource.mitpe.name,
                "resource_type": LearningResourceType.course.name,
            },
            {
                "etl_source": ETLSource.mitpe.name,
                "resource_type": LearningResourceType.program.name,
            },
        ],
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    _, courses_arg = mock_load_courses.call_args.args
    assert [r["readable_id"] for r in courses_arg] == ["course-1"]
    assert mock_load_courses.call_args.kwargs["config"].prune_empty is False
    assert mock_load_programs.call_args.args == (ETLSource.mitpe.name, [])
    assert mock_load_programs.call_args.kwargs["config"] == ProgramLoaderConfig(
        courses=CourseLoaderConfig(fetch_only=True), prune=True, prune_empty=True
    )


@pytest.mark.django_db
def test_sync_only_batch_unpublishes_the_pair(settings, client, mocker):
    """A batch that only declares a pair unpublishes everything held for it."""
    mocker.patch("webhooks.views.clear_views_cache")
    mocker.patch(
        "learning_resources.etl.loaders.load_course_blocklist", return_value=[]
    )
    mocker.patch("learning_resources_search.tasks.deindex_document")
    program = ProgramFactory.create(learning_resource__etl_source=ETLSource.mitpe.name)
    other_program = ProgramFactory.create(
        learning_resource__etl_source=ETLSource.mitxonline.name
    )

    payload = {
        "resources": [],
        "sync": [
            {
                "etl_source": ETLSource.mitpe.name,
                "resource_type": LearningResourceType.program.name,
            }
        ],
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    program.learning_resource.refresh_from_db()
    other_program.learning_resource.refresh_from_db()
    assert program.learning_resource.published is False
    assert other_program.learning_resource.published is True


@pytest.mark.django_db
@pytest.mark.parametrize(
    "resource_type",
    [LearningResourceType.video.name, "article"],
)
def test_sync_rejects_types_that_cannot_be_pruned(
    settings, client, mocker, resource_type
):
    """Only course, program and document pairs can be declared for sync."""
    mock_clear = mocker.patch("webhooks.views.clear_views_cache")
    payload = {
        "resources": [],
        "sync": [
            {"etl_source": ETLSource.youtube.name, "resource_type": resource_type}
        ],
    }
    response = _post(client, settings, payload)

    assert response.status_code == 400
    mock_clear.assert_not_called()


@pytest.mark.django_db
def test_invalid_signature_rejected(settings, client, mocker):
    """A bad signature short-circuits before any loader runs."""
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    payload = {
        "resources": [
            _resource("c1", ETLSource.mitpe.name, LearningResourceType.course.name),
        ]
    }
    response = _post(client, settings, payload, signature="deadbeef")

    assert response.status_code != 200
    mock_load_courses.assert_not_called()


@pytest.mark.django_db
def test_invalid_json_returns_400(settings, client):
    """A validly-signed but malformed JSON body returns 400."""
    body = "{not json"
    signature = hmac.new(
        settings.WEBHOOK_SECRET.encode(),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    response = client.post(
        reverse(WEBHOOK_URL_NAME),
        data=body,
        content_type="application/json",
        headers={"X-MITLearn-Signature": signature},
    )
    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("owner", "resource_type"),
    [
        (ETLSourceOwnership.Pipeline.LEGACY, LearningResourceType.course.name),
        (ETLSourceOwnership.Pipeline.WAREHOUSE, LearningResourceType.course.name),
        (ETLSourceOwnership.Pipeline.LEGACY, LearningResourceType.program.name),
    ],
)
def test_batch_rejected_when_webhook_does_not_own_a_group(
    settings, client, mocker, owner, resource_type
):
    """One group the webhook doesn't own rejects the whole batch with 409, unwritten."""
    etl_source = ETLSource.mitpe.name
    ETLSourceOwnership.objects.filter(
        etl_source=etl_source, resource_type=resource_type
    ).update(owner=owner)
    mock_clear = mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    mock_load_documents = mocker.patch("webhooks.views.load_documents", return_value=[])
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])

    payload = {
        "resources": [
            _resource(
                "doc-1", ETLSource.mit_climate.name, LearningResourceType.document.name
            ),
            _resource(
                "course-1", ETLSource.mitpe.name, LearningResourceType.course.name
            ),
            _resource(
                "program-1", ETLSource.mitpe.name, LearningResourceType.program.name
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 409
    assert response.json()["status"] == "error"
    assert etl_source in response.json()["message"]
    mock_load_documents.assert_not_called()
    mock_load_courses.assert_not_called()
    mock_load_programs.assert_not_called()
    mock_clear.assert_not_called()


@pytest.mark.django_db
def test_batch_rejected_when_webhook_does_not_own_a_sync_pair(settings, client, mocker):
    """A declared pair the webhook doesn't own rejects the batch like a group would."""
    ETLSourceOwnership.objects.filter(
        etl_source=ETLSource.mitpe.name,
        resource_type=LearningResourceType.program.name,
    ).update(owner=ETLSourceOwnership.Pipeline.LEGACY)
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])

    payload = {
        "resources": [
            _resource(
                "course-1", ETLSource.mitpe.name, LearningResourceType.course.name
            ),
        ],
        "sync": [
            {
                "etl_source": ETLSource.mitpe.name,
                "resource_type": LearningResourceType.program.name,
            }
        ],
    }
    response = _post(client, settings, payload)

    assert response.status_code == 409
    assert (
        f"{ETLSource.mitpe.name}/{LearningResourceType.program.name}"
        in response.json()["message"]
    )
    mock_load_courses.assert_not_called()
    mock_load_programs.assert_not_called()


@pytest.mark.django_db
def test_loaders_run_as_the_webhook_pipeline(settings, client, mocker):
    """The shared loaders see the webhook pipeline, so their own guard lets it write."""
    seen = []
    mocker.patch("webhooks.views.clear_views_cache")
    mocker.patch(
        "webhooks.views.load_courses",
        side_effect=lambda *_args, **_kwargs: seen.append(current_pipeline()) or [],
    )

    payload = {
        "resources": [
            _resource(
                "course-1", ETLSource.mitpe.name, LearningResourceType.course.name
            )
        ]
    }
    assert _post(client, settings, payload).status_code == 200
    assert seen == [ETLSourceOwnership.Pipeline.WEBHOOK]


@pytest.mark.django_db
def test_descriptions_are_sanitized_before_loading(settings, client, mocker):
    """
    Scripts are stripped from the description of a resource and of its nested
    runs, links survive, and titles are left alone.
    """
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    dirty = '<p>Notes <a href="https://example.com" onclick="x()">here</a></p><script>alert(1)</script>'
    clean = (
        '<p>Notes <a href="https://example.com" rel="noopener noreferrer">here</a></p>'
    )

    payload = {
        "resources": [
            _resource(
                "course-1",
                ETLSource.mitpe.name,
                LearningResourceType.course.name,
                title="R&D <Basics>",
                description=dirty,
                runs=[{"run_id": "run-1", "description": dirty}],
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    (course,) = mock_load_courses.call_args.args[1]
    assert course["description"] == clean
    assert course["runs"][0]["description"] == clean
    assert course["title"] == "R&D <Basics>"


@pytest.mark.django_db
@pytest.mark.parametrize("description", [None, ""])
def test_absent_or_empty_description_is_not_rewritten(
    settings, client, mocker, description
):
    """
    A null description stays null and a missing one stays missing: turning
    either into "" would overwrite the stored description on load.
    """
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])

    payload = {
        "resources": [
            _resource(
                "course-1",
                ETLSource.mitpe.name,
                LearningResourceType.course.name,
                description=description,
            ),
            _resource(
                "course-2", ETLSource.mitpe.name, LearningResourceType.course.name
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    with_description, without = mock_load_courses.call_args.args[1]
    assert with_description["description"] == description
    assert "description" not in without
