"""Tests for MITx Online ETL functions"""

import json

# pylint: disable=redefined-outer-name
from datetime import UTC, datetime
from unittest.mock import ANY
from urllib.parse import parse_qs, urljoin, urlparse

import pytest

from learning_resources.constants import (
    CURRENCY_USD,
    CertificationType,
    Format,
    LearningResourceType,
    Pace,
    PlatformType,
    RunStatus,
)
from learning_resources.etl.constants import CourseNumberType, ETLSource
from learning_resources.etl.mitxonline import (
    OFFERED_BY,
    _fetch_courses_by_ids,
    _fetch_data,
    _parse_datetime,
    _transform_image,
    _transform_run,
    extract_courses,
    extract_programs,
    get_course_ids_from_req_tree,
    get_program_ids_from_req_tree,
    is_fully_enrollable,
    parse_certificate_type,
    parse_page_attribute,
    parse_prices,
    transform_courses,
    transform_programs,
    transform_topics,
)
from learning_resources.etl.utils import (
    get_department_id_by_name,
    parse_certification,
    parse_string_to_int,
    strip_enrollment_modes,
)
from learning_resources.test_utils import set_up_topics
from main.test_utils import any_instance_of
from main.utils import clean_data

pytestmark = pytest.mark.django_db


@pytest.fixture
def mock_mitxonline_programs_data():
    """Mock mitxonline data"""
    with open("./test_json/mitxonline_programs.json") as f:  # noqa: PTH123
        return json.loads(f.read())


@pytest.fixture
def mock_mitxonline_courses_data():
    """Mock mitxonline data"""
    with open("./test_json/mitxonline_courses.json") as f:  # noqa: PTH123
        return json.loads(f.read())


@pytest.fixture
def mocked_mitxonline_programs_responses(
    mocked_responses, settings, mock_mitxonline_programs_data
):
    """Mock the programs api response"""
    settings.MITX_ONLINE_PROGRAMS_API_URL = "http://localhost/test/programs/api"
    mocked_responses.add(
        mocked_responses.GET,
        settings.MITX_ONLINE_PROGRAMS_API_URL,
        json=mock_mitxonline_programs_data,
    )
    return mocked_responses


@pytest.fixture
def mocked_mitxonline_courses_responses(
    mocked_responses, settings, mock_mitxonline_courses_data
):
    """Mock the courses api response"""
    settings.MITX_ONLINE_COURSES_API_URL = "http://localhost/test/courses/api"
    mocked_responses.add(
        mocked_responses.GET,
        settings.MITX_ONLINE_COURSES_API_URL,
        json=mock_mitxonline_courses_data,
    )
    return mocked_responses


@pytest.mark.usefixtures("mocked_mitxonline_programs_responses")
def test_mitxonline_extract_programs(mock_mitxonline_programs_data):
    """Verify that the extraction function calls the mitxonline programs API and returns the responses"""
    assert extract_programs() == mock_mitxonline_programs_data["results"]


def test_mitxonline_extract_programs_disabled(settings):
    """Verify an empty list is returned if the API URL isn't set"""
    settings.MITX_ONLINE_PROGRAMS_API_URL = None
    assert extract_programs() == []


@pytest.mark.usefixtures("mocked_mitxonline_courses_responses")
def test_mitxonline_extract_courses(mock_mitxonline_courses_data):
    """Verify that the extraction function calls the mitxonline courses API and returns the responses"""
    assert extract_courses() == mock_mitxonline_courses_data["results"]


def test_mitxonline_extract_courses_disabled(settings):
    """Verify an empty list is returned if the API URL isn't set"""
    settings.MITX_ONLINE_COURSES_API_URL = None
    assert extract_courses() == []


