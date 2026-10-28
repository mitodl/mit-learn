"""Warehouse-pull loading of OCW courses.

The OL Data Platform's ``integrations__learn__ocw_courses`` view has one row
per course in the OCW live bucket, read from the course's published data.json,
with its one run in the same row. The functions here turn a row into what
``learning_resources.etl.ocw.transform_course`` builds from the data.json and
hand the courses to the loader the Celery ETL uses.

The sync reads the whole view: it is the complete current set, and courses
absent from it are unpublished. A course is loaded only when the hash of its
transformed row differs from the one stored with it (``etl_checksum``), so a
daily run writes and reindexes only the courses that changed. Any other load of
a course clears its hash. Content files are not loaded here.
"""

import copy
import json
import logging

from django.db.models import Q

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
from learning_resources.etl.exceptions import ExtractException
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
from learning_resources.models import LearningResource
from learning_resources.utils import parse_instructors
from main.utils import checksum_for_content, clean_data

log = logging.getLogger(__name__)

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


def course_checksum(course: dict) -> str:
    """Hash a transformed course, to tell whether the stored course matches it"""
    return checksum_for_content(json.dumps(course, sort_keys=True, default=str))


def sync_courses(courses: list[dict], *, allow_mass_unpublish: bool = False) -> int:
    """
    Load the courses of the warehouse view that changed since they were last
    loaded, and unpublish the courses it no longer lists.

    A row that fails to transform or load is logged and the others still load.
    It stays published, since it is still in the view, and the sync raises once
    the rest are done.

    Args:
        courses (list of dict): rows of integrations__learn__ocw_courses
        allow_mass_unpublish (bool): skip the MAX_UNPUBLISH_SHARE check

    Returns:
        int: the number of courses loaded
    """
    if not may_write(ETLSource.ocw.name, COURSE):
        return 0

    refuse_empty(courses=courses)
    view_urls = {course[UNIQUE_FIELD] for course in courses}
    if not allow_mass_unpublish:
        refuse_mass_unpublish(ETLSource.ocw.name, COURSE, view_urls, field=UNIQUE_FIELD)

    ocw_courses = LearningResource.objects.filter(
        etl_source=ETLSource.ocw.name, resource_type=COURSE
    )
    # An unpublished course is reloaded whatever its hash, so it is republished
    stored_checksums = dict(
        ocw_courses.filter(published=True).values_list(UNIQUE_FIELD, "etl_checksum")
    )
    loaded = 0
    failed = []
    for row in courses:
        try:
            course = transform_course(row)
            course["etl_checksum"] = course_checksum(course)
            if stored_checksums.get(row[UNIQUE_FIELD]) == course["etl_checksum"]:
                continue
            if loaders.load_course(course, config=CourseLoaderConfig(prune=True)):
                loaded += 1
        except Exception:
            log.exception("Error loading OCW course %s", row[UNIQUE_FIELD])
            failed.append(row[UNIQUE_FIELD])
            # Indexing runs after the load commits, so a course whose indexing
            # failed has its new hash stored and would be skipped next time
            ocw_courses.filter(url=row[UNIQUE_FIELD]).update(etl_checksum=None)

    loaders.unpublish_resources(
        ocw_courses.exclude(Q(url__in=view_urls) | Q(test_mode=True))
    )
    if failed:
        msg = f"{len(failed)} OCW courses failed to load: {', '.join(failed)}"
        raise ExtractException(msg)
    return loaded
