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
from learning_resources.factories import (
    CourseFactory,
    ETLSourceOwnershipFactory,
    LearningResourceFactory,
    ProgramFactory,
)
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


def _published_courses(count, etl_source=ETLSource.oll.name):
    """Create published courses of a source and return their readable_ids."""
    return [
        course.learning_resource.readable_id
        for course in CourseFactory.create_batch(
            count, learning_resource__etl_source=etl_source
        )
    ]


def _course_rows(readable_ids, etl_source=ETLSource.oll.name):
    """Build rows a load leaves published: published is true, and they have runs."""
    return [
        _resource(
            readable_id,
            etl_source,
            LearningResourceType.course.name,
            published=True,
            runs=[{"run_id": readable_id}],
        )
        for readable_id in readable_ids
    ]


def _sync_only(etl_source, resource_type=LearningResourceType.program.name):
    """Build a batch that only declares a pair."""
    return {
        "resources": [],
        "sync": [{"etl_source": etl_source, "resource_type": resource_type}],
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
            _resource("p-xpro", ETLSource.xpro.name, LearningResourceType.program.name),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    # one load_courses call per distinct etl_source that has course resources
    assert mock_load_courses.call_count == 2
    called_sources = {call.args[0] for call in mock_load_courses.call_args_list}
    assert called_sources == {ETLSource.mitpe.name, ETLSource.oll.name}
    mock_load_programs.assert_called_once()
    assert mock_load_programs.call_args.args[0] == ETLSource.xpro.name


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
                "p-xpro",
                ETLSource.xpro.name,
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
        "allow_mass_unpublish": True,
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    program.learning_resource.refresh_from_db()
    other_program.learning_resource.refresh_from_db()
    assert program.learning_resource.published is False
    assert other_program.learning_resource.published is True


@pytest.mark.django_db
def test_sync_only_batch_is_over_the_limit_without_the_override(
    settings, client, mocker
):
    """A declared pair going empty unpublishes all of it, so the limit stops it."""
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])
    ProgramFactory.create(learning_resource__etl_source=ETLSource.mitpe.name)

    response = _post(client, settings, _sync_only(ETLSource.mitpe.name))

    assert response.status_code == 422
    assert "1 of 1 published" in response.json()["message"]
    mock_load_programs.assert_not_called()


@pytest.mark.django_db
def test_sync_only_batch_with_nothing_published_is_not_refused(
    settings, client, mocker
):
    """A declared pair that is already empty has nothing to protect."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])

    response = _post(client, settings, _sync_only(ETLSource.mitpe.name))

    assert response.status_code == 200
    mock_load_programs.assert_called_once()


@pytest.mark.django_db
def test_batch_over_the_limit_is_rejected_unwritten(settings, client, mocker):
    """The batch of 14 that unpublished 44 of 58 OLL courses is refused."""
    mock_clear = mocker.patch("webhooks.views.clear_views_cache")
    readable_ids = _published_courses(58)

    response = _post(client, settings, {"resources": _course_rows(readable_ids[:14])})

    assert response.status_code == 422
    assert response.json()["status"] == "error"
    assert "44 of 58 published oll course" in response.json()["message"]
    assert (
        LearningResource.objects.filter(
            etl_source=ETLSource.oll.name, published=True
        ).count()
        == 58
    )
    mock_clear.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("published", "delivered", "status_code"),
    [
        # oll courses in production, 2026-11-02
        (63, 57, 200),
        (63, 56, 422),
        # mitpe courses
        (46, 42, 200),
        (46, 41, 422),
        # exactly the limit is allowed
        (10, 9, 200),
        # mitpe programs: under ten published, one removal is over the limit
        (4, 4, 200),
        (4, 3, 422),
        # one published resource, as mit_edx programs have
        (1, 1, 200),
    ],
)
def test_limit_at_each_source_size(  # noqa: PLR0913
    settings, client, mocker, published, delivered, status_code
):
    """A pair may lose 10% of its published resources, rounded down."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    readable_ids = _published_courses(published)

    response = _post(
        client, settings, {"resources": _course_rows(readable_ids[:delivered])}
    )

    assert response.status_code == status_code
    assert mock_load_courses.called is (status_code == 200)


