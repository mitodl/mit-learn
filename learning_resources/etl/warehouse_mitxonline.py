"""Warehouse-pull loading of MITx Online courses and programs.

The OL Data Platform's ``integrations__learn__mitxonline_courses``, ``_runs``,
``_programs`` and ``_program_children`` views hold what MITx Online's catalog
API returns, one flat row per course, run, program or program child, with the
API's rules for what is listed and the MITx Online ETL's rules for what is
published, priced and current. The functions here turn those rows into what
``learning_resources.etl.mitxonline`` produces from the API, and hand them to
the same loaders the Celery ETL uses.

Each sync is a full sync: the views are the complete current set, and courses,
runs and programs absent from them are unpublished.
"""

import copy
import json
import logging
from collections import defaultdict
from decimal import Decimal

import nh3

from learning_resources.constants import (
    CertificationType,
    Format,
    LearningResourceType,
    PlatformType,
    RunStatus,
)
from learning_resources.etl import loaders
from learning_resources.etl.constants import (
    CourseLoaderConfig,
    ETLSource,
    ProgramLoaderConfig,
)
from learning_resources.etl.mitxonline import (
    CMS_PAGE_KEY,
    OFFERED_BY,
    _learn_product_url_for_mitx_course,
    _learn_product_url_for_mitx_program,
    parse_certificate_type,
    parse_departments,
    parse_full_description,
)
from learning_resources.etl.ownership import RunMode, run_mode
from learning_resources.etl.utils import (
    generate_course_numbers_json,
    parse_string_to_int,
    transform_price,
    transform_topics,
)
from learning_resources.etl.warehouse_guards import (
    kept_course_ids,
    refuse_empty,
    refuse_mass_unpublish,
    utc_timestamp_or_none,
    warehouse_list,
)
from main.utils import clean_data

log = logging.getLogger(__name__)

COURSE = LearningResourceType.course.name
PROGRAM = LearningResourceType.program.name


def _description(value: str | None) -> str:
    """
    Clean a page description as the API ETL does. The view has the stored
    HTML, and MITx Online's API strips every tag from it (bleach with no
    allowed tags) before MIT Learn's clean_data sees it.
    """
    return clean_data(nh3.clean(value, tags=set())) if value else ""


def _topics(row: dict) -> list[dict]:
    """Map the row's topic names as transform_topics maps the API's"""
    return transform_topics(
        [{"name": name} for name in warehouse_list(row["topics"])],
        OFFERED_BY["code"],
    )


def _image(row: dict) -> dict | None:
    """Build the image the API ETL builds from the page's feature image"""
    return {"url": row["image_url"]} if row["image_url"] else None


def _prices(row: dict) -> list[dict]:
    """Build the prices parse_prices builds, from the view's amounts"""
    return [transform_price(Decimal(price)) for price in warehouse_list(row["prices"])]


def _certification_type(row: dict) -> str:
    """Map the certificate type, which counts only for a certificate offer"""
    if row["certification"]:
        return parse_certificate_type(row["certification_type"])
    return CertificationType.none.name


def _full_description(row: dict) -> dict:
    """
    Build full_description from the product page's sections as the API ETL
    does. MITx Online's pages API lists a page to MIT Learn only when it is
    live and in the Learn catalog (has_catalog_page), and the API ETL leaves
    the stored value alone for a page it does not see, so the key is left out.
    """
    if not row["has_catalog_page"]:
        return {}
    page = {
        "about": row["about"],
        "what_you_learn": row["what_you_learn"],
        "prerequisites": row["prerequisites"],
        "faqs": json.loads(row["faqs"]),
    }
    return {"full_description": parse_full_description({CMS_PAGE_KEY: page})}


def _page_fields(row: dict) -> dict:
    """Build the fields the API ETL copies from a course or program to its run"""
    return {
        "availability": row["availability"],
        "format": [Format.asynchronous.name],
        "duration": row["duration"] or "",
        "min_weeks": row["min_weeks"],
        "max_weeks": row["max_weeks"],
        "time_commitment": row["time_commitment"] or "",
        "min_weekly_hours": parse_string_to_int(row["min_weekly_hours"]),
        "max_weekly_hours": parse_string_to_int(row["max_weekly_hours"]),
    }


