"""Tests for learning_resources.etl.shadow"""

import pytest

from learning_resources.constants import LearningResourceType
from learning_resources.etl import shadow
from learning_resources.etl.constants import CourseLoaderConfig, ETLSource
from learning_resources.etl.loaders import load_courses
from learning_resources.etl.ownership import Pipeline, is_shadow_run, writing_as
from learning_resources.etl.shadow import diff_snapshots, run_shadow
from learning_resources.factories import (
    CourseFactory,
    ETLSourceOwnershipFactory,
    LearningResourcePlatformFactory,
)
from learning_resources.models import ETLShadowRun, LearningResource

pytestmark = pytest.mark.django_db

COURSE = LearningResourceType.course.name
SOURCE = ETLSource.see.name


@pytest.fixture(autouse=True)
def mock_blocklist(mocker):
    """No course is blocklisted"""
    return mocker.patch(
        "learning_resources.etl.loaders.load_course_blocklist", return_value=[]
    )


@pytest.fixture
def index_chain(mocker):
    """Mock the chain of index tasks the search plugin builds for a resource"""
    mocker.patch("learning_resources_search.plugins.tasks")
    return mocker.patch("learning_resources_search.plugins.chain")


def _course_data(resource, **overrides):
    return {
        "readable_id": resource.readable_id,
        "platform": resource.platform.code,
        "etl_source": SOURCE,
        "title": resource.title,
        "description": resource.description,
        "url": resource.url,
        "published": True,
        "runs": [{"run_id": f"{resource.readable_id}+run", "published": True}],
        **overrides,
    }


def _courses(count):
    platform = LearningResourcePlatformFactory.create()
    return [
        course.learning_resource
        for course in CourseFactory.create_batch(
            count,
            etl_source=SOURCE,
            platform=platform.code,
            learning_resource__runs=[],
        )
    ]


def test_run_shadow_reports_the_load_and_writes_nothing(index_chain):
    """
    The loaders run for real, but the catalog is as it was afterwards, the
    report says what would have changed, and no index task is sent.
    """
    ETLSourceOwnershipFactory.create(
        etl_source=SOURCE, resource_type=COURSE, shadow=Pipeline.WAREHOUSE
    )
    unchanged, retitled, dropped = _courses(3)
    old_title = retitled.title
    batch = [
        _course_data(unchanged),
        _course_data(retitled, title="A new title"),
        _course_data(unchanged, readable_id="new-course", url="https://new.example"),
    ]

    with writing_as(Pipeline.WAREHOUSE):
        loaded, runs = run_shadow(
            [(SOURCE, [COURSE])],
            lambda: load_courses(SOURCE, batch, config=CourseLoaderConfig(prune=True)),
        )

    assert len(loaded) == len(batch)
    resources = LearningResource.objects.filter(etl_source=SOURCE)
    assert resources.count() == 3
    assert not resources.filter(readable_id="new-course").exists()
    retitled.refresh_from_db()
    dropped.refresh_from_db()
    assert retitled.title == old_title
    assert dropped.published is True

    [run] = runs
    assert ETLShadowRun.objects.get() == run
    assert (run.etl_source, run.resource_type, run.pipeline, run.error) == (
        SOURCE,
        COURSE,
        Pipeline.WAREHOUSE,
        "",
    )
    assert run.counts["before_published"] == 3
    assert run.counts["created"] == 1
    assert run.counts["unpublished"] == 1
    assert run.counts["updated"] >= 1
    assert run.details["created"] == ["new-course"]
    assert run.details["unpublished"] == [dropped.readable_id]
    assert run.details["changed"][retitled.readable_id]["title"] == [
        old_title,
        "A new title",
    ]
    assert run.details["field_counts"]["title"] == 1
    # the plugin built its chains and none was run or queued
    index_chain.assert_called()
    index_chain.return_value.assert_not_called()
    index_chain.return_value.delay.assert_not_called()
    assert is_shadow_run() is False


