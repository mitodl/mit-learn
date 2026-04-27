"""MITX Online ETL"""

import copy
import logging
import re
from collections.abc import Iterator
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
    strip_enrollment_modes,
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


def _learn_product_url_for_mitx_course(
    readable_id: str | None, *, has_product_page: bool
) -> str | None:
    """
    Learn product URL for an MITx Online course with a Wagtail product page.
    """
    if not has_product_page or not readable_id:
        return None
    base = settings.APP_BASE_URL.rstrip("/")
    return f"{base}/courses/{readable_id}"


def _learn_product_url_for_mitx_program(
    readable_id: str | None,
    display_mode: str | None,
    *,
    has_product_page: bool,
) -> str | None:
    """
    Learn product URL for an MITx Online program with a Wagtail product page.
    display_mode "course" uses /courses/p/; otherwise /programs/.
    """
    if not has_product_page or not readable_id:
        return None
    base = settings.APP_BASE_URL.rstrip("/")
    if display_mode == "course":
        return f"{base}/courses/p/{readable_id}"
    return f"{base}/programs/{readable_id}"


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


def parse_prices(
    parent_data: dict, mode_data: list, *, fully_enrollable: bool = True
) -> list[dict]:
    """
    Return a list of unique prices for a course/program run.
    """
    free_price = transform_price(Decimal("0.00"))
    mode_slugs = [mode.get("mode_slug") for mode in mode_data]
    has_verified = "verified" in mode_slugs
    has_audit = "audit" in mode_slugs

    if not fully_enrollable or (
        not parent_data.get("min_price") and not parent_data.get("max_price")
    ):
        return [free_price]

    price_set = set()
    if has_verified:
        price_set.update(
            {
                Decimal(parent_data.get("min_price") or "0.00"),
                Decimal(parent_data.get("max_price") or "0.00"),
            }
        )
    if has_audit:
        price_set.add(Decimal("0.00"))

    prices = [transform_price(price) for price in sorted(price_set)]
    return prices or [free_price]