def _resource_fields(row: dict) -> dict:
    """Build the fields a course and a program share"""
    return {
        "readable_id": row["readable_id"],
        "platform": PlatformType.mitxonline.name,
        "etl_source": ETLSource.mitxonline.name,
        "title": row["title"],
        "offered_by": copy.deepcopy(OFFERED_BY),
        "topics": _topics(row),
        "departments": parse_departments(warehouse_list(row["departments"])),
        # StarRocks returns a boolean column as 0 or 1, and the loaders test
        # published and certification with `is False`
        "published": bool(row["published"]),
        "professional": False,
        "certification": bool(row["certification"]),
        "certification_type": _certification_type(row),
        "image": _image(row),
        "description": _description(row["description"]),
        **_full_description(row),
        "availability": row["availability"],
        "format": [Format.asynchronous.name],
    }


def transform_run(row: dict, course_row: dict) -> dict:
    """
    Transform a row of integrations__learn__mitxonline_runs into the run
    mitxonline._transform_run builds

    Args:
        row (dict): the run
        course_row (dict): the run's row of integrations__learn__mitxonline_courses

    Returns:
        dict: the run as load_run takes it
    """
    return {
        "title": row["title"],
        "run_id": row["run_id"],
        "start_date": utc_timestamp_or_none(row["start_date"]),
        "end_date": utc_timestamp_or_none(row["end_date"]),
        "enrollment_start": utc_timestamp_or_none(row["enrollment_start"]),
        "enrollment_end": utc_timestamp_or_none(row["enrollment_end"]),
        "url": _learn_product_url_for_mitx_course(
            course_row["readable_id"], has_product_page=course_row["has_page"]
        ),
        "published": bool(row["published"]),
        "b2b_only": bool(row["b2b_only"]),
        "is_variant": bool(row["is_variant"]),
        # The API lists a run without a page, so the API ETL gives it no
        # description or image of its own
        "description": "",
        "image": None,
        "prices": _prices(row),
        "instructors": [
            {"full_name": name} for name in warehouse_list(row["instructors"])
        ],
        "status": row["status"],
        "pace": [row["pace"]],
        **_page_fields(course_row),
    }


def transform_course(row: dict, run_rows: list[dict]) -> dict:
    """
    Transform a row of integrations__learn__mitxonline_courses and its runs
    into the course mitxonline._transform_course builds

    Args:
        row (dict): the course
        run_rows (list of dict): its rows of integrations__learn__mitxonline_runs

    Returns:
        dict: the course as load_course takes it
    """
    course_numbers = warehouse_list(row["course_numbers"])
    return {
        **_resource_fields(row),
        "resource_type": COURSE,
        "runs": [transform_run(run, row) for run in run_rows],
        "force_ingest": bool(row["ingest_content_files_for_ai"]),
        "course": {
            "course_numbers": generate_course_numbers_json(
                course_numbers[0], extra_nums=course_numbers[1:], is_ocw=False
            )
            if course_numbers
            else [],
        },
        "url": _learn_product_url_for_mitx_course(
            row["readable_id"], has_product_page=row["has_page"]
        ),
        "pace": sorted({run["pace"] for run in run_rows}),
    }