@pytest.mark.parametrize(
    ("req_tree", "expected_ids"),
    [
        ([], []),
        (
            [
                {
                    "data": {"node_type": "program_root", "course": None},
                    "id": 1,
                    "children": [
                        {
                            "data": {
                                "node_type": "operator",
                                "operator": "all_of",
                                "course": None,
                                "elective_flag": False,
                            },
                            "id": 2,
                            "children": [
                                {
                                    "data": {"node_type": "course", "course": 10},
                                    "id": 3,
                                },
                                {
                                    "data": {"node_type": "course", "course": 20},
                                    "id": 4,
                                },
                            ],
                        }
                    ],
                }
            ],
            [10, 20],
        ),
        (
            [
                {
                    "data": {"node_type": "program_root", "course": None},
                    "id": 1,
                    "children": [
                        {
                            "data": {
                                "node_type": "operator",
                                "operator": "all_of",
                                "course": None,
                                "elective_flag": False,
                                "title": "Required Courses",
                            },
                            "id": 2,
                            "children": [
                                {
                                    "data": {"node_type": "course", "course": 10},
                                    "id": 3,
                                },
                            ],
                        },
                        {
                            "data": {
                                "node_type": "operator",
                                "operator": "min_number_of",
                                "operator_value": "2",
                                "course": None,
                                "elective_flag": True,
                                "title": "Elective Courses",
                            },
                            "id": 4,
                            "children": [
                                {
                                    "data": {"node_type": "course", "course": 30},
                                    "id": 5,
                                },
                                {
                                    "data": {"node_type": "course", "course": 40},
                                    "id": 6,
                                },
                                {
                                    "data": {"node_type": "course", "course": 50},
                                    "id": 7,
                                },
                            ],
                        },
                    ],
                }
            ],
            [10, 30, 40, 50],
        ),
    ],
    ids=["empty_tree", "required_only", "required_and_electives"],
)
def test_get_course_ids_from_req_tree(req_tree, expected_ids):
    """Test that course IDs are correctly extracted from a req_tree"""
    assert get_course_ids_from_req_tree(req_tree) == expected_ids


def test_get_course_ids_from_req_tree_with_required_program():
    """Test that required_program nodes are resolved via programs_by_id"""
    programs_by_id = {
        99: {
            "id": 99,
            "req_tree": [
                {
                    "data": {"node_type": "operator", "operator": "all_of"},
                    "id": 200,
                    "children": [
                        {"data": {"node_type": "course", "course": 70}, "id": 201},
                        {"data": {"node_type": "course", "course": 80}, "id": 202},
                    ],
                }
            ],
        }
    }
    req_tree = [
        {
            "data": {"node_type": "operator", "operator": "all_of"},
            "id": 1,
            "children": [
                {"data": {"node_type": "course", "course": 10}, "id": 2},
                {
                    "data": {
                        "node_type": "program",
                        "required_program": 99,
                        "course": None,
                    },
                    "id": 3,
                },
            ],
        }
    ]
    assert get_course_ids_from_req_tree(req_tree, programs_by_id) == [10, 70, 80]


def test_get_course_ids_from_req_tree_missing_program():
    """Test that missing required_program references are gracefully skipped"""
    req_tree = [
        {
            "data": {
                "node_type": "program",
                "required_program": 999,
                "course": None,
            },
            "id": 1,
        }
    ]
    assert get_course_ids_from_req_tree(req_tree, programs_by_id={}) == []


def test_get_course_ids_from_req_tree_circular_reference():
    """Test that circular program references don't cause infinite recursion"""
    programs_by_id = {
        1: {
            "id": 1,
            "req_tree": [
                {
                    "data": {
                        "node_type": "program",
                        "required_program": 2,
                    },
                    "id": 10,
                    "children": [],
                },
                {"data": {"node_type": "course", "course": 100}, "id": 11},
            ],
        },
        2: {
            "id": 2,
            "req_tree": [
                {
                    "data": {
                        "node_type": "program",
                        "required_program": 1,
                    },
                    "id": 20,
                    "children": [],
                },
                {"data": {"node_type": "course", "course": 200}, "id": 21},
            ],
        },
    }
    # Starting from program 1's req_tree
    result = get_course_ids_from_req_tree(programs_by_id[1]["req_tree"], programs_by_id)
    # Should get course 200 (from program 2) and course 100 (from program 1)
    # but NOT recurse infinitely back into program 1 from program 2
    assert set(result) == {100, 200}


def test_get_course_ids_from_req_tree_deduplicates():
    """Test that duplicate course IDs are deduplicated"""
    req_tree = [
        {
            "data": {"node_type": "operator", "operator": "all_of"},
            "id": 1,
            "children": [
                {"data": {"node_type": "course", "course": 10}, "id": 2},
                {"data": {"node_type": "course", "course": 10}, "id": 3},
                {"data": {"node_type": "course", "course": 20}, "id": 4},
            ],
        }
    ]
    assert get_course_ids_from_req_tree(req_tree) == [10, 20]


