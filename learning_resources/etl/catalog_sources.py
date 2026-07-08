"""Transform functions for Cohort 1 warehouse-pull catalog sources.

Each ``transform_*`` function maps one row of an
``integrations__learn__*`` warehouse view (queried via
``learning_resources.lib.warehouse``; see ol-data-platform's
``src/ol_dbt/models/integrations/learn/`` for the view definitions) into the
course/program dict shape expected by ``learning_resources.etl.loaders``.
These functions operate on plain row dicts and have no dependency on the
query engine (Trino today) behind them. The views deliberately expose a
flattened contract (delimited strings instead of nested JSON) so detail
that the platform can't or doesn't compute — per-run pricing, certification
eligibility, program requirement trees — is intentionally left untouched
(via loaders.load_run's `None`-means-"not provided" sentinel, not `[]`)
rather than reconstructed here, so a sync doesn't wipe values the
API-based ETL already set.
"""

from datetime import UTC

from dateutil.parser import parse

from learning_resources.constants import (
    LearningResourceType,
    OfferedBy,
    PlatformType,
)
from learning_resources.etl.constants import XPRO_PLATFORM_TRANSFORM, ETLSource
from learning_resources.etl.micromasters import (
    READABLE_ID_PREFIX as MICROMASTERS_READABLE_ID_PREFIX,
)
from learning_resources.etl.utils import (
    generate_course_numbers_json,
    get_department_id_by_name,
    transform_topics,
)
from main.utils import clean_data


def _split(value: str | None, sep: str = ",") -> list[str]:
    """Split a delimited string column into stripped, non-empty parts.

    Defaults to a plain comma (matching the split convention used elsewhere
    in learning_resources.etl, e.g. ocw.py/podcast.py/sloan.py) rather than
    the ol-data-platform views' actual ``", "`` array_join separator —
    per-part ``.strip()`` makes the two equivalent for well-formed input,
    and the plain comma is also correct if a view ever emits "a,b" without
    the space.
    """
    if not value:
        return []
    return [part.strip() for part in value.split(sep) if part.strip()]


def _parse_bool(value) -> bool:
    # Trino returns native bools; StarRocks (MySQL wire protocol, the
    # planned next backend per learning_resources.lib.warehouse) returns
    # 1/0 for BOOLEAN columns, which `str(1).lower() == "true"` would
    # silently treat as False for every row.
    if isinstance(value, bool | int):
        return bool(value)
    return str(value).strip().lower() == "true"


def _parse_datetime(value):
    """Parse a warehouse datetime string (matches mitxonline.py/xpro.py)."""
    if not value:
        return None
    try:
        return parse(value).replace(tzinfo=UTC)
    except (ValueError, TypeError, OverflowError):
        return None


def _image(url: str | None) -> dict | None:
    return {"url": url} if url else None


def _topics(value: str | None, offeror_code: str) -> list[dict]:
    return transform_topics([{"name": name} for name in _split(value)], offeror_code)


def _instructors(value: str | None) -> list[dict]:
    return [{"full_name": name} for name in _split(value)]


def _parse_runs(value: str | None, title: str, instructors: list[dict]) -> list[dict]:
    """Parse ``run_id|start_on|end_on|is_live`` strings joined by ``;``."""
    runs = []
    for chunk in _split(value, sep=";"):
        parts = chunk.split("|")
        if len(parts) != 4:  # noqa: PLR2004
            continue
        run_id, start_on, end_on, is_live = parts
        if not run_id:
            continue
        runs.append(
            {
                "run_id": run_id,
                "title": title,
                "published": _parse_bool(is_live),
                "start_date": _parse_datetime(start_on),
                "end_date": _parse_datetime(end_on),
                "instructors": instructors,
                # The views expose no pricing data. `None` (loaders.load_run's
                # sentinel for "not provided, leave alone") rather than `[]`
                # so a warehouse sync doesn't wipe prices the API-based ETL
                # already populated for this run.
                "prices": None,
            }
        )
    return runs


def _course_stub(readable_id: str, platform: str) -> dict:
    """Minimal course dict for program->course linking (config.fetch_only=True)."""
    return {"readable_id": readable_id, "platform": platform}


def _program_run(run_id: str, title: str, row: dict) -> dict:
    return {
        "run_id": run_id,
        "title": title,
        "published": _parse_bool(row.get("published")),
        "url": row.get("url"),
        # No instructor/price data in the views for program runs either;
        # see the comment on `_parse_runs`'s "prices" key above.
        "instructors": None,
        "prices": None,
    }


