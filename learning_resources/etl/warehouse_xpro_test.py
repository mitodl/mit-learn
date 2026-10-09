"""Tests for the warehouse-pull xPRO loading"""

import json
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.etl import warehouse_xpro, xpro
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.exceptions import ExtractException
from learning_resources.etl.ownership import Pipeline, writing_as
from learning_resources.factories import (
    ETLSourceOwnershipFactory,
    LearningResourceFactory,
    LearningResourceOfferorFactory,
    LearningResourcePlatformFactory,
)
from learning_resources.models import LearningResource

pytestmark = pytest.mark.django_db

COURSE = LearningResourceType.course.name
PROGRAM = LearningResourceType.program.name


@pytest.fixture(autouse=True)
def platforms():
    """Create the platforms and offeror the loaders look up"""
    LearningResourceOfferorFactory.create(is_xpro=True)
    return [
        LearningResourcePlatformFactory.create(code=code)
        for code in xpro.XPRO_PLATFORM_TRANSFORM.values()
    ]


@pytest.fixture(autouse=True)
def mock_search(mocker):
    """Mock out the search index tasks, the topic lookup and the blocklist"""
    mocker.patch("learning_resources_search.plugins.get_similar_topics_qdrant")
    mocker.patch(
        "learning_resources.etl.loaders.load_course_blocklist", return_value=[]
    )
    return SimpleNamespace(
        upsert=mocker.patch("learning_resources_search.tasks.upsert_learning_resource"),
        deindex=mocker.patch("learning_resources_search.tasks.deindex_document"),
    )


@pytest.fixture
def warehouse_owns_xpro():
    """Name the warehouse as the owner of the xpro pairs"""
    for resource_type in (COURSE, PROGRAM):
        ETLSourceOwnershipFactory.create(
            etl_source=ETLSource.xpro.name,
            resource_type=resource_type,
            owner=Pipeline.WAREHOUSE,
        )


@pytest.fixture
def api_courses():
    """Load the xPRO courses API response the API ETL tests use"""
    return json.loads(Path("./test_json/xpro_courses.json").read_text())


@pytest.fixture
def api_programs():
    """Load the xPRO programs API response the API ETL tests use"""
    return json.loads(Path("./test_json/xpro_programs.json").read_text())


def _page_columns(api: dict) -> dict:
    """Columns a course row and a program row share, from an API object"""
    return {
        "readable_id": api["readable_id"],
        "title": api["title"],
        "etl_source": "xpro",
        "description": api["description"],
        "url": api["url"],
        "image_url": api["thumbnail_url"],
        "platform": api["platform"],
        # an array column arrives from StarRocks as JSON text
        "topics": json.dumps([topic["name"] for topic in api["topics"]]),
        "format": api.get("format"),
        "availability": api["availability"],
        "continuing_ed_credits": api["credits"],
        "duration": api.get("duration"),
        "min_weeks": api.get("min_weeks"),
        "max_weeks": api.get("max_weeks"),
        "time_commitment": api.get("time_commitment"),
        "min_weekly_hours": api.get("min_weekly_hours"),
        "max_weekly_hours": api.get("max_weekly_hours"),
    }


def course_row(api_course: dict) -> dict:
    """Build the integrations__learn__xpro_courses row of an API course"""
    return {
        **_page_columns(api_course),
        "published": any(run["current_price"] for run in api_course["courseruns"]),
    }


def run_rows(api_course: dict) -> list[dict]:
    """Build the integrations__learn__xpro_runs rows of an API course"""
    return [
        {
            "readable_id": api_course["readable_id"],
            "run_id": run["courseware_id"],
            "title": run["title"],
            "start_date": run["start_date"],
            "end_date": run["end_date"],
            "enrollment_start": run["enrollment_start"],
            "enrollment_end": run["enrollment_end"],
            "price": (
                Decimal(str(run["current_price"])) if run["current_price"] else None
            ),
            "instructors": (
                json.dumps([instructor["name"] for instructor in run["instructors"]])
                if run["instructors"]
                else None
            ),
            "published": bool(run["current_price"]),
        }
        for run in api_course["courseruns"]
    ]


def program_row(api_program: dict) -> dict:
    """Build the integrations__learn__xpro_programs row of an API program"""
    return {
        **_page_columns(api_program),
        "published": bool(api_program["current_price"]),
        "instructors": json.dumps(
            [instructor["name"] for instructor in api_program["instructors"]]
        ),
        "courses": ", ".join(
            course["readable_id"] for course in api_program["courses"]
        ),
        "price": (
            Decimal(str(api_program["current_price"]))
            if api_program["current_price"]
            else None
        ),
        "start_date": api_program["start_date"] or api_program["enrollment_start"],
        "end_date": api_program["end_date"],
        "enrollment_start": api_program["enrollment_start"],
    }


def test_transform_course_matches_the_api_etl(api_courses):
    """A course built from the views is the course the API ETL builds"""
    expected = xpro.transform_courses(api_courses)

    result = [
        warehouse_xpro.transform_course(course_row(course), run_rows(course))
        for course in api_courses
    ]

    assert result == expected