def test_a_shadow_writes_nothing_outside_run_shadow():
    """The shadow pipeline calling a loader directly is refused like any non-owner."""
    ETLSourceOwnershipFactory.create(
        etl_source=SOURCE, resource_type=COURSE, shadow=Pipeline.WAREHOUSE
    )
    [course] = _courses(1)

    old_title = course.title

    with writing_as(Pipeline.WAREHOUSE):
        loaded = load_courses(
            SOURCE,
            [_course_data(course, title="A new title")],
            config=CourseLoaderConfig(prune=True),
        )

    assert loaded == []
    course.refresh_from_db()
    assert course.title == old_title


def test_run_shadow_saves_a_failed_load_and_raises():
    """A load that raises is rolled back, reported with its error and re-raised."""
    [course] = _courses(1)

    def load():
        LearningResource.objects.filter(id=course.id).update(published=False)
        msg = "no rows in the view"
        raise ValueError(msg)

    with writing_as(Pipeline.WEBHOOK), pytest.raises(ValueError, match="no rows"):
        run_shadow([(SOURCE, COURSE)], load)

    course.refresh_from_db()
    assert course.published is True
    run = ETLShadowRun.objects.get()
    assert run.error == "ValueError: no rows in the view"
    assert run.pipeline == Pipeline.WEBHOOK
    assert run.counts == {}
    assert is_shadow_run() is False


def test_run_shadow_reports_each_pair_and_keeps_the_latest(mocker):
    """One report per (etl_source, resource_type), the oldest dropped past the limit."""
    mocker.patch.object(shadow, "SHADOW_RUNS_KEPT", 2)
    program = LearningResourceType.program.name
    with writing_as(Pipeline.WAREHOUSE):
        for _ in range(3):
            _, runs = run_shadow([(SOURCE, [COURSE, program])], lambda: None)

    assert [run.resource_type for run in runs] == [COURSE, program]
    for resource_type in (COURSE, program):
        kept = ETLShadowRun.objects.filter(resource_type=resource_type)
        assert kept.count() == 2
    assert set(runs) <= set(ETLShadowRun.objects.all())


def test_diff_snapshots():
    """Resources are classified once each, and a changed list item is named by its key."""
    before = {
        "same": {"published": True, "title": "a"},
        "gone": {"published": True, "title": "b"},
        "hidden": {"published": True, "title": "c"},
        "shown": {"published": False, "title": "d"},
        "priced": {"published": True, "runs[r1].prices": ["10.00"], "title": "e"},
    }
    after = {
        "same": {"published": True, "title": "a"},
        "hidden": {"published": False, "title": "c"},
        "shown": {"published": True, "title": "d"},
        "priced": {"published": True, "runs[r1].prices": ["12.00"], "title": "e"},
        "added": {"published": True, "title": "f"},
    }

    counts, details = diff_snapshots(before, after)

    assert counts == {
        "before": 5,
        "before_published": 4,
        "after_published": 4,
        "created": 1,
        "deleted": 1,
        "unpublished": 1,
        "republished": 1,
        "updated": 1,
        "unchanged": 1,
    }
    assert details["created"] == ["added"]
    assert details["deleted"] == ["gone"]
    assert details["unpublished"] == ["hidden"]
    assert details["republished"] == ["shown"]
    assert details["changed"] == {"priced": {"runs[r1].prices": [["10.00"], ["12.00"]]}}
    assert details["field_counts"] == {"runs[].prices": 1}
    assert details["changed_truncated"] is False


def test_flatten_names_list_items_and_drops_volatile_keys():
    """Rows that are deleted and recreated by a load compare equal."""
    data = {
        "id": 1,
        "title": "t",
        "runs": [{"id": 5, "run_id": "r1", "prices": ["1.00"]}],
        "topics": [{"id": 9, "name": "Math"}],
        "children": [{"id": 3, "child": 7}],
        "departments": [],
    }

    assert dict(shadow._flatten(data)) == {  # noqa: SLF001
        "title": "t",
        "runs[r1].run_id": "r1",
        "runs[r1].prices": ["1.00"],
        "topics[Math].name": "Math",
        "children[0].child": 7,
        "departments": [],
    }