# ---------------------------------------------------------------------------
# MITx Online
# ---------------------------------------------------------------------------


def transform_mitxonline_course(row: dict) -> dict:
    """Transform an integrations__learn__mitxonline_courses row."""
    title = row["title"]
    instructors = _instructors(row.get("instructors"))
    return {
        "readable_id": row["readable_id"],
        "platform": PlatformType.mitxonline.name,
        "etl_source": ETLSource.mitxonline.name,
        "resource_type": LearningResourceType.course.name,
        "title": title,
        "offered_by": {"code": OfferedBy.mitx.name},
        "topics": _topics(row.get("topics"), OfferedBy.mitx.name),
        "runs": _parse_runs(row.get("runs"), title, instructors),
        "course": {
            "course_numbers": generate_course_numbers_json(
                row["readable_id"], is_ocw=False
            ),
        },
        "published": _parse_bool(row.get("published")),
        "image": _image(row.get("image_url")),
        "url": row.get("url"),
        "description": clean_data(row.get("description")),
    }


def transform_mitxonline_program(row: dict) -> dict:
    """Transform an integrations__learn__mitxonline_programs row."""
    title = row["title"]
    return {
        "readable_id": row["readable_id"],
        "platform": PlatformType.mitxonline.name,
        "etl_source": ETLSource.mitxonline.name,
        "resource_type": LearningResourceType.program.name,
        "title": title,
        "offered_by": {"code": OfferedBy.mitx.name},
        "topics": _topics(row.get("topics"), OfferedBy.mitx.name),
        "courses": [
            _course_stub(course_id, PlatformType.mitxonline.name)
            for course_id in _split(row.get("courses"))
        ],
        "runs": [_program_run(row["readable_id"], title, row)],
        "published": _parse_bool(row.get("published")),
        "image": _image(row.get("image_url")),
        "url": row.get("url"),
        "description": clean_data(row.get("description")),
    }


# ---------------------------------------------------------------------------
# xPRO
# ---------------------------------------------------------------------------


def _xpro_platform(row: dict) -> str:
    return XPRO_PLATFORM_TRANSFORM.get(row.get("platform"), PlatformType.xpro.name)


def transform_xpro_course(row: dict) -> dict:
    """Transform an integrations__learn__xpro_courses row."""
    title = row["title"]
    instructors = _instructors(row.get("instructors"))
    platform = _xpro_platform(row)
    return {
        "readable_id": row["readable_id"],
        "platform": platform,
        "etl_source": ETLSource.xpro.name,
        "resource_type": LearningResourceType.course.name,
        "title": title,
        "offered_by": {"code": OfferedBy.xpro.name},
        "topics": _topics(row.get("topics"), OfferedBy.xpro.name),
        "runs": _parse_runs(row.get("runs"), title, instructors),
        "course": {
            "course_numbers": generate_course_numbers_json(
                row["readable_id"], is_ocw=False
            ),
        },
        "published": _parse_bool(row.get("published")),
        "image": _image(row.get("image_url")),
        "url": row.get("url"),
        "description": clean_data(row.get("description")),
    }


def transform_xpro_program(row: dict) -> dict:
    """Transform an integrations__learn__xpro_programs row."""
    title = row["title"]
    platform = _xpro_platform(row)
    return {
        "readable_id": row["readable_id"],
        "platform": platform,
        "etl_source": ETLSource.xpro.name,
        "resource_type": LearningResourceType.program.name,
        "title": title,
        "offered_by": {"code": OfferedBy.xpro.name},
        "topics": _topics(row.get("topics"), OfferedBy.xpro.name),
        "courses": [
            _course_stub(course_id, platform)
            for course_id in _split(row.get("courses"))
        ],
        "runs": [_program_run(row["readable_id"], title, row)],
        "published": _parse_bool(row.get("published")),
        "image": _image(row.get("image_url")),
        "url": row.get("url"),
        "description": clean_data(row.get("description")),
    }


# ---------------------------------------------------------------------------
# MIT edX (edx.org)
# ---------------------------------------------------------------------------