@pytest.mark.parametrize(
    ("req_tree", "expected_ids"),
    [
        ([], []),
        (
            [
                {
                    "data": {"node_type": "operator", "operator": "all_of"},
                    "id": 1,
                    "children": [
                        {"data": {"node_type": "course", "course": 10}, "id": 2},
                        {
                            "data": {
                                "node_type": "program",
                                "required_program": 99,
                            },
                            "id": 3,
                        },
                        {
                            "data": {
                                "node_type": "program",
                                "required_program": 100,
                            },
                            "id": 4,
                        },
                    ],
                }
            ],
            [99, 100],
        ),
    ],
    ids=["empty_tree", "programs_in_tree"],
)
def test_get_program_ids_from_req_tree(req_tree, expected_ids):
    """Test that program IDs are correctly extracted from a req_tree"""
    assert get_program_ids_from_req_tree(req_tree) == expected_ids


def test_transform_programs_logs_warning_for_missing_child_program(mocker, settings):
    """transform_programs should warn when req_tree references unknown program ids."""
    set_up_topics(is_mitx=True)
    settings.MITX_ONLINE_BASE_URL = "https://mitxonline.mit.edu"

    programs = [
        {
            "id": 1,
            "readable_id": "parent-program",
            "title": "Parent Program",
            "availability": "anytime",
            "enrollment_modes": [],
            "req_tree": [
                {
                    "id": 10,
                    "data": {
                        "node_type": "program",
                        "required_program": 999,
                    },
                    "children": [],
                }
            ],
            "page": {
                "page_url": "/programs/parent-program",
                "live": True,
                "description": "Parent program description",
            },
            "topics": [],
            "departments": [],
            "certificate_type": None,
        }
    ]

    mocker.patch(
        "learning_resources.etl.mitxonline._fetch_courses_by_ids", return_value=[]
    )
    mock_log_warning = mocker.patch("learning_resources.etl.mitxonline.log.warning")

    transformed = list(transform_programs(programs))

    assert len(transformed) == 1
    assert transformed[0]["child_programs"] == []
    mock_log_warning.assert_called_once_with(
        "Program %s references missing child program id=%s in req_tree",
        "parent-program",
        999,
    )


