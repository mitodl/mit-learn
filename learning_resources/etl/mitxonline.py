"""MITX Online ETL"""

import copy
import logging
import re
from datetime import UTC
from decimal import Decimal
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from dateutil.parser import parse
from django.conf import settings

from learning_resources.constants import (
    CertificationType,
    Format,
    LearningResourceType,
    OfferedBy,
    Pace,
    PlatformType,
    RunStatus,
)
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.utils import (
    generate_course_numbers_json,
    get_department_id_by_name,
    parse_certification,
    parse_string_to_int,
    transform_price,
    transform_topics,
)
from main.utils import clean_data, now_in_utc

log = logging.getLogger(__name__)

EXCLUDE_REGEX = r"PROCTORED EXAM"

OFFERED_BY = {"code": OfferedBy.mitx.name}


def _fetch_data(url, params=None):
    if not params:
        params = {}
    while url:
        response = requests.get(
            url, params=params, timeout=settings.REQUESTS_TIMEOUT
        ).json()
        results = response["results"]
        yield from results
        next_url = response.get("next")
        if next_url:
            parsed = urlparse(next_url)
            url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            params = parse_qs(parsed.query)
        else:
            url = None


def _parse_datetime(value):
    """
    Parses an MITx Online datetime string

    Args:
        value(str): the datetime in string format

    Returns:
        datetime: the parsed datetime
    """  # noqa: D401
    return parse(value).replace(tzinfo=UTC) if value else None


def parse_certificate_type(certification_type: str) -> str:
    """
    Parse the certification type

    Args:
        certification_type(str): the certification type

    Returns:
        str: the parsed certification type
    """
    cert_map = {
        "micromasters credential": CertificationType.micromasters.name,
        "certificate of completion": CertificationType.completion.name,
    }

    certification_code = cert_map.get(certification_type.lower())
    if not certification_code:
        log.error("Unknown MITx Online certification type: %s", certification_type)
        return CertificationType.completion.name
    return certification_code


def parse_page_attribute(
    mitx_json,
    attribute,
    is_url=False,  # noqa: FBT002
    is_list=False,  # noqa: FBT002
):
    """
    Extracts an MITX Online page attribute

    Args:
        mitx_json(dict): the course/run/program JSON object containing the page element
        attribute(str): the name of the attribute to extract
        is_url(bool): True if the attribute is a url
        is_list(bool): True if the attribute is a list

    Returns:
        str or list or None: The attribute value
    """  # noqa: D401
    default_value = [] if is_list else None
    page = mitx_json.get("page", {}) or {}
    attribute = page.get(attribute, default_value)
    if attribute:
        return (
            urljoin(settings.MITX_ONLINE_BASE_URL, attribute) if is_url else attribute
        )
    return default_value


def extract_programs():
    """Loads the MITx Online catalog data"""  # noqa: D401
    if settings.MITX_ONLINE_PROGRAMS_API_URL:
        return list(
            _fetch_data(
                settings.MITX_ONLINE_PROGRAMS_API_URL,
                params={
                    "live": True,
                },
            )
        )
    else:
        log.warning("Missing required setting MITX_ONLINE_PROGRAMS_API_URL")

    return []


def extract_courses():
    """Loads the MITx Online catalog data"""  # noqa: D401
    if settings.MITX_ONLINE_COURSES_API_URL:
        return list(
            _fetch_data(
                settings.MITX_ONLINE_COURSES_API_URL,
                params={
                    "live": True,
                },
            )
        )
    else:
        log.warning("Missing required setting MITX_ONLINE_COURSES_API_URL")

    return []


def parse_prices(parent_data: dict) -> list[dict]:
    """
    Return a list of unique prices for a course/program.
    $0.00 (free) is always included for the non-certificate option.
    Other prices come from the parent course/program's min_price & max_price fields.
    """
    free_price_str = "0.00"
    return [
        transform_price(price)
        for price in sorted(
            {
                Decimal(free_price_str),
                Decimal(parent_data.get("min_price") or free_price_str),
                Decimal(parent_data.get("max_price") or free_price_str),
            }
        )
    ]


def parse_departments(departments_data: list[dict or str]) -> list[str]:
    """
    Return a list of department ids for a course/program

    Args:
        departments_data (list of dict or str): list of extracted department data

    Returns:
        list of str: list of department ids
    """
    dept_ids = []
    for department in departments_data:
        name = department["name"] if isinstance(department, dict) else department
        dept_id = get_department_id_by_name(name)
        if dept_id:
            dept_ids.append(dept_id)
    return dept_ids