@pytest.mark.django_db
def test_allow_mass_unpublish_loads_past_the_limit(settings, client, mocker):
    """The override sends the batch to the loader, which prunes as usual."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    readable_ids = _published_courses(58)

    response = _post(
        client,
        settings,
        {"resources": _course_rows(readable_ids[:14]), "allow_mass_unpublish": True},
    )

    assert response.status_code == 200
    mock_load_courses.assert_called_once()


@pytest.mark.django_db
def test_limit_on_one_group_rejects_the_whole_batch(settings, client, mocker):
    """A group within the limit is not loaded when another group is over it."""
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])
    readable_ids = _published_courses(10, etl_source=ETLSource.mitpe.name)
    ProgramFactory.create_batch(4, learning_resource__etl_source=ETLSource.mitpe.name)

    response = _post(
        client,
        settings,
        {
            "resources": [
                *_course_rows(readable_ids, etl_source=ETLSource.mitpe.name),
                _resource(
                    "program-1",
                    ETLSource.mitpe.name,
                    LearningResourceType.program.name,
                    published=True,
                    runs=[{"run_id": "program-1"}],
                ),
            ]
        },
    )

    assert response.status_code == 422
    assert "4 of 4 published mitpe program" in response.json()["message"]
    mock_load_courses.assert_not_called()
    mock_load_programs.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "overrides",
    [{"published": False}, {"runs": []}],
    ids=["marked_unpublished", "no_runs"],
)
def test_limit_counts_what_the_loader_will_unpublish(
    settings, client, mocker, overrides
):
    """A delivered course the load leaves unpublished counts against the limit."""
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    readable_ids = _published_courses(10)
    rows = _course_rows(readable_ids)
    for row in rows[:2]:
        row.update(overrides)

    response = _post(client, settings, {"resources": rows})

    assert response.status_code == 422
    assert "2 of 10 published" in response.json()["message"]
    mock_load_courses.assert_not_called()


@pytest.mark.django_db
def test_limit_counts_a_program_without_runs(settings, client, mocker):
    """Courses and programs share the rule that no runs means unpublished."""
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])
    program = ProgramFactory.create(
        learning_resource__etl_source=ETLSource.mitpe.name
    ).learning_resource

    response = _post(
        client,
        settings,
        {
            "resources": [
                _resource(
                    program.readable_id,
                    ETLSource.mitpe.name,
                    LearningResourceType.program.name,
                    published=True,
                    runs=[],
                )
            ]
        },
    )

    assert response.status_code == 422
    mock_load_programs.assert_not_called()


@pytest.mark.django_db
def test_limit_applies_to_documents(settings, client, mocker):
    """load_documents prunes whatever it is given, so documents are limited too."""
    mock_load_documents = mocker.patch("webhooks.views.load_documents", return_value=[])
    LearningResourceFactory.create_batch(
        3,
        etl_source=ETLSource.mit_climate.name,
        resource_type=LearningResourceType.document.name,
    )

    response = _post(
        client,
        settings,
        _sync_only(
            ETLSource.mit_climate.name,
            resource_type=LearningResourceType.document.name,
        ),
    )

    assert response.status_code == 422
    assert "3 of 3 published mit_climate document" in response.json()["message"]
    mock_load_documents.assert_not_called()


@pytest.mark.django_db
@pytest.mark.skip_nplusone_check
def test_a_load_within_the_limit_unpublishes_what_the_limit_counted(
    settings, client, mocker
):
    """The real loader leaves the nine delivered published and prunes the tenth."""
    mocker.patch("webhooks.views.clear_views_cache")
    mocker.patch("learning_resources.etl.loaders.update_index")
    mocker.patch("learning_resources.etl.loaders.resource_unpublished_actions")
    courses = [
        course.learning_resource
        for course in CourseFactory.create_batch(
            10, learning_resource__etl_source=ETLSource.oll.name
        )
    ]
    rows = [
        _resource(
            course.readable_id,
            ETLSource.oll.name,
            LearningResourceType.course.name,
            platform=course.platform.code,
            published=True,
            runs=[{"run_id": f"run-{course.readable_id}", "published": True}],
            course={"course_numbers": []},
        )
        for course in courses[:9]
    ]

    response = _post(client, settings, {"resources": rows})

    assert response.status_code == 200
    published = LearningResource.objects.filter(
        etl_source=ETLSource.oll.name, published=True
    )
    assert set(published.values_list("readable_id", flat=True)) == {
        course.readable_id for course in courses[:9]
    }


@pytest.mark.django_db
def test_limit_keeps_documents_without_runs(settings, client, mocker):
    """Documents have no runs, so delivering one keeps it published."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_documents = mocker.patch("webhooks.views.load_documents", return_value=[])
    documents = LearningResourceFactory.create_batch(
        3,
        etl_source=ETLSource.mit_climate.name,
        resource_type=LearningResourceType.document.name,
    )

    response = _post(
        client,
        settings,
        {
            "resources": [
                _resource(
                    document.readable_id,
                    ETLSource.mit_climate.name,
                    LearningResourceType.document.name,
                )
                for document in documents
            ]
        },
    )

    assert response.status_code == 200
    mock_load_documents.assert_called_once()


@pytest.mark.django_db
def test_limit_does_not_apply_to_videos(settings, client, mocker):
    """load_videos prunes nothing, so a short video batch unpublishes nothing."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_videos = mocker.patch("webhooks.views.load_videos", return_value=[])
    LearningResourceFactory.create_batch(
        3,
        etl_source=ETLSource.youtube.name,
        resource_type=LearningResourceType.video.name,
    )

    response = _post(
        client,
        settings,
        {
            "resources": [
                _resource(
                    "video-1",
                    ETLSource.youtube.name,
                    LearningResourceType.video.name,
                )
            ]
        },
    )

    assert response.status_code == 200
    mock_load_videos.assert_called_once()


@pytest.mark.django_db
def test_ownership_is_checked_before_the_limit(settings, client, mocker):
    """An unowned pair answers 409, whatever the batch would unpublish."""
    ETLSourceOwnership.objects.filter(
        etl_source=ETLSource.oll.name,
        resource_type=LearningResourceType.course.name,
    ).update(owner=ETLSourceOwnership.Pipeline.LEGACY)
    readable_ids = _published_courses(10)

    response = _post(client, settings, {"resources": _course_rows(readable_ids[:1])})

    assert response.status_code == 409


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