def test_mitxonline_transform_programs(
    mock_mitxonline_programs_data, mock_mitxonline_courses_data, mocker, settings
):
    """Test that mitxonline program data is correctly transformed into our normalized structure"""
    set_up_topics(is_mitx=True)

    # Mock now_in_utc to return a date before the test data's end dates
    mock_now = datetime(2023, 1, 1, tzinfo=UTC)
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=mock_now)

    settings.MITX_ONLINE_PROGRAMS_API_URL = "http://localhost/test/programs/api"
    settings.MITX_ONLINE_COURSES_API_URL = "http://localhost/test/courses/api"
    mocker.patch(
        "learning_resources.etl.mitxonline._fetch_data",
        return_value=mock_mitxonline_courses_data["results"],
    )

    result = transform_programs(mock_mitxonline_programs_data["results"])
    expected = []
    for program_data in mock_mitxonline_programs_data["results"]:
        expected_courses = []
        for course_data in sorted(
            mock_mitxonline_courses_data["results"],
            key=lambda x: x["readable_id"],
        ):
            if "PROCTORED EXAM" in course_data["title"]:
                continue
            runs = [
                _transform_run(course_run, course_data)
                for course_run in course_data["courseruns"]
            ]
            has_certification = parse_certification(OFFERED_BY["code"], runs)
            strip_enrollment_modes(runs)
            expected_courses.append(
                {
                    "readable_id": course_data["readable_id"],
                    "offered_by": OFFERED_BY,
                    "platform": PlatformType.mitxonline.name,
                    "resource_type": LearningResourceType.course.name,
                    "professional": False,
                    "etl_source": ETLSource.mitxonline.value,
                    "force_ingest": course_data.get(
                        "ingest_content_files_for_ai", False
                    ),
                    "departments": [
                        get_department_id_by_name(course_data["departments"][0]["name"])
                    ],
                    "title": course_data["title"],
                    "image": _transform_image(course_data),
                    "description": clean_data(
                        course_data.get("page", {}).get("description", None)
                    ),
                    "published": bool(
                        course_data.get("page", {}).get("page_url", None)
                        and course_data.get("page", {}).get("live", None)
                        and len(
                            [
                                run
                                for run in course_data["courseruns"]
                                if run["is_enrollable"]
                            ]
                        )
                        > 0
                        and course_data.get("include_in_learn_catalog", False)
                    ),
                    "certification": has_certification,
                    "certification_type": parse_certificate_type(
                        course_data["certificate_type"]
                    )
                    if has_certification
                    else CertificationType.none.name,
                    "url": parse_page_attribute(course_data, "page_url", is_url=True),
                    "availability": course_data["availability"],
                    "format": [Format.asynchronous.name],
                    "pace": [Pace.instructor_paced.name],
                    "topics": transform_topics(
                        course_data["topics"], OFFERED_BY["code"]
                    ),
                    "runs": runs,
                    "course": {
                        "course_numbers": [
                            {
                                "value": course_data["readable_id"],
                                "department": ANY,
                                "listing_type": CourseNumberType.primary.value,
                                "primary": True,
                                "sort_coursenum": course_data["readable_id"],
                            }
                        ]
                    },
                }
            )
        expected.append(
            {
                "readable_id": program_data["readable_id"],
                "title": program_data["title"],
                "offered_by": OFFERED_BY,
                "etl_source": ETLSource.mitxonline.name,
                "platform": PlatformType.mitxonline.name,
                "resource_type": LearningResourceType.program.name,
                "resource_category": LearningResourceType.course.value
                if program_data.get("display_mode") == "course"
                else LearningResourceType.program.value,
                "departments": [
                    get_department_id_by_name(program_data["departments"][0]["name"])
                ]
                if program_data["departments"]
                else [],
                "professional": False,
                "certification": program_data.get("certificate_type") is not None,
                "certification_type": parse_certificate_type(
                    program_data["certificate_type"]
                ),
                "image": _transform_image(program_data),
                "description": clean_data(
                    program_data.get("page", {}).get("description", None)
                ),
                "published": bool(
                    program_data.get("page", {}).get("page_url", None) is not None
                    and program_data.get("page", {}).get("live", None)
                ),
                "url": parse_page_attribute(program_data, "page_url", is_url=True),
                "availability": program_data["availability"],
                "topics": transform_topics(program_data["topics"], OFFERED_BY["code"]),
                "format": [Format.asynchronous.name],
                "pace": [Pace.instructor_paced.name],
                "runs": [
                    {
                        "run_id": program_data["readable_id"],
                        "start_date": any_instance_of(datetime, type(None)),
                        "end_date": any_instance_of(datetime, type(None)),
                        "enrollment_start": any_instance_of(datetime, type(None)),
                        "enrollment_end": any_instance_of(datetime, type(None)),
                        "published": bool(
                            program_data.get("page", {}).get("page_url", None)
                            is not None
                        ),
                        "prices": parse_prices(
                            program_data,
                            program_data.get("enrollment_modes", []),
                            fully_enrollable=True,
                        ),
                        "image": _transform_image(program_data),
                        "title": program_data["title"],
                        "description": clean_data(
                            program_data.get("page", {}).get("description", None)
                        ),
                        "url": parse_page_attribute(
                            program_data, "page_url", is_url=True
                        ),
                        "status": RunStatus.current.value
                        if parse_page_attribute(program_data, "page_url")
                        else RunStatus.archived.value,
                        "availability": program_data["availability"],
                        "format": [Format.asynchronous.name],
                        "pace": [Pace.instructor_paced.name],
                        "duration": program_data.get("duration") or "",
                        "time_commitment": program_data.get("time_commitment") or "",
                        "min_weeks": program_data.get("min_weeks"),
                        "max_weeks": program_data.get("max_weeks"),
                        "min_weekly_hours": parse_string_to_int(
                            program_data.get("min_weekly_hours")
                        ),
                        "max_weekly_hours": parse_string_to_int(
                            program_data.get("max_weekly_hours")
                        ),
                    }
                ],
                "courses": expected_courses,
                "child_programs": [],
            }
        )
    result = sorted(result, key=lambda x: x["readable_id"])
    expected = sorted(expected, key=lambda x: x["readable_id"])
    assert result == expected


