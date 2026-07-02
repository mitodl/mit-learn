"""Tests for learning_resources.etl.catalog_sources transform functions."""

import pytest

from learning_resources.constants import LearningResourceType, OfferedBy, PlatformType
from learning_resources.etl import catalog_sources
from learning_resources.etl.constants import ETLSource

pytestmark = pytest.mark.django_db


def test_split_defaults_and_strips():
    """_split returns [] for empty input and strips/filters delimited parts."""
    assert catalog_sources._split(None) == []  # noqa: SLF001
    assert catalog_sources._split("") == []  # noqa: SLF001
    assert catalog_sources._split("a, b,  c ") == ["a", "b", "c"]  # noqa: SLF001
    assert catalog_sources._split("a;b", sep=";") == ["a", "b"]  # noqa: SLF001


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (True, True),
        (False, False),
        ("true", True),
        ("True", True),
        ("false", False),
        ("", False),
        (None, False),
    ],
)
def test_parse_bool(value, expected):
    """_parse_bool handles native bools and textual 'true'/'false' alike."""
    assert catalog_sources._parse_bool(value) is expected  # noqa: SLF001


def test_parse_datetime_valid_and_invalid():
    """_parse_datetime parses ISO strings and returns None for bad input."""
    assert catalog_sources._parse_datetime("2026-01-01T00:00:00").year == 2026  # noqa: SLF001
    assert catalog_sources._parse_datetime("") is None  # noqa: SLF001
    assert catalog_sources._parse_datetime(None) is None  # noqa: SLF001
    assert catalog_sources._parse_datetime("not-a-date") is None  # noqa: SLF001


def test_parse_runs_splits_and_parses_pipe_delimited_string():
    """_parse_runs splits ';'-joined 'id|start|end|is_live' run strings."""
    runs = catalog_sources._parse_runs(  # noqa: SLF001
        "run-1|2026-01-01|2026-06-01|true;run-2|2026-07-01||false",
        "Course Title",
        instructors=[{"full_name": "Jane Doe"}],
    )
    assert len(runs) == 2
    assert runs[0]["run_id"] == "run-1"
    assert runs[0]["title"] == "Course Title"
    assert runs[0]["published"] is True
    assert runs[0]["start_date"].year == 2026
    assert runs[0]["end_date"].year == 2026
    assert runs[0]["instructors"] == [{"full_name": "Jane Doe"}]
    assert runs[1]["run_id"] == "run-2"
    assert runs[1]["published"] is False
    assert runs[1]["end_date"] is None


def test_parse_runs_skips_malformed_chunks():
    """_parse_runs drops chunks that don't have exactly 4 pipe-delimited fields."""
    runs = catalog_sources._parse_runs(  # noqa: SLF001
        "missing-fields|only-two", "T", instructors=[]
    )
    assert runs == []


def test_parse_runs_empty_value():
    """_parse_runs returns [] for a missing/empty runs column."""
    assert catalog_sources._parse_runs(None, "T", instructors=[]) == []  # noqa: SLF001


MITXONLINE_COURSE_ROW = {
    "readable_id": "course-v1:MITxT+1.1x",
    "title": "Intro to Testing",
    "last_modified": "2026-01-01T00:00:00",
    "etl_source": "mitxonline",
    "description": "A course about testing",
    "url": "/courses/intro-to-testing",
    "image_url": "https://example.com/image.jpg",
    "published": True,
    "platform": "mitxonline",
    "page_slug": "intro-to-testing",
    "topics": "Testing, Quality",
    "instructors": "Jane Doe, John Smith",
    "certification_type": "professional",
    "price": "49.00",
    "length": "6 weeks",
    "effort": "5-10 hours/week",
    "runs": "course-v1:MITxT+1.1x+R1|2026-01-01|2026-06-01|true",
}


def test_transform_mitxonline_course():
    """transform_mitxonline_course maps a view row to the loader course shape."""
    result = catalog_sources.transform_mitxonline_course(MITXONLINE_COURSE_ROW)

    assert result["readable_id"] == MITXONLINE_COURSE_ROW["readable_id"]
    assert result["platform"] == PlatformType.mitxonline.name
    assert result["etl_source"] == ETLSource.mitxonline.name
    assert result["resource_type"] == LearningResourceType.course.name
    assert result["title"] == "Intro to Testing"
    assert result["offered_by"] == {"code": OfferedBy.mitx.name}
    assert result["published"] is True
    assert result["image"] == {"url": "https://example.com/image.jpg"}
    assert len(result["runs"]) == 1
    assert result["runs"][0]["run_id"] == "course-v1:MITxT+1.1x+R1"
    assert result["course"]["course_numbers"]


MITXONLINE_PROGRAM_ROW = {
    "readable_id": "program-v1:MITxT+PP",
    "title": "Professional Program",
    "etl_source": "mitxonline",
    "description": "A program",
    "url": "/programs/professional-program",
    "image_url": "https://example.com/program.jpg",
    "published": True,
    "topics": "Testing",
    "courses": "course-v1:MITxT+1.1x, course-v1:MITxT+1.2x",
}