def test_transform_program_matches_the_api_etl(api_programs):
    """
    A program built from the view is the program the API ETL builds, apart from
    its courses, which the loader only looks up
    """
    expected = xpro.transform_programs(api_programs)
    course_platforms = {
        course["readable_id"]: xpro.XPRO_PLATFORM_TRANSFORM[course["platform"]]
        for program in api_programs
        for course in program["courses"]
    }

    result = [
        warehouse_xpro.transform_program(program_row(program), course_platforms)
        for program in api_programs
    ]

    assert len(result) == len(expected)
    for program, expected_program in zip(result, expected):
        expected_courses = expected_program.pop("courses")
        assert program.pop("courses") == [
            {
                "readable_id": course["readable_id"],
                "platform": course["platform"],
                "resource_type": COURSE,
            }
            for course in expected_courses
        ]
        assert program == expected_program


def test_transform_run_without_a_price_or_instructors():
    """A run whose product has no price is unpublished, with no prices"""
    course = {
        "format": "Online",
        "availability": "dated",
        "duration": None,
        "min_weeks": None,
        "max_weeks": None,
        "time_commitment": None,
        "min_weekly_hours": None,
        "max_weekly_hours": None,
    }
    run = {
        "run_id": "course-v1:xPRO+A+R1",
        "title": "A",
        "start_date": None,
        "end_date": None,
        "enrollment_start": "2026-01-02T03:04:05.000",
        "enrollment_end": None,
        "price": None,
        "instructors": None,
    }

    result = warehouse_xpro.transform_run(run, course)

    assert result["published"] is False
    assert result["prices"] == []
    assert result["instructors"] == []
    assert result["start_date"].isoformat() == "2026-01-02T03:04:05+00:00"
    assert result["duration"] == ""
    assert result["time_commitment"] == ""


def _own(resource_type):
    """Name the warehouse as the owner of one xpro pair"""
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.xpro.name,
        resource_type=resource_type,
        owner=Pipeline.WAREHOUSE,
    )


@pytest.mark.parametrize("owned", [None, PROGRAM])
def test_sync_courses_writes_nothing_without_the_course_pair(
    mocker, api_courses, owned
):
    """Owning nothing, or only the programs, does not let the courses load"""
    if owned:
        _own(owned)
    mock_load = mocker.patch(
        "learning_resources.etl.warehouse_xpro.loaders.load_courses"
    )

    with writing_as(Pipeline.WAREHOUSE):
        count = warehouse_xpro.sync_courses(
            [course_row(api_courses[0])], run_rows(api_courses[0])
        )

    assert count == 0
    mock_load.assert_not_called()


@pytest.mark.parametrize("owned", [None, COURSE])
def test_sync_programs_writes_nothing_without_the_program_pair(
    mocker, api_programs, owned
):
    """Owning nothing, or only the courses, does not let the programs load"""
    if owned:
        _own(owned)
    mock_load = mocker.patch(
        "learning_resources.etl.warehouse_xpro.loaders.load_programs"
    )

    with writing_as(Pipeline.WAREHOUSE):
        count = warehouse_xpro.sync_programs([program_row(api_programs[0])])

    assert count == 0
    mock_load.assert_not_called()


@pytest.mark.parametrize(
    ("column", "value", "expected"),
    [
        ("topics", ["Business:Strategy"], None),
        ("topics", b'["Business:Strategy"]', None),
        ("continuing_ed_credits", 1.25, 1.25),
        ("min_weeks", 3, 3),
        ("max_weekly_hours", 6, 6),
    ],
)
def test_transform_course_reads_warehouse_types(api_courses, column, value, expected):
    """Arrays arrive as lists, text or bytes, and numbers as numbers"""
    row = {**course_row(api_courses[0]), column: value}

    result = warehouse_xpro.transform_course(row, run_rows(api_courses[0]))

    if column == "topics":
        text_row = {**row, "topics": json.dumps(["Business:Strategy"])}
        assert (
            result["topics"]
            == warehouse_xpro.transform_course(text_row, run_rows(api_courses[0]))[
                "topics"
            ]
        )
    elif column == "continuing_ed_credits":
        assert result[column] == expected
    else:
        assert result["runs"][0][column] == expected


def test_transform_course_with_a_zero_price_or_no_runs(api_courses):
    """A course is unpublished when no run has a price above zero, or it has no runs"""
    row = course_row(api_courses[0])
    free = [{**run, "price": Decimal("0.00")} for run in run_rows(api_courses[0])]

    result = warehouse_xpro.transform_course(row, free)

    assert result["published"] is False
    assert all(run["published"] is False for run in result["runs"])
    assert all(run["prices"] == [] for run in result["runs"])
    assert warehouse_xpro.transform_course(row, [])["published"] is False


@pytest.mark.parametrize("courses", [None, "", "course-v1:xPRO+Unknown"])
def test_transform_program_without_known_courses(api_programs, courses):
    """A program with no courses, or one MIT Learn does not have, links none"""
    row = {**program_row(api_programs[0]), "courses": courses}

    assert warehouse_xpro.transform_program(row, {})["courses"] == []


