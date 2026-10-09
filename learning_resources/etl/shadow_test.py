"""Tests for learning_resources.etl.shadow"""

from copy import deepcopy
from decimal import Decimal

import pytest

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.etl import shadow
from learning_resources.etl.constants import (
    CourseLoaderConfig,
    ETLSource,
    ProgramLoaderConfig,
)
from learning_resources.etl.loaders import (
    load_courses,
    load_documents,
    load_podcasts,
    load_programs,
)
from learning_resources.etl.ownership import Pipeline, is_shadow_run, writing_as
from learning_resources.etl.shadow import NOT_OBSERVED, run_shadow
from learning_resources.factories import (
    ETLSourceOwnershipFactory,
    LearningResourceDepartmentFactory,
    LearningResourceOfferorFactory,
    LearningResourcePlatformFactory,
    LearningResourceTopicFactory,
)
from learning_resources.models import (
    ETLShadowRun,
    LearningResource,
    LearningResourceRun,
)

pytestmark = pytest.mark.django_db

COURSE = LearningResourceType.course.name
PROGRAM = LearningResourceType.program.name
DOCUMENT = LearningResourceType.document.name
PODCAST = LearningResourceType.podcast.name
EPISODE = LearningResourceType.podcast_episode.name
SOURCE = ETLSource.see.name
PRUNE = CourseLoaderConfig(prune=True)


@pytest.fixture(autouse=True)
def mock_blocklist(mocker):
    """No course is blocklisted"""
    return mocker.patch(
        "learning_resources.etl.loaders.load_course_blocklist", return_value=[]
    )


@pytest.fixture(autouse=True)
def mock_index(mocker):
    """Keep the loaders' index and embedding tasks out of the tests"""
    mocker.patch("learning_resources_search.plugins.tasks")
    return mocker.patch("learning_resources_search.plugins.chain")


@pytest.fixture
def catalog():
    """Create the platform, offeror, department and topics the batches name"""
    parent = LearningResourceTopicFactory.create(name="Science")
    LearningResourceTopicFactory.create(name="Physics", parent=parent)
    LearningResourceTopicFactory.create(name="History")
    LearningResourcePlatformFactory.create(code=PlatformType.see.name)
    LearningResourcePlatformFactory.create(code=PlatformType.podcast.name)
    LearningResourcePlatformFactory.create(code=PlatformType.climate.name)
    LearningResourceOfferorFactory.create(code="see", name="Sloan")
    LearningResourceDepartmentFactory.create(department_id="8")


def _run(run_id, **overrides):
    return {
        "run_id": run_id,
        "title": f"Run {run_id}",
        "published": True,
        "start_date": "2026-01-05T00:00:00Z",
        "prices": [{"amount": Decimal("100.00"), "currency": "USD"}],
        "instructors": [{"full_name": "Ada Lovelace"}, {"full_name": "Alan Turing"}],
        "image": {"url": f"https://img.example/{run_id}.jpg", "alt": run_id},
        **overrides,
    }


def _course(readable_id, **overrides):
    return {
        "readable_id": readable_id,
        "platform": PlatformType.see.name,
        "etl_source": SOURCE,
        "title": f"Course {readable_id}",
        "description": "About it",
        "url": f"https://see.example/{readable_id}",
        "published": True,
        "certification": True,
        "languages": ["en"],
        "topics": [{"name": "Physics"}, {"name": "No such topic"}],
        "offered_by": {"code": "see"},
        "image": {"url": f"https://img.example/{readable_id}.jpg", "alt": "alt"},
        "departments": ["8"],
        "content_tags": ["Lecture Notes"],
        "course": {"course_numbers": [{"value": readable_id, "primary": True}]},
        "runs": [_run(f"{readable_id}+r1"), _run(f"{readable_id}+r2")],
        **overrides,
    }


def _program(readable_id, courses, **overrides):
    program = {
        key: value
        for key, value in _course(readable_id).items()
        if key not in ("course", "content_tags")
    }
    return {
        **program,
        "courses": [
            {"readable_id": course, "platform": PlatformType.see.name}
            for course in courses
        ],
        **overrides,
    }


def _document(readable_id, **overrides):
    return {
        "readable_id": readable_id,
        "platform": PlatformType.climate.name,
        "etl_source": ETLSource.mit_climate.name,
        "resource_type": DOCUMENT,
        "title": f"Article {readable_id}",
        "description": "About it",
        "url": f"https://climate.example/{readable_id}",
        "published": True,
        "topics": [{"name": "History"}],
        "offered_by": {"code": "see"},
        "image": {"url": f"https://img.example/{readable_id}.jpg", "alt": "alt"},
        **overrides,
    }