def transform_mit_edx_course(row: dict) -> dict:
    """Transform an integrations__learn__mit_edx_courses row."""
    title = row["title"]
    instructors = _instructors(row.get("instructors"))
    return {
        "readable_id": row["readable_id"],
        "platform": PlatformType.edx.name,
        "etl_source": ETLSource.mit_edx.name,
        "resource_type": LearningResourceType.course.name,
        "title": title,
        "offered_by": {"code": OfferedBy.mitx.name},
        "topics": _topics(row.get("topics"), OfferedBy.mitx.name),
        "runs": _parse_runs(row.get("runs"), title, instructors),
        "course": {
            "course_numbers": generate_course_numbers_json(
                row["readable_id"], is_ocw=False
            ),
        },
        "published": _parse_bool(row.get("published")),
        "image": _image(row.get("image_url")),
        "url": row.get("url"),
        "description": clean_data(row.get("description")),
    }


# ---------------------------------------------------------------------------
# OCW
# ---------------------------------------------------------------------------


def transform_ocw_course(row: dict) -> dict:
    """Transform an integrations__learn__ocw_courses row.

    OCW has no run-level data in the view (one row per course); a single
    synthetic run is built from the course itself, matching the run OCW's
    API-based ETL (learning_resources.etl.ocw.transform_course) constructs.
    """
    title = row["title"]
    readable_id = row["readable_id"]
    published = _parse_bool(row.get("published"))
    extra_course_numbers = _split(row.get("extra_course_numbers"), sep=",")
    departments = [
        department_id
        for department_id in (
            get_department_id_by_name(name) for name in _split(row.get("departments"))
        )
        if department_id
    ]
    return {
        "readable_id": readable_id,
        "platform": PlatformType.ocw.name,
        "etl_source": ETLSource.ocw.name,
        "resource_type": LearningResourceType.course.name,
        "title": title,
        "offered_by": {"code": OfferedBy.ocw.name},
        "topics": _topics(row.get("topics"), OfferedBy.ocw.name),
        "instructors": _instructors(row.get("instructors")),
        "departments": departments,
        "course": {
            "course_numbers": generate_course_numbers_json(
                row.get("course_number") or readable_id,
                extra_nums=extra_course_numbers,
                is_ocw=True,
            ),
        },
        "runs": [
            {
                "run_id": readable_id,
                "title": title,
                "published": published,
                "url": row.get("url"),
                "semester": row.get("term"),
                # LearningResourceRun.year is an IntegerField; an empty
                # string coerces fine as "" -> falsy -> None below, but
                # would otherwise raise on save.
                "year": int(row["year"]) if row.get("year") else None,
                "instructors": _instructors(row.get("instructors")),
            }
        ],
        "published": published,
        "image": _image(row.get("image_url")),
        "url": row.get("url"),
        "description": clean_data(row.get("description")),
    }


# ---------------------------------------------------------------------------
# MicroMasters
# ---------------------------------------------------------------------------


def transform_micromasters_program(row: dict) -> dict:
    """Transform an integrations__learn__micromasters_programs row.

    MicroMasters courses are hosted on edX; child course readable_ids are
    the edX course keys, so program->course linking matches on
    ``PlatformType.edx``, same as the API-based MicroMasters ETL.
    """
    title = row["title"]
    # The view emits the bare `program_id` (e.g. "3"); the API-based ETL
    # (learning_resources.etl.micromasters) prefixes it to
    # "micromasters-program-3", which is what's already in prod. Passing
    # the bare id through would create a duplicate program and the prune
    # step would then unpublish the real one.
    readable_id = f"{MICROMASTERS_READABLE_ID_PREFIX}{row['readable_id']}"
    return {
        "readable_id": readable_id,
        "platform": PlatformType.edx.name,
        "etl_source": ETLSource.micromasters.name,
        "resource_type": LearningResourceType.program.name,
        "title": title,
        "offered_by": {"code": OfferedBy.mitx.name},
        # integrations__learn__micromasters_programs exposes no topics
        # column (unlike the other Cohort 1 views) — omitting this key
        # entirely would still default to [] in loaders.load_program's
        # `program_data.pop("topics", [])`, which load_topics treats as
        # "clear all topics", wiping out whatever's curated today on every
        # sync. `None` is loaders.py's existing sentinel for "not provided,
        # leave alone" (see the analogous `departments_data = ... pop(...,
        # None)` a few lines below load_program's topics handling).
        "topics": None,
        "courses": [
            _course_stub(course_id, PlatformType.edx.name)
            for course_id in _split(row.get("courses"))
        ],
        "runs": [_program_run(readable_id, title, row)],
        "published": _parse_bool(row.get("published")),
        "image": _image(row.get("image_url")),
        "url": row.get("url"),
        "description": clean_data(row.get("description")),
    }