def is_fully_enrollable(run_data: dict) -> bool:
    """
    Determine if the run is really enrollable.
    Some runs aren't enrollable even though they have is_enrollable=True.
    These should be published but not shown as offering certificates (free only).

    Args:
        run_data (dict): course run data

    Returns:
        bool: True if the run is fully enrollable, False otherwise
    """
    now = now_in_utc()
    end_date = _parse_datetime(run_data.get("end_date"))
    enrollment_end = _parse_datetime(run_data.get("enrollment_end"))
    # Use enrollment_end if it exists, otherwise use end_date
    certification_end = enrollment_end or end_date

    return bool(
        run_data.get("published", True)
        and run_data.get("is_enrollable", False)
        and (not certification_end or certification_end >= now)
    )


def _transform_image(mitxonline_data: dict) -> dict:
    """
    Transforms an image into our normalized data structure

    Args:
        mitxonline_data (dict): mitxonline data

    Returns:
        dict: normalized image data
    """  # noqa: D401
    image_url = parse_page_attribute(mitxonline_data, "feature_image_src", is_url=True)
    return {"url": image_url} if image_url else None


def _transform_run(course_run: dict, course: dict) -> dict:
    """
    Transforms a course run into our normalized data structure

    Args:
        course_run (dict): course run data

    Returns:
        dict: normalized course run data
    """  # noqa: D401
    fully_enrollable = is_fully_enrollable(course_run)
    return {
        "title": course_run["title"],
        "run_id": course_run["courseware_id"],
        "start_date": _parse_datetime(
            course_run.get("start_date") or course_run.get("enrollment_start")
        ),
        "end_date": _parse_datetime(course_run.get("end_date")),
        "enrollment_start": _parse_datetime(course_run.get("enrollment_start")),
        "enrollment_end": _parse_datetime(course_run.get("enrollment_end")),
        "url": parse_page_attribute(course, "page_url", is_url=True),
        "published": bool(
            course_run.get("is_enrollable", False)
            and (course.get("page") or {}).get("live", False)
        ),
        "description": clean_data(parse_page_attribute(course_run, "description")),
        "image": _transform_image(course_run),
        "prices": parse_prices(course) if fully_enrollable else [],
        "instructors": [
            {"full_name": instructor["name"]}
            for instructor in parse_page_attribute(course, "instructors", is_list=True)
        ],
        "status": RunStatus.current.value
        if (parse_page_attribute(course, "page_url") and fully_enrollable)
        else RunStatus.archived.value,
        "availability": course.get("availability"),
        "format": [Format.asynchronous.name],
        "pace": [
            Pace.self_paced.name
            if course_run.get("is_self_paced", False)
            else Pace.instructor_paced.name
        ],
        "duration": course.get("duration") or "",
        "min_weeks": course.get("min_weeks"),
        "max_weeks": course.get("max_weeks"),
        "time_commitment": course.get("time_commitment") or "",
        "min_weekly_hours": parse_string_to_int(course.get("min_weekly_hours")),
        "max_weekly_hours": parse_string_to_int(course.get("max_weekly_hours")),
    }


def _transform_course(course):
    """
    Transforms a course into our normalized data structure

    Args:
        course (dict): course data

    Returns:
        dict: normalized course data
    """  # noqa: D401
    runs = [
        _transform_run(course_run, course)
        for course_run in course["courseruns"]
        if course_run
    ]
    has_certification = parse_certification(OFFERED_BY["code"], runs)
    return {
        "readable_id": course["readable_id"],
        "platform": PlatformType.mitxonline.name,
        "etl_source": ETLSource.mitxonline.name,
        "resource_type": LearningResourceType.course.name,
        "title": course["title"],
        "offered_by": copy.deepcopy(OFFERED_BY),
        "topics": transform_topics(course.get("topics", []), OFFERED_BY["code"]),
        "departments": parse_departments(course.get("departments", [])),
        "runs": runs,
        "force_ingest": course.get("ingest_content_files_for_ai", False),
        "course": {
            "course_numbers": generate_course_numbers_json(
                course["readable_id"], is_ocw=False
            ),
        },
        "published": bool(
            parse_page_attribute(course, "page_url")
            and parse_page_attribute(course, "live")
            and len([run for run in runs if run["published"]]) > 0
            and course.get("include_in_learn_catalog", False)
        ),
        "professional": False,
        "certification": has_certification,
        "certification_type": parse_certificate_type(
            course.get("certificate_type", CertificationType.none.name)
        )
        if has_certification
        else CertificationType.none.name,
        "image": _transform_image(course),
        "url": parse_page_attribute(course, "page_url", is_url=True),
        "description": clean_data(parse_page_attribute(course, "description")),
        "availability": course.get("availability"),
        "format": [Format.asynchronous.name],
        "pace": sorted({pace for run in runs for pace in run["pace"]}),
    }