def _episode(readable_id, **overrides):
    return {
        "readable_id": readable_id,
        "etl_source": ETLSource.podcast.name,
        "resource_type": EPISODE,
        "title": f"Episode {readable_id}",
        "url": f"https://pod.example/{readable_id}",
        "published": True,
        "topics": [{"name": "History"}],
        "offered_by": {"code": "see"},
        "image": {"url": "https://img.example/pod.jpg", "alt": "alt"},
        "podcast_episode": {
            "audio_url": f"https://pod.example/{readable_id}.mp3",
            "duration": "PT5M",
        },
        **overrides,
    }


def _podcast(readable_id, episodes, **overrides):
    return {
        "readable_id": readable_id,
        "etl_source": ETLSource.podcast.name,
        "resource_type": PODCAST,
        "title": f"Podcast {readable_id}",
        "url": f"https://pod.example/{readable_id}",
        "published": True,
        "topics": [{"name": "History"}],
        "offered_by": {"code": "see"},
        "image": {"url": "https://img.example/pod.jpg", "alt": "alt"},
        "podcast": {"rss_url": f"https://pod.example/{readable_id}.rss"},
        "episodes": [_episode(f"{readable_id}-{episode}") for episode in episodes],
        **overrides,
    }


def _load_courses(batch):
    return load_courses(SOURCE, deepcopy(batch), config=PRUNE)


def _load_programs(batch):
    return load_programs(
        SOURCE,
        deepcopy(batch),
        config=ProgramLoaderConfig(
            prune=True, courses=CourseLoaderConfig(fetch_only=True)
        ),
    )


def _load_documents(batch):
    return load_documents(ETLSource.mit_climate.name, deepcopy(batch))


def _load_podcasts(batch):
    return load_podcasts(deepcopy(batch), [podcast["readable_id"] for podcast in batch])


def _shadow(pairs, load):
    """Run ``load`` as the warehouse's shadow of ``pairs`` and return its reports"""
    for etl_source, resource_type in pairs:
        ETLSourceOwnershipFactory.create(
            etl_source=etl_source,
            resource_type=resource_type,
            shadow=Pipeline.WAREHOUSE,
        )
    with writing_as(Pipeline.WAREHOUSE):
        result, runs = run_shadow(pairs, load)
    assert result == []
    assert is_shadow_run() is False
    return {run.resource_type: run for run in runs}


def _state():
    """Everything a load could have touched, to check a shadow run touched nothing"""
    return (
        list(LearningResource.objects.order_by("id").values()),
        list(LearningResourceRun.objects.order_by("id").values()),
    )


def test_run_shadow_reports_the_load_and_writes_nothing(catalog, mock_index):
    """
    The batch is compared and not loaded: the catalog is as it was afterwards,
    the report says what a load would have changed, and no index task is sent.
    """
    _load_courses([_course("same"), _course("retitled"), _course("dropped")])
    mock_index.reset_mock()
    before = _state()
    batch = [_course("same"), _course("retitled", title="A new title"), _course("new")]

    run = _shadow([(SOURCE, COURSE)], lambda: _load_courses(batch))[COURSE]

    assert _state() == before
    mock_index.assert_not_called()
    assert ETLShadowRun.objects.get() == run
    assert (run.etl_source, run.pipeline, run.error) == (SOURCE, Pipeline.WAREHOUSE, "")
    assert run.counts == {
        "before": 3,
        "before_published": 3,
        "created": 1,
        "unpublished": 1,
        "republished": 0,
        "updated": 1,
        "unchanged": 1,
    }
    assert run.details["created"] == ["new"]
    assert run.details["unpublished"] == ["dropped"]
    assert run.details["updated"] == ["retitled"]
    assert run.details["changed"] == {
        "retitled": {"title": ["Course retitled", "A new title"]}
    }
    assert run.details["field_counts"] == {"title": 1}
    assert run.details["changed_truncated"] is False


@pytest.mark.parametrize(
    ("pairs", "load", "batch"),
    [
        ([(SOURCE, COURSE)], _load_courses, [_course("c1"), _course("c2")]),
        (
            [(ETLSource.mit_climate.name, DOCUMENT)],
            _load_documents,
            [_document("d1"), _document("d2")],
        ),
        (
            [(ETLSource.podcast.name, PODCAST), (ETLSource.podcast.name, EPISODE)],
            _load_podcasts,
            [_podcast("p1", ["e1", "e2"]), _podcast("p2", ["e1"])],
        ),
    ],
)
def test_a_shadow_of_what_was_just_loaded_reports_nothing(catalog, pairs, load, batch):
    """The comparison agrees with the loaders about a batch they have just loaded."""
    load(batch)

    runs = _shadow(pairs, lambda: load(batch))

    for run in runs.values():
        assert run.error == ""
        assert run.details["changed"] == {}
        assert run.counts["before"] > 0
        assert run.counts["unchanged"] == run.counts["before"]
        assert (
            run.counts["created"],
            run.counts["unpublished"],
            run.counts["republished"],
            run.counts["updated"],
        ) == (0, 0, 0, 0)