def parse_departments(departments_data: list[dict | str]) -> list[str]:
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
    has_product_page = bool(parse_page_attribute(course, "page_url"))
    return {
        "title": course_run["title"],
        "run_id": course_run["courseware_id"],
        "start_date": _parse_datetime(
            course_run.get("start_date") or course_run.get("enrollment_start")
        ),
        "end_date": _parse_datetime(course_run.get("end_date")),
        "enrollment_start": _parse_datetime(course_run.get("enrollment_start")),
        "enrollment_end": _parse_datetime(course_run.get("enrollment_end")),
        "url": _learn_product_url_for_mitx_course(
            course.get("readable_id"), has_product_page=has_product_page
        ),
        "published": bool(
            course_run.get("is_enrollable", False)
            and (course.get("page") or {}).get("live", False)
        ),
        "description": clean_data(parse_page_attribute(course_run, "description")),
        "image": _transform_image(course_run),
        "enrollment_modes": course_run.get("enrollment_modes", []),
        "prices": parse_prices(
            course,
            course_run.get("enrollment_modes", []),
            fully_enrollable=fully_enrollable,
        ),
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
    strip_enrollment_modes(runs)
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
        "url": _learn_product_url_for_mitx_course(
            course["readable_id"],
            has_product_page=bool(parse_page_attribute(course, "page_url")),
        ),
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


def get_course_ids_from_req_tree(
    nodes: list[dict],
    programs_by_id: dict[int, dict] | None = None,
    visited_programs: set[int] | None = None,
) -> list[int]:
    """
    Extract unique course IDs from a program's req_tree.

    Handles both course nodes (node_type="course") and program nodes
    (node_type="program" with required_program set). For program nodes,
    the referenced program's own req_tree is recursed into using the
    programs_by_id lookup. A visited set prevents infinite recursion
    from circular program references.

    Args:
        nodes: list of req_tree node dicts
        programs_by_id: optional mapping of program ID to program data,
            used to resolve required_program references
        visited_programs: optional set tracking program IDs already
            visited in this traversal to prevent cycles

    Returns:
        list of int: unique course IDs found in the tree (order preserved)
    """
    if visited_programs is None:
        visited_programs = set()
    seen_ids: set[int] = set()
    course_ids: list[int] = []
    _collect_course_ids(nodes, programs_by_id, visited_programs, seen_ids, course_ids)
    return course_ids


def _collect_course_ids(
    nodes: list[dict],
    programs_by_id: dict[int, dict] | None,
    visited_programs: set[int],
    seen_ids: set[int],
    course_ids: list[int],
) -> None:
    """Recursive helper for get_course_ids_from_req_tree."""
    for node in nodes:
        data = node.get("data", {})
        node_type = data.get("node_type")
        if node_type == "course":
            course_id = data.get("course")
            if isinstance(course_id, int) and course_id not in seen_ids:
                seen_ids.add(course_id)
                course_ids.append(course_id)
        elif node_type == "program" and programs_by_id:
            required_program_id = data.get("required_program")
            if (
                isinstance(required_program_id, int)
                and required_program_id not in visited_programs
            ):
                visited_programs.add(required_program_id)
                child_program = programs_by_id.get(required_program_id)
                if child_program and child_program.get("display_mode") != "course":
                    _collect_course_ids(
                        child_program.get("req_tree", []),
                        programs_by_id,
                        visited_programs,
                        seen_ids,
                        course_ids,
                    )
        _collect_course_ids(
            node.get("children", []),
            programs_by_id,
            visited_programs,
            seen_ids,
            course_ids,
        )


def get_program_ids_from_req_tree(nodes: list[dict]) -> list[int]:
    """
    Extract program IDs from a program's req_tree.

    Finds nodes with node_type="program" and returns their required_program IDs.
    Recurses into children to find program nodes at any depth.

    Args:
        nodes: list of req_tree node dicts

    Returns:
        list of int: unique program IDs found in the tree
    """
    seen_ids: set[int] = set()  # Fast duplicate checking
    program_ids: list[int] = []  # Preserves req_tree insertion order
    _collect_program_ids(nodes, seen_ids, program_ids)
    return program_ids


def _collect_program_ids(
    nodes: list[dict],
    seen_ids: set[int],
    program_ids: list[int],
) -> None:
    """Recursive helper for get_program_ids_from_req_tree."""
    for node in nodes:
        data = node.get("data", {})
        if data.get("node_type") == "program":
            prog_id = data.get("required_program")
            if isinstance(prog_id, int) and prog_id not in seen_ids:
                seen_ids.add(prog_id)
                program_ids.append(prog_id)
        _collect_program_ids(node.get("children", []), seen_ids, program_ids)


def _fetch_courses_by_ids(course_ids):
    if not course_ids:
        return []
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


def transform_programs(programs: list[dict]) -> Iterator[dict]:
    """
    Transform the MITX Online catalog data

    Args:
        programs (list of dict): the MITX Online programs data

    Yields:
        Iterator[dict]: transformed program data for each program

    """
    # normalize the MITx Online data
    programs_by_id = {p["id"]: p for p in programs}
    for program in programs:
        courses = transform_courses(
            [
                course
                for course in _fetch_courses_by_ids(
                    get_course_ids_from_req_tree(
                        program.get("req_tree", []), programs_by_id
                    )
                )
                if not re.search(EXCLUDE_REGEX, course["title"], re.IGNORECASE)
            ]
        )
        pace = sorted(
            {course_pace for course in courses for course_pace in course["pace"]}
        )
        has_product_page = bool(parse_page_attribute(program, "page_url"))
        learn_program_url = _learn_product_url_for_mitx_program(
            program["readable_id"],
            program.get("display_mode"),
            has_product_page=has_product_page,
        )
        run = {
            "run_id": program["readable_id"],
            "enrollment_start": _parse_datetime(program.get("enrollment_start")),
            "enrollment_end": _parse_datetime(program.get("enrollment_end")),
            "start_date": _parse_datetime(
                program.get("start_date") or program.get("enrollment_start")
            ),
            "end_date": _parse_datetime(program.get("end_date")),
            "title": program["title"],
            "published": bool(
                has_product_page
            ),  # program only considered published if it has a product/price
            "url": learn_program_url,
            "image": _transform_image(program),
            "description": clean_data(parse_page_attribute(program, "description")),
            "enrollment_modes": program.get("enrollment_modes", []),
            "prices": parse_prices(
                program,
                program.get("enrollment_modes", []),
                fully_enrollable=True,
            ),
            "status": RunStatus.current.value
            if has_product_page
            else RunStatus.archived.value,
            "availability": program.get("availability"),
            "format": [Format.asynchronous.name],
            "pace": pace,
            "duration": program.get("duration") or "",
            "min_weeks": program.get("min_weeks"),
            "max_weeks": program.get("max_weeks"),
            "time_commitment": program.get("time_commitment") or "",
            "min_weekly_hours": parse_string_to_int(program.get("min_weekly_hours")),
            "max_weekly_hours": parse_string_to_int(program.get("max_weekly_hours")),
        }
        child_program_ids = get_program_ids_from_req_tree(program.get("req_tree", []))
        child_programs = []
        for pid in child_program_ids:
            if pid not in programs_by_id:
                log.warning(
                    "Program %s references missing child program id=%s in req_tree",
                    program.get("readable_id"),
                    pid,
                )
                continue
            child_programs.append(
                {
                    "readable_id": programs_by_id[pid]["readable_id"],
                    "display_mode": programs_by_id[pid].get("display_mode"),
                }
            )
        has_certification = parse_certification(OFFERED_BY["code"], [run])
        strip_enrollment_modes([run])
        yield {
            "readable_id": program["readable_id"],
            "title": program["title"],
            "offered_by": OFFERED_BY,
            "etl_source": ETLSource.mitxonline.name,
            "resource_type": LearningResourceType.program.name,
            # MITx Online programs with display_mode="course" are shown as
            # courses in the UI (single-course programs wrapped as programs
            # upstream but presented as standalone courses to learners).
            "resource_category": LearningResourceType.course.value
            if program.get("display_mode") == "course"
            else LearningResourceType.program.value,
            "departments": parse_departments(program.get("departments", [])),
            "platform": PlatformType.mitxonline.name,
            "professional": False,
            "certification": has_certification,
            "certification_type": parse_certificate_type(
                program.get("certificate_type", CertificationType.none.name)
            )
            if has_certification
            else CertificationType.none.name,
            "topics": transform_topics(program.get("topics", []), OFFERED_BY["code"]),
            "description": clean_data(parse_page_attribute(program, "description")),
            "url": learn_program_url,
            "image": _transform_image(program),
            "availability": program.get("availability"),
            "published": bool(
                has_product_page
                and parse_page_attribute(program, "live")
                and parse_page_attribute(program, "include_in_learn_catalog")
            ),
            "format": [Format.asynchronous.name],
            "pace": pace,
            "runs": [run],
            "courses": courses,
            "child_programs": child_programs,
        }
