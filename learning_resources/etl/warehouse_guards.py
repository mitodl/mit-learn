"""Checks and column readers shared by the warehouse-pull syncs.

Each sync treats its views as the complete current set and unpublishes what
they no longer list, so a view that is empty or partly built must not be loaded.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal

from dateutil.parser import parse

from learning_resources.etl.exceptions import ExtractException
from learning_resources.models import LearningResource


def utc_timestamp(value: str | datetime) -> datetime:
    """
    Read a warehouse timestamp as an aware datetime. The warehouse renders a
    UTC time as an ISO 8601 string that may carry no zone.
    """
    timestamp = value if isinstance(value, datetime) else parse(value)
    return timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=UTC)


def utc_timestamp_or_none(value: str | datetime | None) -> datetime | None:
    """Read a nullable warehouse timestamp"""
    return utc_timestamp(value) if value else None


def warehouse_list(value) -> list:
    """
    Read a warehouse array column. StarRocks sends an array over the MySQL
    protocol as JSON text; a null array is an empty list here. Decimals are
    read as Decimal, not float.
    """
    if value is None:
        return []
    if isinstance(value, str | bytes):
        return json.loads(value, parse_float=Decimal)
    return list(value)


# Largest share of a source's published resources of one type that a sync may
# unpublish. Day-to-day removals are a handful of resources.
MAX_UNPUBLISH_SHARE = 0.1


def refuse_mass_unpublish(
    etl_source: str,
    resource_type: str,
    kept_ids: set[str],
    *,
    field: str = "readable_id",
) -> None:
    """
    Raise if loading would unpublish more than MAX_UNPUBLISH_SHARE of the
    source's published resources of a type, i.e. if that share of them is
    missing from the ids the load will keep published. ``field`` is the
    LearningResource field the loader matches the source's resources on, and
    the one ``kept_ids`` holds.
    """
    published_ids = set(
        LearningResource.objects.filter(
            etl_source=etl_source, resource_type=resource_type, published=True
        ).values_list(field, flat=True)
    )
    missing = published_ids - kept_ids
    if len(missing) > len(published_ids) * MAX_UNPUBLISH_SHARE:
        msg = (
            f"Refusing to sync: {len(missing)} of {len(published_ids)} published "
            f"{etl_source} {resource_type} resources would be unpublished, "
            f"over the {MAX_UNPUBLISH_SHARE:.0%} limit. If they were removed "
            "at the source, rerun with allow_mass_unpublish=True."
        )
        raise ExtractException(msg)


def kept_course_ids(courses: list[dict]) -> set[str]:
    """
    Return the readable_ids of the transformed courses load_courses will leave
    published. upsert_course_or_program unpublishes a course with no runs, and
    the runs come from a view that can be built apart from the courses.
    """
    return {
        course["readable_id"]
        for course in courses
        if course["published"] and course["runs"]
    }


def refuse_empty(**views: list[dict]) -> None:
    """Raise if any of the named views returned no rows."""
    empty = [name for name, rows in views.items() if not rows]
    if empty:
        msg = (
            f"Refusing to sync: no rows in {', '.join(empty)}. Loading would "
            "unpublish what the empty view no longer lists."
        )
        raise ExtractException(msg)