def transform_program(
    row: dict, children: list[dict], course_paces: dict[str, list[str]]
) -> dict:
    """
    Transform a row of integrations__learn__mitxonline_programs and its
    children into the program mitxonline.transform_programs builds

    Args:
        row (dict): the program
        children (list of dict): its rows of
            integrations__learn__mitxonline_program_children
        course_paces (dict): the pace column of
            integrations__learn__mitxonline_courses by readable id

    Returns:
        dict: the program as load_program takes it
    """
    children = sorted(
        children,
        # A child program not shown as a course has no position, and the
        # loader numbers those in list order
        key=lambda child: (
            child["child_position"] is None,
            child["child_position"] or 0,
            child["child_readable_id"],
        ),
    )
    course_ids = [
        child["child_readable_id"]
        for child in children
        if child["child_resource_type"] == COURSE
    ]
    pace = sorted(
        {pace for course_id in course_ids for pace in course_paces[course_id]}
    )
    url = _learn_product_url_for_mitx_program(
        row["readable_id"], row["display_mode"], has_product_page=row["has_page"]
    )
    description = _description(row["description"])
    return {
        **_resource_fields(row),
        "resource_type": PROGRAM,
        # A program with display_mode "course" is shown as a course
        "resource_category": LearningResourceType.course.value
        if row["display_mode"] == "course"
        else LearningResourceType.program.value,
        "url": url,
        "pace": pace,
        "runs": [
            {
                "run_id": row["readable_id"],
                "enrollment_start": utc_timestamp_or_none(row["enrollment_start"]),
                "enrollment_end": utc_timestamp_or_none(row["enrollment_end"]),
                "start_date": utc_timestamp_or_none(row["start_date"]),
                "end_date": utc_timestamp_or_none(row["end_date"]),
                "title": row["title"],
                "published": bool(row["has_page"]),
                "url": url,
                "image": _image(row),
                "description": description,
                "prices": _prices(row),
                "status": RunStatus.current.value
                if row["has_page"]
                else RunStatus.archived.value,
                "pace": pace,
                **_page_fields(row),
            }
        ],
        # Loaded with fetch_only, so only what finds the course is needed
        "courses": [
            {
                "readable_id": child["child_readable_id"],
                "platform": PlatformType.mitxonline.name,
                "resource_type": COURSE,
                "position": child["child_position"],
            }
            for child in children
            if child["child_resource_type"] == COURSE
        ],
        "child_programs": [
            {
                "readable_id": child["child_readable_id"],
                "display_mode": child["child_display_mode"],
                "position": child["child_position"],
            }
            for child in children
            if child["child_resource_type"] == PROGRAM
        ],
    }


def sync_courses(
    courses: list[dict], runs: list[dict], *, allow_mass_unpublish: bool = False
) -> int:
    """
    Load the courses and runs of the warehouse views, and unpublish the
    courses and runs they no longer list.

    Args:
        courses (list of dict): rows of integrations__learn__mitxonline_courses
        runs (list of dict): rows of integrations__learn__mitxonline_runs
        allow_mass_unpublish (bool): skip the MAX_UNPUBLISH_SHARE check

    Returns:
        int: the number of courses loaded
    """
    if run_mode(ETLSource.mitxonline.name, COURSE) == RunMode.SKIP:
        return 0

    refuse_empty(courses=courses, runs=runs)
    runs_by_course = defaultdict(list)
    for run in runs:
        runs_by_course[run["readable_id"]].append(run)

    courses_data = [
        transform_course(course, runs_by_course[course["readable_id"]])
        for course in courses
    ]
    if not allow_mass_unpublish:
        refuse_mass_unpublish(
            ETLSource.mitxonline.name, COURSE, kept_course_ids(courses_data)
        )
    return len(
        loaders.load_courses(
            ETLSource.mitxonline.name,
            courses_data,
            config=CourseLoaderConfig(prune=True),
        )
    )


def sync_programs(
    programs: list[dict],
    children: list[dict],
    courses: list[dict],
    *,
    allow_mass_unpublish: bool = False,
) -> int:
    """
    Load the programs of the warehouse view, and unpublish the programs it no
    longer lists.

    Args:
        programs (list of dict): rows of integrations__learn__mitxonline_programs
        children (list of dict): rows of
            integrations__learn__mitxonline_program_children
        courses (list of dict): rows of integrations__learn__mitxonline_courses,
            for the pace of a program's courses
        allow_mass_unpublish (bool): skip the MAX_UNPUBLISH_SHARE check

    Returns:
        int: the number of programs loaded
    """
    if run_mode(ETLSource.mitxonline.name, PROGRAM) == RunMode.SKIP:
        return 0

    refuse_empty(programs=programs, program_children=children, courses=courses)
    children_by_program = defaultdict(list)
    for child in children:
        children_by_program[child["readable_id"]].append(child)
    course_paces = {
        course["readable_id"]: warehouse_list(course["pace"]) for course in courses
    }

    programs_data = [
        transform_program(
            program, children_by_program[program["readable_id"]], course_paces
        )
        for program in programs
    ]
    if not allow_mass_unpublish:
        refuse_mass_unpublish(
            ETLSource.mitxonline.name,
            PROGRAM,
            {
                program["readable_id"]
                for program in programs_data
                if program["published"]
            },
        )
    return len(
        loaders.load_programs(
            ETLSource.mitxonline.name,
            programs_data,
            config=ProgramLoaderConfig(
                courses=CourseLoaderConfig(fetch_only=True), prune=True
            ),
        )
    )