def test_mitxonline_transform_courses(settings, mock_mitxonline_courses_data, mocker):
    """Test that mitxonline courses data is correctly transformed into our normalized structure"""
    set_up_topics(is_mitx=True)

    # Mock now_in_utc to return a date before the test data's end dates
    mock_now = datetime(2023, 1, 1, tzinfo=UTC)
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=mock_now)

    result = transform_courses(mock_mitxonline_courses_data["results"])
    expected = []
    for course_data in mock_mitxonline_courses_data["results"]:
        if "PROCTORED EXAM" in course_data["title"]:
            continue
        runs = [
            _transform_run(course_run, course_data)
            for course_run in course_data["courseruns"]
        ]
        has_certification = parse_certification(OFFERED_BY["code"], runs)
        strip_enrollment_modes(runs)
        expected.append(
            {
                "readable_id": course_data["readable_id"],
                "platform": PlatformType.mitxonline.name,
                "etl_source": ETLSource.mitxonline.name,
                "force_ingest": course_data.get("ingest_content_files_for_ai", False),
                "resource_type": LearningResourceType.course.name,
                "departments": [
                    get_department_id_by_name(course_data["departments"][0]["name"])
                ],
                "title": course_data["title"],
                "image": _transform_image(course_data),
                "description": clean_data(
                    course_data.get("page", {}).get("description", None)
                ),
                "offered_by": OFFERED_BY,
                "published": bool(
                    course_data.get("page", {}).get("page_url", None)
                    and course_data.get("page", {}).get("live", None)
                    and len(
                        [
                            run
                            for run in course_data["courseruns"]
                            if run["is_enrollable"]
                        ]
                    )
                    > 0
                    and course_data.get("include_in_learn_catalog", False)
                ),
                "professional": False,
                "certification": has_certification,
                "certification_type": parse_certificate_type(
                    course_data["certificate_type"]
                )
                if has_certification
                else CertificationType.none.name,
                "topics": transform_topics(course_data["topics"], OFFERED_BY["code"]),
                "url": (
                    urljoin(
                        settings.MITX_ONLINE_BASE_URL,
                        course_data["page"]["page_url"],
                    )
                    if course_data.get("page", {}).get("page_url")
                    else None
                ),
                "runs": runs,
                "course": {
                    "course_numbers": [
                        {
                            "value": course_data["readable_id"],
                            "department": ANY,
                            "listing_type": CourseNumberType.primary.value,
                            "primary": True,
                            "sort_coursenum": course_data["readable_id"],
                        }
                    ]
                },
                "availability": course_data["availability"],
                "format": [Format.asynchronous.name],
                "pace": [Pace.instructor_paced.name],
            }
        )
    assert expected == result


@pytest.mark.parametrize("include_in_learn_catalog", [True, False, None])
def test_mitxonline_transform_courses_not_in_catalog(
    mock_mitxonline_courses_data, mocker, include_in_learn_catalog
):
    """Test that a course with include_in_learn_catalog=False/None is not published"""
    mock_now = datetime(2023, 1, 1, tzinfo=UTC)
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=mock_now)

    # Use only the first course and set include_in_learn_catalog to False/None
    course = mock_mitxonline_courses_data["results"][0]
    course["include_in_learn_catalog"] = include_in_learn_catalog
    # Ensure all other publish conditions are met
    assert course["page"]["page_url"]
    assert course["page"]["live"]
    assert any(run["is_enrollable"] for run in course["courseruns"])

    result = transform_courses([course])
    assert result[0]["published"] is bool(include_in_learn_catalog)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("start_dt", "enrollment_dt", "expected_dt"),
    [
        (None, "2023-03-01 14:00:00+00:00", "2023-03-01 14:00:00+00:00"),
        ("2023-03-01 14:00:00+00:00", None, "2023-03-01 14:00:00+00:00"),
        (
            "2023-03-01 14:00:00+00:00",
            "2023-03-01 14:00:00+00:00",
            "2023-03-01 14:00:00+00:00",
        ),
        (None, None, None),
    ],
)
def test_course_run_start_date_value(
    mock_mitxonline_courses_data,
    mock_mitxonline_programs_data,
    start_dt,
    enrollment_dt,
    expected_dt,
):
    """Test that the start date value is correctly determined for course runs"""
    results = [
        result
        for result in mock_mitxonline_courses_data["results"]
        if "PROCTORED" not in result["title"]
    ]
    results[0]["courseruns"][0]["start_date"] = start_dt
    results[0]["courseruns"][0]["enrollment_start"] = enrollment_dt
    transformed_courses = transform_courses(results)
    assert transformed_courses[0]["runs"][0]["start_date"] == _parse_datetime(
        expected_dt
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("start_dt", "enrollment_dt", "expected_dt"),
    [
        (None, "2019-02-20T15:00:00", "2019-02-20T15:00:00"),
        ("2024-02-20T15:00:00", None, "2024-02-20T15:00:00"),
        ("2023-02-20T15:00:00", "2024-02-20T15:00:00", "2023-02-20T15:00:00"),
        (None, None, None),
    ],
)
def test_program_run_start_date_value(  # noqa: PLR0913
    mocker,
    mock_mitxonline_programs_data,
    mock_mitxonline_courses_data,
    start_dt,
    enrollment_dt,
    expected_dt,
):
    mocker.patch(
        "learning_resources.etl.mitxonline._fetch_data",
        return_value=mock_mitxonline_courses_data["results"],
    )

    """Test that the start date value is correctly determined for program runs"""
    mock_mitxonline_programs_data["results"][0]["start_date"] = start_dt
    mock_mitxonline_programs_data["results"][0]["enrollment_start"] = enrollment_dt

    transformed_programs = list(
        transform_programs(mock_mitxonline_programs_data["results"])
    )

    assert transformed_programs[0]["runs"][0]["start_date"] == _parse_datetime(
        expected_dt
    )