def test_a_shadow_of_loaded_programs_reports_nothing(catalog):
    """Programs compare clean too, with the courses they link to."""
    _load_courses([_course("c1"), _course("c2")])
    batch = [_program("p1", ["c1", "c2"]), _program("p2", ["c1"])]
    _load_programs(batch)

    run = _shadow([(SOURCE, PROGRAM)], lambda: _load_programs(batch))[PROGRAM]

    assert run.details["changed"] == {}
    assert run.counts["unchanged"] == run.counts["before"] == 2


def test_run_shadow_reports_runs_and_related_values(catalog):
    """Each kind of value the loaders set is compared as they would set it."""
    _load_courses([_course("c1")])
    batch = [
        _course(
            "c1",
            topics=[{"name": "History"}],
            offered_by=None,
            image=None,
            departments=[],
            content_tags=["Exams"],
            course={"course_numbers": []},
            runs=[
                _run(
                    "c1+r1",
                    title="Renamed",
                    start_date="2026-02-01T00:00:00Z",
                    prices=[{"amount": "250", "currency": "USD"}],
                    instructors=[{"first_name": "Grace", "last_name": "Hopper"}],
                ),
                _run("c1+r3"),
            ],
        )
    ]

    run = _shadow([(SOURCE, COURSE)], lambda: _load_courses(batch))[COURSE]

    assert run.details["changed"]["c1"] == {
        "topics": [["Physics", "Science"], ["History"]],
        "offered_by": ["see", None],
        "image": [
            {"url": "https://img.example/c1.jpg", "description": None, "alt": "alt"},
            None,
        ],
        "departments": [["8"], []],
        "content_tags": [["Lecture Notes"], ["Exams"]],
        "course.course_numbers": [[{"value": "c1", "primary": True}], []],
        "runs[c1+r1].title": ["Run c1+r1", "Renamed"],
        "runs[c1+r1].start_date": [
            "2026-01-05T00:00:00+00:00",
            "2026-02-01T00:00:00+00:00",
        ],
        "runs[c1+r1].instructors": [
            ["Ada Lovelace", "Alan Turing"],
            ["Grace Hopper"],
        ],
        "runs[c1+r1].prices": [["100"], ["250"]],
        "runs[c1+r1].resource_prices": [[["100", "USD"]], [["250", "USD"]]],
        "runs[c1+r2].published": [True, False],
        "runs[c1+r3]": [None, "new run"],
    }
    assert run.details["field_counts"]["runs[].title"] == 1
    assert run.counts["unchanged"] == 0


def test_run_shadow_reports_publish_changes_with_their_field_changes(catalog):
    """
    A resource that is unpublished or republished is listed as that, and its
    field changes are in ``changed`` with every other resource's.
    """
    _load_courses(
        [_course("hidden"), _course("no-runs"), _course("shown", published=False)]
    )
    batch = [
        _course("hidden", published=False, title="Hidden"),
        _course("no-runs", runs=[]),
        _course("shown", title="Shown"),
    ]

    run = _shadow([(SOURCE, COURSE)], lambda: _load_courses(batch))[COURSE]

    assert run.details["unpublished"] == ["hidden", "no-runs"]
    assert run.details["republished"] == ["shown"]
    assert run.details["updated"] == ["hidden", "no-runs", "shown"]
    assert run.details["changed"]["hidden"] == {"title": ["Course hidden", "Hidden"]}
    assert run.details["changed"]["shown"] == {"title": ["Course shown", "Shown"]}


def test_run_shadow_does_not_prune_for_a_load_that_would_not(catalog):
    """A load without prune, or with an empty batch it will not prune on, drops none."""
    _load_courses([_course("c1"), _course("c2")])

    def load():
        load_courses(SOURCE, [_course("c1")], config=CourseLoaderConfig(prune=False))
        return load_courses(SOURCE, [], config=PRUNE)

    run = _shadow([(SOURCE, COURSE)], load)[COURSE]

    assert run.counts["unpublished"] == 0
    assert run.counts["unchanged"] == 1