def transform_courses(courses):
    """
    Transforms a list of courses into our normalized data structure

    Args:
        courses (list of dict): courses data

    Returns:
        list of dict: normalized courses data
    """  # noqa: D401
    return [
        _transform_course(course)
        for course in courses
        if not re.search(EXCLUDE_REGEX, course["title"], re.IGNORECASE)
    ]


def _fetch_courses_by_ids(course_ids):
    if settings.MITX_ONLINE_COURSES_API_URL:
        return list(
            _fetch_data(
                settings.MITX_ONLINE_COURSES_API_URL,
                params={
                    "id": ",".join([str(courseid) for courseid in course_ids]),
                    "live": True,
                },
            )
        )

    log.warning("Missing required setting MITX_ONLINE_COURSES_API_URL")
    return []


def transform_programs(programs: list[dict]) -> list[dict]:
    """
    Transform the MITX Online catalog data

    Args:
        programs (list of dict): the MITX Online programs data

    Returns:
        list of dict: the transformed programs data

    """
    # normalize the MITx Online data
    for program in programs:
        courses = transform_courses(
            [
                course
                for course in _fetch_courses_by_ids(program["courses"])
                if not re.search(EXCLUDE_REGEX, course["title"], re.IGNORECASE)
            ]
        )
        pace = sorted(
            {course_pace for course in courses for course_pace in course["pace"]}
        )
        yield {
            "readable_id": program["readable_id"],
            "title": program["title"],
            "offered_by": OFFERED_BY,
            "etl_source": ETLSource.mitxonline.name,
            "resource_type": LearningResourceType.program.name,
            "departments": parse_departments(program.get("departments", [])),
            "platform": PlatformType.mitxonline.name,
            "professional": False,
            "certification": program.get("certificate_type") is not None,
            "certification_type": parse_certificate_type(
                program.get("certificate_type", CertificationType.none.name)
            ),
            "topics": transform_topics(program.get("topics", []), OFFERED_BY["code"]),
            "description": clean_data(parse_page_attribute(program, "description")),
            "url": parse_page_attribute(program, "page_url", is_url=True),
            "image": _transform_image(program),
            "availability": program.get("availability"),
            "published": bool(
                parse_page_attribute(program, "page_url")
                and parse_page_attribute(program, "live")
            ),  # a program is only considered published if it has a page url
            "format": [Format.asynchronous.name],
            "pace": pace,
            "runs": [
                {
                    "run_id": program["readable_id"],
                    "enrollment_start": _parse_datetime(
                        program.get("enrollment_start")
                    ),
                    "enrollment_end": _parse_datetime(program.get("enrollment_end")),
                    "start_date": _parse_datetime(
                        program.get("start_date") or program.get("enrollment_start")
                    ),
                    "end_date": _parse_datetime(program.get("end_date")),
                    "title": program["title"],
                    "published": bool(
                        parse_page_attribute(program, "page_url")
                    ),  # program only considered published if it has a product/price
                    "url": parse_page_attribute(program, "page_url", is_url=True),
                    "image": _transform_image(program),
                    "description": clean_data(
                        parse_page_attribute(program, "description")
                    ),
                    "prices": parse_prices(program),
                    "status": RunStatus.current.value
                    if parse_page_attribute(program, "page_url")
                    else RunStatus.archived.value,
                    "availability": program.get("availability"),
                    "format": [Format.asynchronous.name],
                    "pace": pace,
                    "duration": program.get("duration") or "",
                    "min_weeks": program.get("min_weeks"),
                    "max_weeks": program.get("max_weeks"),
                    "time_commitment": program.get("time_commitment") or "",
                    "min_weekly_hours": parse_string_to_int(
                        program.get("min_weekly_hours")
                    ),
                    "max_weekly_hours": parse_string_to_int(
                        program.get("max_weekly_hours")
                    ),
                }
            ],
            "courses": courses,
        }