@pytest.mark.parametrize(
    ("min_price", "max_price", "mode_data", "fully_enrollable", "expected"),
    [
        # Both modes: verified prices + free for audit (deduplicated, sorted)
        (
            100,
            1000,
            [{"mode_slug": "verified"}, {"mode_slug": "audit"}],
            True,
            [0, 100, 1000],
        ),
        (
            None,
            100,
            [{"mode_slug": "verified"}, {"mode_slug": "audit"}],
            True,
            [0, 100],
        ),
        (
            9.99,
            None,
            [{"mode_slug": "verified"}, {"mode_slug": "audit"}],
            True,
            [0, 9.99],
        ),
        # Audit only: free only (no verified prices)
        (100, 1000, [{"mode_slug": "audit"}], True, [0]),
        (99.99, 3000, [{"mode_slug": "audit"}], True, [0]),
        # Verified only: verified prices, no free
        (100, 1000, [{"mode_slug": "verified"}], True, [100, 1000]),
        # No modes: fallback to free
        (100, 1000, [], True, [0]),
        # Not fully enrollable: always free
        (100, 1000, [{"mode_slug": "verified"}, {"mode_slug": "audit"}], False, [0]),
        (100, 1000, [{"mode_slug": "audit"}], False, [0]),
        # No prices set: always free regardless of modes
        (None, None, [{"mode_slug": "audit"}], True, [0]),
        (None, None, [{"mode_slug": "verified"}], True, [0]),
    ],
)
def test_parse_prices(min_price, max_price, mode_data, fully_enrollable, expected):
    """Test that the prices are correctly parsed from the parent data"""
    program_data = {"min_price": min_price, "max_price": max_price}
    assert parse_prices(program_data, mode_data, fully_enrollable=fully_enrollable) == [
        {"amount": float(price), "currency": CURRENCY_USD} for price in expected
    ]


@pytest.mark.parametrize(
    ("enrollment_modes", "expected_prices"),
    [
        # Both modes: verified prices + free audit price (deduplicated, sorted)
        (
            [{"mode_slug": "verified"}, {"mode_slug": "audit"}],
            [0, 100, 200],
        ),
        # Audit only: free only
        (
            [{"mode_slug": "audit"}],
            [0],
        ),
        # Verified only: verified prices, no free
        (
            [{"mode_slug": "verified"}],
            [100, 200],
        ),
        # No modes: free only
        (
            [],
            [0],
        ),
    ],
)
def test_transform_run_prices_by_enrollment_mode(
    mocker, enrollment_modes, expected_prices
):
    """Test that run prices reflect enrollment modes correctly"""
    mock_now = datetime(2023, 1, 1, tzinfo=UTC)
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=mock_now)

    course = {
        "min_price": 100,
        "max_price": 200,
        "page": {
            "page_url": "/courses/test/",
            "live": True,
            "description": "Test",
            "feature_image_src": None,
            "instructors": [],
        },
        "availability": "dated",
        "duration": "",
        "time_commitment": "",
        "min_weeks": None,
        "max_weeks": None,
        "min_weekly_hours": None,
        "max_weekly_hours": None,
    }
    run = {
        "title": "Test Run",
        "courseware_id": "course-v1:MITxT+TEST+1T2024",
        "start_date": "2024-01-01T00:00:00Z",
        "end_date": "2024-06-01T00:00:00Z",
        "enrollment_start": "2023-12-01T00:00:00Z",
        "enrollment_end": "2024-05-01T00:00:00Z",
        "is_enrollable": True,
        "is_self_paced": False,
        "enrollment_modes": enrollment_modes,
        "page": {},
    }
    result = _transform_run(run, course)
    assert result["prices"] == [
        {"amount": float(p), "currency": CURRENCY_USD} for p in expected_prices
    ]


