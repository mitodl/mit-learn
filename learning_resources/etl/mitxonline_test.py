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
    expected = [
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
            "certification": bool(
                program_data.get("page", {}).get("page_url", None) is not None
            ),
            "certification_type": parse_certificate_type(
                program_data["certificate_type"]
            )
            if bool(program_data.get("page", {}).get("page_url", None) is not None)
            else None,
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
                        program_data.get("page", {}).get("page_url", None) is not None
                    ),
                    "prices": parse_prices(program_data),
                    "image": _transform_image(program_data),
                    "title": program_data["title"],
                    "description": clean_data(
                        program_data.get("page", {}).get("description", None)
                    ),
                    "url": parse_page_attribute(program_data, "page_url", is_url=True),
                    "status": RunStatus.current.value
                    if parse_page_attribute(program_data, "page_url")
                    else RunStatus.archived.value,
                    "availability": program_data["availability"],
                    "format": [Format.asynchronous.name],
                    "pace": [Pace.instructor_paced.name],
                    "duration": program_data.get("duration"),
                    "time_commitment": program_data.get("time_commitment"),
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
            "courses": [
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
                    "certification": parse_certification(
                        OFFERED_BY["code"],
                        [
                            _transform_run(course_run, course_data)
                            for course_run in course_data["courseruns"]
                        ],
                    ),
                    "certification_type": parse_certificate_type(
                        course_data["certificate_type"]
                    )
                    if parse_certification(
                        OFFERED_BY["code"],
                        [
                            _transform_run(course_run, course_data)
                            for course_run in course_data["courseruns"]
                        ],
                    )
                    else CertificationType.none.name,
                    "url": parse_page_attribute(course_data, "page_url", is_url=True),
                    "availability": course_data["availability"],
                    "format": [Format.asynchronous.name],
                    "pace": [Pace.instructor_paced.name],
                    "topics": transform_topics(
                        course_data["topics"], OFFERED_BY["code"]
                    ),
                    "runs": [
                        {
                            "run_id": course_run_data["courseware_id"],
                            "title": course_run_data["title"],
                            "image": _transform_image(course_run_data),
                            "start_date": any_instance_of(datetime, type(None)),
                            "end_date": any_instance_of(datetime, type(None)),
                            "enrollment_start": any_instance_of(datetime, type(None)),
                            "enrollment_end": any_instance_of(datetime, type(None)),
                            "url": parse_page_attribute(
                                course_data, "page_url", is_url=True
                            ),
                            "description": any_instance_of(str, type(None)),
                            "published": bool(
                                course_run_data["is_enrollable"]
                                and course_data["page"]["live"]
                            ),
                            "prices": parse_prices(course_data)
                            if is_fully_enrollable(
                                course_run_data,
                            )
                            else [],
                            "instructors": [
                                {"full_name": instructor["name"]}
                                for instructor in parse_page_attribute(
                                    course_data, "instructors", is_list=True
                                )
                            ],
                            "status": RunStatus.current.value
                            if (
                                parse_page_attribute(course_data, "page_url")
                                and is_fully_enrollable(course_run_data)
                            )
                            else RunStatus.archived.value,
                            "availability": course_data["availability"],
                            "format": [Format.asynchronous.name],
                            "pace": [Pace.instructor_paced.name],
                            "duration": course_data.get("duration"),
                            "min_weeks": course_data.get("min_weeks"),
                            "max_weeks": course_data.get("max_weeks"),
                            "time_commitment": course_data.get("time_commitment"),
                            "min_weekly_hours": parse_string_to_int(
                                course_data.get("min_weekly_hours")
                            ),
                            "max_weekly_hours": parse_string_to_int(
                                course_data.get("max_weekly_hours")
                            ),
                        }
                        for course_run_data in course_data["courseruns"]
                    ],
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
                for course_data in sorted(
                    mock_mitxonline_courses_data["results"],
                    key=lambda x: x["readable_id"],
                )
                if "PROCTORED EXAM" not in course_data["title"]
            ],
        }
        for program_data in mock_mitxonline_programs_data["results"]
    ]
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
    expected = [
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
                    [run for run in course_data["courseruns"] if run["is_enrollable"]]
                )
                > 0
                and course_data.get("include_in_learn_catalog", False)
            ),
            "professional": False,
            "certification": parse_certification(
                OFFERED_BY["code"],
                [
                    _transform_run(course_run, course_data)
                    for course_run in course_data["courseruns"]
                ],
            ),
            "certification_type": parse_certificate_type(
                course_data["certificate_type"]
            )
            if parse_certification(
                OFFERED_BY["code"],
                [
                    _transform_run(course_run, course_data)
                    for course_run in course_data["courseruns"]
                ],
            )
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
            "runs": [
                _transform_run(course_run_data, course_data)
                for course_run_data in course_data["courseruns"]
            ],
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
        for course_data in mock_mitxonline_courses_data["results"]
        if "PROCTORED EXAM" not in course_data["title"]
    ]
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
    ("min_price", "max_price", "expected"),
    [
        (None, 100, [0, 100]),
        (100, 1000, [0, 100, 1000]),
        (99.99, 3000, [0.00, 99.99, 3000]),
        (9.99, None, [0, 9.99]),
    ],
)
def test_parse_prices(min_price, max_price, expected):
    """Test that the prices are correctly parsed from the parent data"""
    program_data = {"min_price": min_price, "max_price": max_price}
    assert parse_prices(program_data) == sorted(
        [{"amount": float(price), "currency": CURRENCY_USD} for price in expected],
        key=lambda x: x["amount"],
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
