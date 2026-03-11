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
    _fetch_data,
    _parse_datetime,
    _transform_image,
    _transform_run,
    extract_courses,
    extract_programs,
    is_fully_enrollable,
    is_program_course,
    parse_certificate_type,
    parse_page_attribute,
    parse_prices,
    transform_courses,
    transform_program_as_course,
    transform_programs,
    transform_programs_as_courses,
    transform_topics,
)
from learning_resources.etl.utils import (
    get_department_id_by_name,
    parse_certification,
    parse_string_to_int,
    strip_enrollment_modes,
)
from learning_resources.test_utils import set_up_topics
from main.test_utils import any_instance_of, assert_json_equal
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

    # Filter out display_mode="course" programs (these are handled separately)
    regular_programs = [
        p
        for p in mock_mitxonline_programs_data["results"]
        if p.get("display_mode") != "course"
    ]
    result = transform_programs(regular_programs)
    expected = []
    for program_data in regular_programs:
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
    # Use only regular programs (not display_mode="course")
    regular_programs = [
        p
        for p in mock_mitxonline_programs_data["results"]
        if p.get("display_mode") != "course"
    ]
    regular_programs[0]["start_date"] = start_dt
    regular_programs[0]["enrollment_start"] = enrollment_dt

    transformed_programs = list(transform_programs(regular_programs))

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


def test_mitxonline_transform_programs_as_courses(
    mock_mitxonline_programs_data, mock_mitxonline_courses_data, mocker, settings
):
    """Test that programs with display_mode='course' are transformed into course-shaped dicts"""
    set_up_topics(is_mitx=True)

    mock_now = datetime(2023, 1, 1, tzinfo=UTC)
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=mock_now)

    settings.MITX_ONLINE_COURSES_API_URL = "http://localhost/test/courses/api"
    mocker.patch(
        "learning_resources.etl.mitxonline._fetch_data",
        return_value=mock_mitxonline_courses_data["results"],
    )

    course_programs = [
        p
        for p in mock_mitxonline_programs_data["results"]
        if p.get("display_mode") == "course"
    ]
    assert len(course_programs) > 0, (
        "Fixture should have at least one display_mode=course program"
    )

    result = transform_programs_as_courses(course_programs)
    expected = [transform_program_as_course(p) for p in course_programs]
    assert_json_equal(result, expected)

    # Verify the key properties that distinguish these from regular programs
    for transformed in result:
        assert transformed["resource_type"] == LearningResourceType.course.name
        assert transformed["content_tags"] == ["Program as Course"]
        assert "course" in transformed
        assert "courses" not in transformed