def test_sync_courses_loads_and_unpublishes(warehouse_owns_xpro, api_courses):
    """Listed courses are loaded with their runs, and unlisted ones unpublished"""
    gone = LearningResourceFactory.create(
        etl_source=ETLSource.xpro.name,
        resource_type=COURSE,
        published=True,
        platform__code=PlatformType.xpro.name,
    )
    for course in api_courses:
        LearningResourceFactory.create(
            etl_source=ETLSource.xpro.name,
            resource_type=COURSE,
            published=True,
            readable_id=course["readable_id"],
            platform__code=xpro.XPRO_PLATFORM_TRANSFORM[course["platform"]],
        )
    with writing_as(Pipeline.WAREHOUSE):
        count = warehouse_xpro.sync_courses(
            [course_row(course) for course in api_courses],
            [run for course in api_courses for run in run_rows(course)],
            allow_mass_unpublish=True,
        )

    assert count == len(api_courses)
    gone.refresh_from_db()
    assert gone.published is False
    for course in api_courses:
        resource = LearningResource.objects.get(
            etl_source=ETLSource.xpro.name, readable_id=course["readable_id"]
        )
        priced_runs = [run for run in course["courseruns"] if run["current_price"]]
        assert resource.published is bool(priced_runs)
        assert resource.runs.filter(published=True).count() == len(priced_runs)
        for run in priced_runs:
            assert resource.runs.get(run_id=run["courseware_id"]).prices == [
                Decimal(str(run["current_price"]))
            ]


def test_sync_programs_loads_and_links_courses(warehouse_owns_xpro, api_programs):
    """A program is loaded with its price and linked to its published courses"""
    program_courses = [
        course for program in api_programs for course in program["courses"]
    ]
    for course in program_courses:
        LearningResourceFactory.create(
            etl_source=ETLSource.xpro.name,
            resource_type=COURSE,
            published=True,
            readable_id=course["readable_id"],
            platform__code=xpro.XPRO_PLATFORM_TRANSFORM[course["platform"]],
        )

    with writing_as(Pipeline.WAREHOUSE):
        count = warehouse_xpro.sync_programs(
            [program_row(program) for program in api_programs]
        )

    assert count == len(api_programs)
    for program in api_programs:
        resource = LearningResource.objects.get(
            etl_source=ETLSource.xpro.name,
            resource_type=PROGRAM,
            readable_id=program["readable_id"],
        )
        assert resource.published is bool(program["current_price"])
        assert sorted(
            resource.children.values_list("child__readable_id", flat=True)
        ) == sorted(course["readable_id"] for course in program["courses"])


@pytest.mark.parametrize(
    ("courses", "runs"), [([], [{"readable_id": "a"}]), ([{"readable_id": "a"}], [])]
)
def test_sync_courses_refuses_an_empty_view(warehouse_owns_xpro, courses, runs):
    """An empty view is a failed build, not an empty catalog"""
    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_xpro.sync_courses(courses, runs)


def test_sync_courses_refuses_to_unpublish_more_than_the_limit(
    warehouse_owns_xpro, api_courses
):
    """A sync that would unpublish most of the published courses fails unwritten"""
    published = LearningResourceFactory.create_batch(
        5,
        etl_source=ETLSource.xpro.name,
        resource_type=COURSE,
        published=True,
        platform__code=PlatformType.xpro.name,
    )

    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_xpro.sync_courses(
            [course_row(api_courses[0])], run_rows(api_courses[0])
        )

    for resource in published:
        resource.refresh_from_db()
        assert resource.published is True


def test_sync_courses_counts_only_published_courses_as_pulled(
    warehouse_owns_xpro, api_courses
):
    """Courses the view lists without a priced run count as unpublished by the sync"""
    for course in api_courses:
        LearningResourceFactory.create(
            etl_source=ETLSource.xpro.name,
            resource_type=COURSE,
            published=True,
            readable_id=course["readable_id"],
            platform__code=xpro.XPRO_PLATFORM_TRANSFORM[course["platform"]],
        )

    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_xpro.sync_courses(
            [course_row(course) for course in api_courses],
            [
                {**run, "price": None}
                for course in api_courses
                for run in run_rows(course)
            ],
        )

    assert LearningResource.objects.filter(
        etl_source=ETLSource.xpro.name, published=True
    ).count() == len(api_courses)


def test_sync_programs_refuses_an_empty_view(warehouse_owns_xpro):
    """An empty programs view is a failed build, not an empty catalog"""
    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_xpro.sync_programs([])


def test_sync_programs_refuses_to_unpublish_more_than_the_limit(
    warehouse_owns_xpro, api_programs
):
    """A sync that would unpublish most of the published programs fails unwritten"""
    published = LearningResourceFactory.create_batch(
        5,
        etl_source=ETLSource.xpro.name,
        resource_type=PROGRAM,
        published=True,
        platform__code=PlatformType.xpro.name,
    )

    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_xpro.sync_programs([program_row(api_programs[0])])

    for resource in published:
        resource.refresh_from_db()
        assert resource.published is True