def test_transform_run_prices_not_fully_enrollable(mocker):
    """Test that non-enrollable runs always get free-only prices regardless of modes"""
    mock_now = datetime(2023, 1, 1, tzinfo=UTC)
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=mock_now)

    course = {
        "min_price": 100,
        "max_price": 200,
        "page": {
            "page_url": "/courses/test/",
            "live": True,
            "description": "Test",
            "feature_image_src": None,
            "instructors": [],
        },
        "availability": "dated",
        "duration": "",
        "time_commitment": "",
        "min_weeks": None,
        "max_weeks": None,
        "min_weekly_hours": None,
        "max_weekly_hours": None,
    }
    free_price = [{"amount": 0.0, "currency": CURRENCY_USD}]
    for modes in (
        [{"mode_slug": "verified"}, {"mode_slug": "audit"}],
        [{"mode_slug": "audit"}],
        [{"mode_slug": "verified"}],
        [],
    ):
        run = {
            "title": "Test Run",
            "courseware_id": "course-v1:MITxT+TEST+1T2024",
            "start_date": "2024-01-01T00:00:00Z",
            "end_date": "2024-06-01T00:00:00Z",
            "enrollment_start": "2023-12-01T00:00:00Z",
            "enrollment_end": "2024-05-01T00:00:00Z",
            "is_enrollable": False,
            "is_self_paced": False,
            "enrollment_modes": modes,
            "page": {},
        }
        result = _transform_run(run, course)
        assert result["prices"] == free_price, (
            f"Expected free-only prices for non-enrollable run with modes {modes}"
        )


@pytest.mark.parametrize(
    ("cert_type", "expected_cert_type", "error"),
    [
        ("Certificate of Completion", CertificationType.completion.name, False),
        ("MicroMasters Credential", CertificationType.micromasters.name, False),
        ("Pro Cert", CertificationType.completion.name, True),
    ],
)
def test_parse_certificate_type(mocker, cert_type, expected_cert_type, error):
    """Test that the certificate type is correctly parsed"""
    mock_log = mocker.patch("learning_resources.etl.mitxonline.log.error")
    assert parse_certificate_type(cert_type) == expected_cert_type
    assert mock_log.call_count == (1 if error else 0)


@pytest.mark.parametrize(
    ("mock_responses", "expected_results"),
    [
        (
            [
                {
                    "results": [{"id": 1, "name": "Course 1"}],
                    "next": "http://localhost/api/courses?page=2",
                },
                {
                    "results": [{"id": 2, "name": "Course 2"}],
                    "next": None,
                },
            ],
            [{"id": 1, "name": "Course 1"}, {"id": 2, "name": "Course 2"}],
        ),
        (
            [
                {
                    "results": [
                        {"id": 1, "name": "Course 1"},
                        {"id": 3, "name": "Course 3"},
                    ],
                    "next": "http://localhost/api/courses?page=2",
                },
                {
                    "results": [
                        {"id": 4, "name": "Course 4"},
                        {"id": 5, "name": "Course 5"},
                    ],
                    "next": "http://localhost/api/courses?page=3",
                },
                {
                    "results": [{"id": 2, "name": "Course 2"}],
                    "next": None,
                },
            ],
            [
                {"id": 1, "name": "Course 1"},
                {"id": 3, "name": "Course 3"},
                {"id": 4, "name": "Course 4"},
                {"id": 5, "name": "Course 5"},
                {"id": 2, "name": "Course 2"},
            ],
        ),
    ],
)
def test_fetch_data(mock_responses, expected_results, mocker, settings):
    """Test _fetch_data to ensure it handles pagination and avoids parameter growth"""
    settings.REQUESTS_TIMEOUT = 5
    mock_get = mocker.patch(
        "learning_resources.etl.mitxonline.requests.get",
        side_effect=[
            mocker.Mock(json=mocker.Mock(return_value=response))
            for response in mock_responses
        ],
    )

    url = "http://localhost/api/courses"

    results = list(_fetch_data(url))

    assert results == expected_results
    assert mock_get.call_count == len(mock_responses)
    i = 0
    for i, call in enumerate(mock_get.mock_calls):
        args = call.args
        kwargs = call.kwargs
        assert args[0] == url
        if mock_responses[i - 1]["next"]:
            parsed = urlparse(mock_responses[i - 1]["next"])
            assert kwargs["params"] == parse_qs(parsed.query)


