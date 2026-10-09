"""Checks shared by the warehouse-pull syncs before they load a full set.

Each sync treats its views as the complete current set and unpublishes what
they no longer list, so a view that is empty or partly built must not be loaded.
"""

from datetime import UTC, datetime

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


# Largest share of a source's published resources of one type that a sync may
# unpublish. Day-to-day removals are a handful of resources.
MAX_UNPUBLISH_SHARE = 0.1


def refuse_mass_unpublish(
    etl_source: str, resource_type: str, pulled_ids: set[str]
) -> None:
    """
    Raise if loading would unpublish more than MAX_UNPUBLISH_SHARE of the
    source's published resources of a type, i.e. if that share of them is
    missing from the ids pulled.
    """
    published_ids = set(
        LearningResource.objects.filter(
            etl_source=etl_source, resource_type=resource_type, published=True
        ).values_list("readable_id", flat=True)
    )
    missing = published_ids - pulled_ids
    if len(missing) > len(published_ids) * MAX_UNPUBLISH_SHARE:
        msg = (
            f"Refusing to sync: {len(missing)} of {len(published_ids)} published "
            f"{etl_source} {resource_type} resources are not in the warehouse "
            f"views, over the {MAX_UNPUBLISH_SHARE:.0%} limit. If they were "
            "removed at the source, rerun with allow_mass_unpublish=True."
        )
        raise ExtractException(msg)


def refuse_empty(**views: list[dict]) -> None:
    """Raise if any of the named views returned no rows."""
    empty = [name for name, rows in views.items() if not rows]
    if empty:
        msg = (
            f"Refusing to sync: no rows in {', '.join(empty)}. Loading would "
            "unpublish what the empty view no longer lists."
        )
        raise ExtractException(msg)
