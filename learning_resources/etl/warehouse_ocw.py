"""Warehouse-pull loading of OCW courses.

The OL Data Platform's ``integrations__learn__ocw_courses`` view has one row
per course in the OCW live bucket, read from the course's published data.json,
with its one run in the same row. The functions here turn a row into what
``learning_resources.etl.ocw.transform_course`` builds from the data.json and
hand the courses to the loader the Celery ETL uses.

The sync is a full sync: the view is the complete current set, and courses
absent from it are unpublished. Unlike ``ocw.extract_course`` it does not skip
a course whose stored last_modified is not older: every listed course is
loaded on every run. Content files are not loaded here.
"""

import copy
import json

from learning_resources.constants import (
    Availability,
    Format,
    LearningResourceType,
    Pace,
    PlatformType,
    RunStatus,
)
from learning_resources.etl import loaders
from learning_resources.etl.constants import CourseLoaderConfig, ETLSource
from learning_resources.etl.ocw import OFFERED_BY, UNIQUE_FIELD, parse_delivery
from learning_resources.etl.ownership import may_write
from learning_resources.etl.utils import (
    generate_course_numbers_json,
    transform_levels,
    transform_topics,
)
from learning_resources.etl.warehouse_guards import (
    refuse_empty,
    refuse_mass_unpublish,
    utc_timestamp,
    warehouse_list,
)
from learning_resources.utils import parse_instructors
from main.utils import clean_data

COURSE = LearningResourceType.course.name


def _topics(row: dict) -> list[dict]:
    """
    Read the course's MIT Learn topics, or map its OCW topics as
    ocw.parse_learn_topics does when it has none
    """
    learn_topics = warehouse_list(row["topics"])
    if learn_topics:
        return [{"name": name} for name in learn_topics]
    return transform_topics(
        [{"name": name} for name in warehouse_list(row["ocw_topics"])],
        OFFERED_BY["code"],
    )


def transform_run(row: dict) -> dict:
    """
    Transform a row of integrations__learn__ocw_courses into the run
    ocw.transform_run builds

    Args:
        row (dict): the course

    Returns:
        dict: the run as load_run takes it
    """
    return {
        "run_id": row["run_id"],
        "published": True,
        "instructors": parse_instructors(json.loads(row["instructors"])),
        "description": clean_data(row["description"]),
        "year": row["year"],
        "semester": row["term"],
        "status": RunStatus.current.value,
        "image": {
            "url": row["image_url"],
            "description": row["image_description"] or "",
            "alt": row["image_alt"] or "",
        },
        "level": transform_levels(warehouse_list(row["level"])),
        "last_modified": utc_timestamp(row["last_modified"]),
        "title": row["title"],
        "slug": row["slug"],
        "url": row["url"],
        "availability": Availability.anytime.name,
        "delivery": parse_delivery(row),
        "format": [Format.asynchronous.name],
        "pace": [Pace.self_paced.name],
    }


def transform_course(row: dict) -> dict:
    """
    Transform a row of integrations__learn__ocw_courses into the course
    ocw.transform_course builds

    Args:
        row (dict): the course

    Returns:
        dict: the course as load_course takes it
    """
    return {
        "readable_id": row["readable_id"],
        "offered_by": copy.deepcopy(OFFERED_BY),
        "platform": PlatformType.ocw.name,
        "etl_source": ETLSource.ocw.name,
        "title": row["title"],
        "departments": warehouse_list(row["departments"]),
        "content_tags": warehouse_list(row["content_tags"]),
        "image": {
            "url": row["image_url"],
            "description": row["image_description"],
            "alt": row["image_alt"],
        },
        "description": clean_data(row["description"]),
        "url": row["url"],
        "last_modified": utc_timestamp(row["last_modified"]),
        "published": True,
        "course": {
            "course_numbers": generate_course_numbers_json(
                row["course_number"],
                extra_nums=warehouse_list(row["extra_course_numbers"]),
                is_ocw=True,
            ),
        },
        "topics": _topics(row),
        "ocw_topics": warehouse_list(row["ocw_topics"]),
        "runs": [transform_run(row)],
        "resource_type": COURSE,
        "unique_field": UNIQUE_FIELD,
        "availability": Availability.anytime.name,
        "delivery": parse_delivery(row),
        "license_cc": True,
        "format": [Format.asynchronous.name],
        "pace": [Pace.self_paced.name],
    }


def sync_courses(courses: list[dict], *, allow_mass_unpublish: bool = False) -> int:
    """
    Load the courses of the warehouse view, and unpublish the courses it no
    longer lists.

    Args:
        courses (list of dict): rows of integrations__learn__ocw_courses
        allow_mass_unpublish (bool): skip the MAX_UNPUBLISH_SHARE check

    Returns:
        int: the number of courses loaded
    """
    if not may_write(ETLSource.ocw.name, COURSE):
        return 0

    refuse_empty(courses=courses)
    courses_data = [transform_course(course) for course in courses]
    if not allow_mass_unpublish:
        refuse_mass_unpublish(
            ETLSource.ocw.name,
            COURSE,
            {course["readable_id"] for course in courses_data},
        )
    return len(
        loaders.load_courses(
            ETLSource.ocw.name, courses_data, config=CourseLoaderConfig(prune=True)
        )
    )
