"""Tests for MITx Online ETL functions"""

import json

# pylint: disable=redefined-outer-name
from datetime import datetime
from decimal import Decimal
from unittest.mock import ANY
from urllib.parse import urljoin

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
    _parse_datetime,
    _transform_image,
    _transform_run,
    extract_courses,
    extract_programs,
    parse_certificate_type,
    parse_page_attribute,
    parse_program_prices,
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
                    "prices": parse_program_prices(program_data),
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
                    ),
                    "certification": bool(
                        course_data.get("page", {}).get("page_url", None) is not None
                    ),
                    "certification_type": parse_certificate_type(
                        course_data["certificate_type"]
                    )
                    if bool(
                        course_data.get("page", {}).get("page_url", None) is not None
                    )
                    else None,
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
                            "prices": sorted(
                                [
                                    {"amount": Decimal(i), "currency": CURRENCY_USD}
                                    for i in {
                                        0.00,
                                        *[
                                            price
                                            for price in [
                                                product.get("price")
                                                for product in course_run_data.get(
                                                    "products", []
                                                )
                                            ]
                                            if price is not None
                                        ],
                                    }
                                ],
                                key=lambda x: x["amount"],
                            ),
                            "instructors": [
                                {"full_name": instructor["name"]}
                                for instructor in parse_page_attribute(
                                    course_data, "instructors", is_list=True
                                )
                            ],
                            "status": RunStatus.current.value
                            if parse_page_attribute(course_data, "page_url")
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


def test_mitxonline_transform_courses(settings, mock_mitxonline_courses_data):
    """Test that mitxonline courses data is correctly transformed into our normalized structure"""
    set_up_topics(is_mitx=True)
    result = transform_courses(mock_mitxonline_courses_data["results"])
    expected = [
        {
            "readable_id": course_data["readable_id"],
            "platform": PlatformType.mitxonline.name,
            "etl_source": ETLSource.mitxonline.name,
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
            ),
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
                {
                    "run_id": course_run_data["courseware_id"],
                    "title": course_run_data["title"],
                    "image": _transform_image(course_run_data),
                    "url": (
                        urljoin(
                            settings.MITX_ONLINE_BASE_URL,
                            course_data["page"]["page_url"],
                        )
                        if course_data.get("page", {}).get("page_url")
                        else None
                    ),
                    "description": clean_data(
                        course_run_data.get("page", {}).get("description", None)
                    ),
                    "start_date": any_instance_of(datetime, type(None)),
                    "end_date": any_instance_of(datetime, type(None)),
                    "enrollment_start": any_instance_of(datetime, type(None)),
                    "enrollment_end": any_instance_of(datetime, type(None)),
                    "published": bool(
                        course_run_data["is_enrollable"] and course_data["page"]["live"]
                    ),
                    "prices": sorted(
                        [
                            {"amount": Decimal(i), "currency": CURRENCY_USD}
                            for i in {
                                0.00,
                                *[
                                    price
                                    for price in [
                                        product.get("price")
                                        for product in course_run_data.get(
                                            "products", []
                                        )
                                    ]
                                    if price is not None
                                ],
                            }
                        ],
                        key=lambda x: x["amount"],
                    ),
                    "instructors": [
                        {"full_name": instructor["name"]}
                        for instructor in parse_page_attribute(
                            course_data, "instructors", is_list=True
                        )
                    ],
                    "status": RunStatus.current.value
                    if parse_page_attribute(course_data, "page_url")
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
            "availability": course_data["availability"],
            "format": [Format.asynchronous.name],
            "pace": [Pace.instructor_paced.name],
        }
        for course_data in mock_mitxonline_courses_data["results"]
        if "PROCTORED EXAM" not in course_data["title"]
    ]
    assert expected == result


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
    ("current_price", "page_price", "expected"),
    [
        (0, "100", [0, 100]),
        (None, "$100 - $1,000", [0, 100, 1000]),
        (99.99, "$99.99 - $3,000,000", [99.99, 3000000]),
        (9.99, "$99.99 per course", [9.99, 99.99]),
        (100, "varies from $29-$129", [100, 29, 129]),
    ],
)
def test_parse_prices(current_price, page_price, expected):
    """Test that the prices are correctly parsed from the page data"""
    program_data = {"current_price": current_price, "page": {"price": page_price}}
    assert parse_program_prices(program_data) == sorted(
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