def test_transform_program_as_course(
    mock_mitxonline_programs_data, mock_mitxonline_courses_data, mocker, settings
):
    """Test that a single program with display_mode='course' is transformed correctly"""
    set_up_topics(is_mitx=True)

    mock_now = datetime(2023, 1, 1, tzinfo=UTC)
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=mock_now)

    settings.MITX_ONLINE_BASE_URL = "https://mitxonline.mit.edu"
    settings.MITX_ONLINE_COURSES_API_URL = "http://localhost/test/courses/api"
    mocker.patch(
        "learning_resources.etl.mitxonline._fetch_data",
        return_value=mock_mitxonline_courses_data["results"],
    )

    program = next(
        p
        for p in mock_mitxonline_programs_data["results"]
        if p.get("display_mode") == "course"
    )

    result = transform_program_as_course(program)

    base_url = settings.MITX_ONLINE_BASE_URL
    expected = {
        "readable_id": "program-v1:MITxT+UAI.DS",
        "platform": PlatformType.mitxonline.name,
        "etl_source": ETLSource.mitxonline.name,
        "resource_type": LearningResourceType.course.name,
        "title": "UAI Applied Data Science",
        "offered_by": OFFERED_BY,
        "topics": [{"name": "Mathematics"}],
        "departments": ["18"],
        "runs": [
            {
                "run_id": "program-v1:MITxT+UAI.DS",
                "enrollment_start": _parse_datetime("2024-01-01T00:00:00Z"),
                "enrollment_end": _parse_datetime("2024-04-01T00:00:00Z"),
                "start_date": _parse_datetime("2024-01-15T00:00:00Z"),
                "end_date": _parse_datetime("2024-04-15T00:00:00Z"),
                "title": "UAI Applied Data Science",
                "published": True,
                "url": f"{base_url}/programs/program-v1:MITxT+UAI.DS/",
                "image": {"url": f"{base_url}/static/images/uai-data-science.png"},
                "description": "<p>Applied Data Science program displayed as a course.</p>",
                "prices": [
                    {"amount": 0.0, "currency": CURRENCY_USD},
                    {"amount": 100.0, "currency": CURRENCY_USD},
                    {"amount": 200.0, "currency": CURRENCY_USD},
                ],
                "status": RunStatus.current.value,
                "availability": "anytime",
                "format": [Format.asynchronous.name],
                "pace": [Pace.instructor_paced.name],
                "duration": "10-12 weeks",
                "min_weeks": 10,
                "max_weeks": 12,
                "time_commitment": "5-7 hrs/wk",
                "min_weekly_hours": 5,
                "max_weekly_hours": 7,
            }
        ],
        "force_ingest": False,
        "content_tags": ["Program as Course"],
        "course": {
            "course_numbers": [
                {
                    "value": "program-v1:MITxT+UAI.DS",
                    "listing_type": "primary",
                    "department": None,
                    "sort_coursenum": "program-v1:MITxT+UAI.DS",
                    "primary": True,
                }
            ]
        },
        "published": True,
        "professional": False,
        "certification": True,
        "certification_type": CertificationType.completion.name,
        "image": {"url": f"{base_url}/static/images/uai-data-science.png"},
        "url": f"{base_url}/programs/program-v1:MITxT+UAI.DS/",
        "description": "<p>Applied Data Science program displayed as a course.</p>",
        "availability": "anytime",
        "format": [Format.asynchronous.name],
        "pace": [Pace.instructor_paced.name],
    }
    assert_json_equal(result, expected)


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
def test_transform_program_as_course_certification_by_enrollment_modes(  # noqa: PLR0913
    mocker,
    mock_mitxonline_programs_data,
    mock_mitxonline_courses_data,
    settings,
    enrollment_modes,
    expected,
):
    """Test that program-as-course certification depends on
    whether enrollment_modes includes 'verified'.
    """
    set_up_topics(is_mitx=True)

    mock_now = datetime(2023, 1, 1, tzinfo=UTC)
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=mock_now)

    settings.MITX_ONLINE_COURSES_API_URL = "http://localhost/test/courses/api"
    mocker.patch(
        "learning_resources.etl.mitxonline._fetch_data",
        return_value=mock_mitxonline_courses_data["results"],
    )

    program = next(
        p
        for p in mock_mitxonline_programs_data["results"]
        if p.get("display_mode") == "course"
    )
    program = {**program, "enrollment_modes": enrollment_modes}
    program["page"] = {**program["page"]}
    program["page"]["page_url"] = "/programs/test/"
    program["page"]["live"] = True
    program["certificate_type"] = "Certificate of Completion"

    result = transform_program_as_course(program)

    assert result["certification"] is expected["certification"]
    assert result["certification_type"] == expected["certification_type"]


def test_mitxonline_transform_programs_as_courses_empty():
    """Test that transform_programs_as_courses returns empty list for empty input"""
    assert transform_programs_as_courses([]) == []


@pytest.mark.parametrize(
    ("flag_enabled", "display_mode", "expected"),
    [
        (True, "course", True),
        (True, "program", False),
        (True, None, False),
        (False, "course", False),
        (False, "program", False),
    ],
)
def test_is_program_course(mocker, flag_enabled, display_mode, expected):
    """Test that is_program_course checks the feature flag and display_mode"""
    mocker.patch(
        "learning_resources.etl.mitxonline.features.is_enabled",
        return_value=flag_enabled,
    )
    program = {"readable_id": "program-v1:test"}
    if display_mode is not None:
        program["display_mode"] = display_mode
    assert is_program_course(program) is expected