def test_transform_mitxonline_program():
    """transform_mitxonline_program builds fetch_only course stubs and a single run."""
    result = catalog_sources.transform_mitxonline_program(MITXONLINE_PROGRAM_ROW)

    assert result["resource_type"] == LearningResourceType.program.name
    assert result["courses"] == [
        {"readable_id": "course-v1:MITxT+1.1x", "platform": PlatformType.mitxonline.name},
        {"readable_id": "course-v1:MITxT+1.2x", "platform": PlatformType.mitxonline.name},
    ]
    assert len(result["runs"]) == 1
    assert result["runs"][0]["run_id"] == MITXONLINE_PROGRAM_ROW["readable_id"]


@pytest.mark.parametrize(
    ("platform_name", "expected"),
    [
        ("xPRO", PlatformType.xpro.name),
        ("Emeritus", PlatformType.emeritus.name),
        ("Unknown Platform", PlatformType.xpro.name),
        (None, PlatformType.xpro.name),
    ],
)
def test_transform_xpro_course_platform_mapping(platform_name, expected):
    """transform_xpro_course maps the view's display name via XPRO_PLATFORM_TRANSFORM."""
    row = {
        "readable_id": "course-v1:xPRO+1x",
        "title": "xPRO Course",
        "platform": platform_name,
        "published": True,
        "topics": "",
        "instructors": "",
        "runs": "",
    }
    result = catalog_sources.transform_xpro_course(row)
    assert result["platform"] == expected
    assert result["etl_source"] == ETLSource.xpro.name


def test_transform_xpro_program_courses_use_resolved_platform():
    """transform_xpro_program's course stubs use the program's resolved platform."""
    row = {
        "readable_id": "program-v1:xPRO+PP",
        "title": "xPRO Program",
        "platform": "Emeritus",
        "published": True,
        "topics": "",
        "courses": "course-v1:xPRO+1x",
    }
    result = catalog_sources.transform_xpro_program(row)
    assert result["courses"] == [
        {"readable_id": "course-v1:xPRO+1x", "platform": PlatformType.emeritus.name}
    ]


def test_transform_mit_edx_course_uses_platform_edx_not_view_value():
    """transform_mit_edx_course uses PlatformType.edx, not the view's raw 'edxorg' value."""
    row = {
        "readable_id": "MITx/6.00.1x",
        "title": "MIT edX Course",
        "platform": "edxorg",  # not a valid PlatformType member
        "published": True,
        "topics": "CS, Programming",
        "instructors": "Ada Lovelace",
        "runs": "MITx/6.00.1x/run|2026-01-01|2026-06-01|true",
    }
    result = catalog_sources.transform_mit_edx_course(row)
    assert result["platform"] == PlatformType.edx.name
    assert result["etl_source"] == ETLSource.mit_edx.name
    assert result["runs"][0]["instructors"] == [{"full_name": "Ada Lovelace"}]


def test_transform_ocw_course_single_synthetic_run_and_departments():
    """transform_ocw_course builds one synthetic run and resolves department names to ids."""
    row = {
        "readable_id": "6-00-1x-fall-2025",
        "title": "OCW Course",
        "description": "desc",
        "url": "https://ocw.mit.edu/6-00-1x",
        "image_url": "https://ocw.mit.edu/image.jpg",
        "published": True,
        "level": "Undergraduate",
        "term": "Fall",
        "year": "2025",
        "course_number": "6.00.1x",
        "extra_course_numbers": "6.01,6.02",
        "topics": "Programming, Algorithms",
        "instructors": "Grace Hopper",
        "departments": "Mathematics, Physics",
    }
    result = catalog_sources.transform_ocw_course(row)

    assert result["platform"] == PlatformType.ocw.name
    assert result["etl_source"] == ETLSource.ocw.name
    assert result["departments"] == ["18", "8"]
    assert len(result["runs"]) == 1
    run = result["runs"][0]
    assert run["run_id"] == row["readable_id"]
    assert run["semester"] == "Fall"
    assert run["year"] == "2025"
    assert run["instructors"] == [{"full_name": "Grace Hopper"}]
    assert result["course"]["course_numbers"]


def test_transform_ocw_course_unknown_department_is_dropped():
    """transform_ocw_course silently drops department names with no known id."""
    row = {
        "readable_id": "6-00-1x-fall-2025",
        "title": "OCW Course",
        "published": True,
        "departments": "Not A Real Department",
    }
    result = catalog_sources.transform_ocw_course(row)
    assert result["departments"] == []


def test_transform_micromasters_program_uses_edx_platform_for_courses():
    """transform_micromasters_program's child courses resolve on PlatformType.edx."""
    row = {
        "readable_id": "1",
        "title": "MicroMasters Program",
        "published": True,
        "url": "https://micromasters.mit.edu/1",
        "courses": "MITx/1.1x, MITx/1.2x",
    }
    result = catalog_sources.transform_micromasters_program(row)

    assert result["platform"] == PlatformType.edx.name
    assert result["etl_source"] == ETLSource.micromasters.name
    assert result["courses"] == [
        {"readable_id": "MITx/1.1x", "platform": PlatformType.edx.name},
        {"readable_id": "MITx/1.2x", "platform": PlatformType.edx.name},
    ]