def test_run_shadow_reports_podcasts_as_load_podcasts_treats_them(catalog):
    """
    An empty feed unpublishes its podcast and episodes, a tracked podcast the
    batch leaves out keeps its data, and an untracked one is unpublished.
    """
    _load_podcasts(
        [
            _podcast("kept", ["e1", "e2"]),
            _podcast("empty", ["e1"]),
            _podcast("missing", ["e1"]),
            _podcast("untracked", ["e1"]),
        ]
    )
    batch = [_podcast("kept", ["e1"]), _podcast("empty", [])]
    source = ETLSource.podcast.name

    runs = _shadow(
        [(source, PODCAST), (source, EPISODE)],
        lambda: load_podcasts(deepcopy(batch), ["kept", "empty", "missing"]),
    )

    assert runs[PODCAST].details["unpublished"] == ["empty", "untracked"]
    assert runs[PODCAST].counts["unchanged"] == 1
    assert runs[EPISODE].details["unpublished"] == [
        "empty-e1",
        "kept-e2",
        "untracked-e1",
    ]
    assert runs[EPISODE].counts["unchanged"] == 1


def test_run_shadow_keeps_details_for_a_limited_number_of_resources(catalog, mocker):
    """Counts cover every changed resource, the field details only the first few."""
    mocker.patch.object(shadow, "MAX_CHANGED_DETAILS", 2)
    mocker.patch.object(shadow, "OBSERVE_CHUNK_SIZE", 2)
    ids = [f"c{index}" for index in range(5)]
    _load_courses([_course(readable_id) for readable_id in ids])
    batch = [_course(readable_id, title="New") for readable_id in ids]

    run = _shadow([(SOURCE, COURSE)], lambda: _load_courses(batch))[COURSE]

    assert run.counts["updated"] == 5
    assert run.details["updated"] == ids
    assert run.details["field_counts"] == {"title": 5}
    assert list(run.details["changed"]) == ["c0", "c1"]
    assert run.details["changed_truncated"] is True


def test_a_pair_no_loader_reported_for_is_saved_as_not_compared():
    """A load that never reaches a reporting loader is not read as a clean run."""
    with writing_as(Pipeline.WAREHOUSE):
        _, [run] = run_shadow([(SOURCE, COURSE)], lambda: None)

    assert run.error == NOT_OBSERVED
    assert run.counts == {}


def test_nothing_is_written_in_a_shadow_run_even_by_the_owner(catalog):
    """A type the pipeline owns is compared, not written, when loaded in a shadow run."""
    ETLSourceOwnershipFactory.create(
        etl_source=SOURCE, resource_type=COURSE, owner=Pipeline.WAREHOUSE
    )
    with writing_as(Pipeline.WAREHOUSE):
        _, [run] = run_shadow(
            [(SOURCE, COURSE)], lambda: _load_courses([_course("c1")])
        )

    assert run.details["created"] == ["c1"]
    assert not LearningResource.objects.exists()


def test_a_shadow_writes_nothing_outside_run_shadow(catalog):
    """The shadow pipeline calling a loader directly is refused like any non-owner."""
    ETLSourceOwnershipFactory.create(
        etl_source=SOURCE, resource_type=COURSE, shadow=Pipeline.WAREHOUSE
    )

    with writing_as(Pipeline.WAREHOUSE):
        loaded = _load_courses([_course("c1")])

    assert loaded == []
    assert not LearningResource.objects.exists()
    assert not ETLShadowRun.objects.exists()


def test_run_shadow_saves_a_failed_load_and_raises():
    """A load that raises is reported with its error and re-raised."""

    def load():
        msg = "no rows in the view"
        raise ValueError(msg)

    with writing_as(Pipeline.WEBHOOK), pytest.raises(ValueError, match="no rows"):
        run_shadow([(SOURCE, COURSE)], load)

    run = ETLShadowRun.objects.get()
    assert run.error == "ValueError: no rows in the view"
    assert run.pipeline == Pipeline.WEBHOOK
    assert run.counts == {}
    assert is_shadow_run() is False


def test_run_shadow_raises_the_load_error_when_the_report_cannot_be_saved(mocker):
    """A report that fails to save does not replace the error that caused it."""
    mocker.patch.object(shadow, "_save", side_effect=RuntimeError("database is down"))

    def load():
        msg = "no rows in the view"
        raise ValueError(msg)

    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ValueError, match="no rows"):
        run_shadow([(SOURCE, COURSE)], load)


def test_run_shadow_reports_each_pair_and_keeps_the_latest(mocker):
    """One report per (etl_source, resource_type), the oldest dropped past the limit."""
    mocker.patch.object(shadow, "SHADOW_RUNS_KEPT", 2)
    with writing_as(Pipeline.WAREHOUSE):
        for _ in range(3):
            _, runs = run_shadow([(SOURCE, [COURSE, PROGRAM])], lambda: None)

    assert [run.resource_type for run in runs] == [COURSE, PROGRAM]
    for resource_type in (COURSE, PROGRAM):
        kept = ETLShadowRun.objects.filter(resource_type=resource_type)
        assert kept.count() == 2
    assert set(runs) <= set(ETLShadowRun.objects.all())
