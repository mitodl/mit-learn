"""Warehouse-pull loading of xPRO courses and programs.

The OL Data Platform's ``integrations__learn__xpro_courses``, ``_runs`` and
``_programs`` views hold what xPRO's catalog API returns, one flat row per
course, run or program, with the API's own rules for what is listed. The
functions here turn those rows into what ``learning_resources.etl.xpro``
produces from the API, and hand them to the same loaders the Celery ETL uses.

Each sync is a full sync: the views are the complete current set, and courses,
runs and programs absent from them are unpublished.
"""

import copy
import json
import logging
from collections import defaultdict
from decimal import Decimal

from learning_resources.constants import (
    CertificationType,
    Format,
    LearningResourceType,
    Pace,
)
from learning_resources.etl import loaders
from learning_resources.etl.constants import (
    CourseLoaderConfig,
    ETLSource,
    ProgramLoaderConfig,
)
from learning_resources.etl.ownership import may_write
from learning_resources.etl.utils import (
    generate_course_numbers_json,
    transform_delivery,
    transform_price,
)
from learning_resources.etl.warehouse_guards import (
    refuse_empty,
    refuse_mass_unpublish,
    utc_timestamp,
)
from learning_resources.etl.xpro import (
    OFFERED_BY,
    XPRO_PLATFORM_TRANSFORM,
    parse_topics,
)
from learning_resources.models import LearningResource
from main.utils import clean_data

log = logging.getLogger(__name__)

COURSE = LearningResourceType.course.name
PROGRAM = LearningResourceType.program.name


def _string_list(value) -> list[str]:
    """
    Read a warehouse array(varchar) column. StarRocks sends an array over the
    MySQL protocol as JSON text; a null array is an empty list here.
    """
    if value is None:
        return []
    if isinstance(value, str | bytes):
        return json.loads(value)
    return list(value)


def _timestamp(value):
    """Read a nullable warehouse timestamp"""
    return utc_timestamp(value) if value else None


def _topics(row: dict) -> list[dict]:
    """Map the row's xPRO topic names as parse_topics maps the API's"""
    return parse_topics(
        {"topics": [{"name": name} for name in _string_list(row["topics"])]}
    )


def _prices(price) -> list[dict]:
    """Build a run's prices as the API ETL does, empty when it has none"""
    return [transform_price(Decimal(price))] if price else []


def _page_fields(row: dict) -> dict:
    """Build the fields the API ETL copies from a course or program to its run"""
    return {
        "delivery": transform_delivery(row["format"]),
        "availability": row["availability"],
        "pace": [Pace.self_paced.name],
        "format": [Format.asynchronous.name],
        "duration": row["duration"] or "",
        "min_weeks": row["min_weeks"],
        "max_weeks": row["max_weeks"],
        "time_commitment": row["time_commitment"] or "",
        "min_weekly_hours": row["min_weekly_hours"],
        "max_weekly_hours": row["max_weekly_hours"],
    }


def _resource_fields(row: dict) -> dict:
    """Build the fields a course and a program share"""
    return {
        "readable_id": row["readable_id"],
        "platform": XPRO_PLATFORM_TRANSFORM.get(row["platform"]),
        "etl_source": ETLSource.xpro.name,
        "title": row["title"],
        "image": {"url": row["image_url"]},
        "offered_by": copy.deepcopy(OFFERED_BY),
        "professional": True,
        "description": clean_data(row["description"]),
        "url": row["url"],
        "topics": _topics(row),
        "delivery": transform_delivery(row["format"]),
        "certification": True,
        "certification_type": CertificationType.professional.name,
        "availability": row["availability"],
        "continuing_ed_credits": row["continuing_ed_credits"],
        "pace": [Pace.self_paced.name],
        "format": [Format.asynchronous.name],
    }


def transform_run(row: dict, course_row: dict) -> dict:
    """
    Transform a row of integrations__learn__xpro_runs into the run
    xpro._transform_run builds

    Args:
        row (dict): the run
        course_row (dict): the run's row of integrations__learn__xpro_courses

    Returns:
        dict: the run as load_run takes it
    """
    return {
        "run_id": row["run_id"],
        "title": row["title"],
        "start_date": _timestamp(row["start_date"] or row["enrollment_start"]),
        "end_date": _timestamp(row["end_date"]),
        "enrollment_start": _timestamp(row["enrollment_start"]),
        "enrollment_end": _timestamp(row["enrollment_end"]),
        "published": bool(row["price"]),
        "prices": _prices(row["price"]),
        "instructors": [
            {"full_name": name} for name in _string_list(row["instructors"])
        ],
        **_page_fields(course_row),
    }