@pytest.mark.parametrize(
    ("run_data", "expected"),
    [
        # Fully enrollable: all conditions met
        (
            {
                "published": True,
                "is_enrollable": True,
                "end_date": "2124-01-01T00:00:00Z",
                "enrollment_end": "2124-01-01T00:00:00Z",
            },
            True,
        ),
        # Fully enrollable: no end dates (open-ended)
        (
            {
                "published": True,
                "is_enrollable": True,
                "end_date": None,
                "enrollment_end": None,
            },
            True,
        ),
        # Not enrollable: is_enrollable is False
        (
            {
                "published": True,
                "is_enrollable": False,
                "end_date": "2124-01-01T00:00:00Z",
                "enrollment_end": "2124-01-01T00:00:00Z",
            },
            False,
        ),
        # Not enrollable: published is False
        (
            {
                "published": False,
                "is_enrollable": True,
                "end_date": None,
                "enrollment_end": None,
            },
            False,
        ),
        # Not enrollable: end_date in the past
        (
            {
                "published": True,
                "is_enrollable": True,
                "end_date": "2022-01-01T00:00:00Z",
                "enrollment_end": None,
            },
            False,
        ),
        # Not enrollable: enrollment_end in the past
        (
            {
                "published": True,
                "is_enrollable": True,
                "end_date": None,
                "enrollment_end": "2022-01-01T00:00:00Z",
            },
            False,
        ),
        # Enrollable: missing published key defaults to True
        (
            {
                "is_enrollable": True,
                "end_date": None,
                "enrollment_end": None,
            },
            True,
        ),
        # Not enrollable: missing is_enrollable key defaults to False
        (
            {
                "published": True,
                "end_date": None,
                "enrollment_end": None,
            },
            False,
        ),
    ],
)
def test_is_fully_enrollable(mocker, run_data, expected):
    """Test that is_fully_enrollable returns the correct boolean value based on run data"""
    mock_now = datetime(2023, 6, 1, tzinfo=UTC)
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=mock_now)
    assert is_fully_enrollable(run_data) == expected


@pytest.mark.parametrize(
    ("enrollment_modes", "expected"),
    [
        (
            [{"mode_slug": "verified"}, {"mode_slug": "audit"}],
            {
                "certification": True,
                "certification_type": CertificationType.completion.name,
            },
        ),
        (
            [{"mode_slug": "verified"}],
            {
                "certification": True,
                "certification_type": CertificationType.completion.name,
            },
        ),
        (
            [{"mode_slug": "audit"}],
            {"certification": False, "certification_type": CertificationType.none.name},
        ),
        (
            [],
            {"certification": False, "certification_type": CertificationType.none.name},
        ),
    ],
)
def test_transform_program_certification_by_enrollment_modes(
    mocker,
    mock_mitxonline_programs_data,
    mock_mitxonline_courses_data,
    enrollment_modes,
    expected,
):
    """Test that program certification and certification_type depend on
    whether enrollment_modes includes 'verified'.
    """
    mock_now = datetime(2023, 1, 1, tzinfo=UTC)
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=mock_now)
    mocker.patch(
        "learning_resources.etl.mitxonline._fetch_data",
        return_value=mock_mitxonline_courses_data["results"],
    )

    program = mock_mitxonline_programs_data["results"][0].copy()
    program["page"] = {**program["page"]}
    program["page"]["page_url"] = "/programs/test/"
    program["page"]["live"] = True
    program["certificate_type"] = "Certificate of Completion"
    program["enrollment_modes"] = enrollment_modes

    results = list(transform_programs([program]))
    result = results[0]

    assert result["certification"] is expected["certification"]
    assert result["certification_type"] == expected["certification_type"]


def test_fetch_courses_by_ids_empty_list(mocker, settings):
    """Test that _fetch_courses_by_ids returns [] for empty input"""
    settings.MITX_ONLINE_COURSES_API_URL = "http://localhost/test/courses/api"
    mock_fetch = mocker.patch("learning_resources.etl.mitxonline._fetch_data")
    result = _fetch_courses_by_ids([])
    assert result == []
    mock_fetch.assert_not_called()