def transform_course(row: dict, run_rows: list[dict]) -> dict:
    """
    Transform a row of integrations__learn__xpro_courses and its runs into the
    course xpro._transform_learning_resource_course builds

    Args:
        row (dict): the course
        run_rows (list of dict): its rows of integrations__learn__xpro_runs

    Returns:
        dict: the course as load_course takes it
    """
    return {
        **_resource_fields(row),
        "published": any(run["price"] for run in run_rows),
        "runs": [transform_run(run, row) for run in run_rows],
        "resource_type": COURSE,
        "course": {
            "course_numbers": generate_course_numbers_json(
                row["readable_id"], is_ocw=False
            ),
        },
    }


def transform_program(row: dict, course_platforms: dict[str, str]) -> dict:
    """
    Transform a row of integrations__learn__xpro_programs into the program
    xpro.transform_programs builds

    Args:
        row (dict): the program
        course_platforms (dict): platform code by readable id of the xPRO
            courses MIT Learn has, to find the program's courses by

    Returns:
        dict: the program as load_program takes it
    """
    course_ids = [
        course_id.strip()
        for course_id in (row["courses"] or "").split(",")
        if course_id.strip()
    ]
    return {
        **_resource_fields(row),
        "published": bool(row["price"]),
        "resource_type": PROGRAM,
        "runs": [
            {
                "prices": _prices(row["price"]),
                "title": row["title"],
                "run_id": row["readable_id"],
                "enrollment_start": _timestamp(row["enrollment_start"]),
                "start_date": _timestamp(row["start_date"] or row["enrollment_start"]),
                "end_date": _timestamp(row["end_date"]),
                "description": row["description"],
                "instructors": [
                    {"full_name": name} for name in _string_list(row["instructors"])
                ],
                **_page_fields(row),
            }
        ],
        # Loaded with fetch_only, so only what finds the course is needed. A
        # course MIT Learn does not have is one the loader would not find.
        "courses": [
            {
                "readable_id": course_id,
                "platform": course_platforms[course_id],
                "resource_type": COURSE,
            }
            for course_id in course_ids
            if course_id in course_platforms
        ],
    }


def sync_courses(
    courses: list[dict], runs: list[dict], *, allow_mass_unpublish: bool = False
) -> int:
    """
    Load the courses and runs of the warehouse views, and unpublish the
    courses and runs they no longer list.

    Args:
        courses (list of dict): rows of integrations__learn__xpro_courses
        runs (list of dict): rows of integrations__learn__xpro_runs
        allow_mass_unpublish (bool): skip the MAX_UNPUBLISH_SHARE check

    Returns:
        int: the number of courses loaded
    """
    if not may_write(ETLSource.xpro.name, COURSE):
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
            ETLSource.xpro.name,
            COURSE,
            {course["readable_id"] for course in courses_data if course["published"]},
        )
    return len(
        loaders.load_courses(
            ETLSource.xpro.name, courses_data, config=CourseLoaderConfig(prune=True)
        )
    )


def sync_programs(programs: list[dict], *, allow_mass_unpublish: bool = False) -> int:
    """
    Load the programs of the warehouse view, and unpublish the programs it no
    longer lists.

    Args:
        programs (list of dict): rows of integrations__learn__xpro_programs
        allow_mass_unpublish (bool): skip the MAX_UNPUBLISH_SHARE check

    Returns:
        int: the number of programs loaded
    """
    if not may_write(ETLSource.xpro.name, PROGRAM):
        return 0

    refuse_empty(programs=programs)
    course_platforms = dict(
        LearningResource.objects.filter(
            etl_source=ETLSource.xpro.name, resource_type=COURSE
        ).values_list("readable_id", "platform__code")
    )
    programs_data = [
        transform_program(program, course_platforms) for program in programs
    ]
    if not allow_mass_unpublish:
        refuse_mass_unpublish(
            ETLSource.xpro.name,
            PROGRAM,
            {
                program["readable_id"]
                for program in programs_data
                if program["published"]
            },
        )
    return len(
        loaders.load_programs(
            ETLSource.xpro.name,
            programs_data,
            config=ProgramLoaderConfig(
                courses=CourseLoaderConfig(fetch_only=True), prune=True
            ),
        )
    )
