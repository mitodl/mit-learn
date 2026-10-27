"""
Shadow runs: report what a pipeline that does not own a source would change,
without loading it.

``run_shadow`` runs the pipeline's extract and transform. The batch loaders it
reaches (``load_courses``, ``load_programs``, ``load_documents`` and
``load_podcasts``) load nothing inside it. They hand their batch to
``observe``, which compares each item with the stored resource it would be
loaded into. The differences are saved as one ETLShadowRun per
(etl_source, resource_type), so a cutover can be checked against the live
catalog before the ETLSourceOwnership row is flipped.

Nothing is written but the reports, and no row is locked: the comparison is a
few reads per ``OBSERVE_CHUNK_SIZE`` items, outside any transaction.

The comparison follows the loaders' rules instead of running them, so it is a
second copy of those rules and can drift from them. It covers:

- every key of an item that is a column of LearningResource, apart from the
  ones the loaders derive from the best run (``_RUN_DERIVED``), and the
  columns a loader sets for an item that leaves them out (``delivery`` and
  ``resource_category``);
- ``published``, as the loader would set it (false for a course or program
  with no runs or on the blocklist, and for a podcast with no episodes);
- ``test_mode`` and ``require_summaries``, as the loader sets them for a
  blocklisted or force-ingested course;
- topics (with the parents the loader adds), offered_by, image, departments,
  content tags, and the columns of the detail row (``course``, ``podcast``,
  ``podcast_episode``);
- each run by ``run_id``: its columns, prices, instructors and image, and the
  published runs a pruning load would unpublish;
- a program's child courses and programs, by readable_id, as its load would
  find them;
- the published resources a pruning load would unpublish.

It does not cover what only the loaders decide: topics found by similarity for
a document with none, deduplication by ``unique_field``, runs that moved
between courses, the courses a program load writes, content files, and the
search index.
"""

import logging
import re
from collections import Counter
from collections.abc import Callable, Iterable, Sequence
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from functools import cache
from itertools import batched
from typing import Any

from django.db.models import Model, Prefetch, Q
from django.utils import timezone

from learning_resources.constants import (
    LearningResourceDelivery,
    LearningResourceRelationTypes,
    LearningResourceType,
    PlatformType,
    RunStatus,
)
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.ownership import current_pipeline, shadowing
from learning_resources.models import (
    Course,
    ETLShadowRun,
    LearningResource,
    LearningResourceOfferor,
    LearningResourcePlatform,
    LearningResourceRun,
    LearningResourceTopic,
    Podcast,
    PodcastEpisode,
    RunInstructorRelationship,
)

log = logging.getLogger(__name__)

COURSE = LearningResourceType.course.name
PROGRAM = LearningResourceType.program.name
DOCUMENT = LearningResourceType.document.name
PODCAST = LearningResourceType.podcast.name
PODCAST_EPISODE = LearningResourceType.podcast_episode.name

# Resources whose field differences a report lists in full; counts cover all.
MAX_CHANGED_DETAILS = 200
MAX_VALUE_LENGTH = 300
# Reports kept per (etl_source, resource_type, pipeline).
SHADOW_RUNS_KEPT = 20
# Items compared per round of queries.
OBSERVE_CHUNK_SIZE = 500

NOT_OBSERVED = (
    "The load reached no loader that reports to a shadow run for this pair, "
    "so nothing was compared."
)

# "runs[run-1].title" counts under "runs[].title".
_LIST_ITEM = re.compile(r"\[[^\]]*\]")
# Columns that identify the stored resource or are reported on their own.
_IDENTITY = {"readable_id", "resource_type", "published"}
# Columns load_run_dependent_values overwrites from a course's or program's
# runs, whatever the item says.
_RUN_DERIVED = {
    "availability",
    "prices",
    "location",
    "duration",
    "min_weeks",
    "max_weeks",
    "time_commitment",
    "min_weekly_hours",
    "max_weekly_hours",
    "next_start_date",
}
_TYPES_WITH_RUNS = {COURSE, PROGRAM}
_ONLINE = [LearningResourceDelivery.online.name]
# What each loader does with a key its item leaves out. None means "leave the
# stored value alone" for topics and content_tags, and "clear it" for the rest.
_LOADER_DEFAULTS = {
    COURSE: {
        "topics": None,
        "offered_by": None,
        "image": None,
        "departments": [],
        "content_tags": [],
        "delivery": _ONLINE,
    },
    PROGRAM: {
        "topics": [],
        "offered_by": None,
        "image": None,
        "departments": None,
        "delivery": _ONLINE,
    },
    DOCUMENT: {"offered_by": None},
    PODCAST: {"topics": [], "offered_by": None, "image": None, "departments": []},
    PODCAST_EPISODE: {
        "topics": [],
        "offered_by": {},
        "image": None,
        "departments": [],
    },
}
# What a loader sets whatever its item says.
_LOADER_OVERRIDES = {
    PODCAST: {"resource_category": LearningResourceType.podcast.value},
    PODCAST_EPISODE: {"resource_category": LearningResourceType.podcast_episode.value},
}
_DETAIL_MODELS = {COURSE: Course, PODCAST: Podcast, PODCAST_EPISODE: PodcastEpisode}


@dataclass
class _Report:
    """What one shadow run has found for a pair so far."""

    observed: bool = False
    items: int = 0
    prune: bool = False
    keep: Q = field(default_factory=Q)
    seen: set[int] = field(default_factory=set)
    created: list[str] = field(default_factory=list)
    unpublished: list[str] = field(default_factory=list)
    republished: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    unchanged: int = 0
    field_counts: Counter[str] = field(default_factory=Counter)
    changed: dict[str, dict] = field(default_factory=dict)


_reports: ContextVar[dict[tuple[str, str], _Report] | None] = ContextVar(
    "etl_shadow_reports", default=None
)


def _plain(value: Any) -> Any:
    """Reduce a value to what JSON holds, so that both sides compare alike."""
    if value is None or isinstance(value, bool | int | float):
        plain = value
    elif isinstance(value, Decimal):
        plain = format(value.normalize(), "f")
    elif isinstance(value, datetime):
        if timezone.is_naive(value):
            value = timezone.make_aware(value)
        plain = value.astimezone(UTC).isoformat()
    elif isinstance(value, dict):
        plain = {str(key): _plain(item) for key, item in value.items()}
    elif isinstance(value, list | tuple | set):
        plain = [_plain(item) for item in value]
    else:
        plain = str(value)
    return plain


def _shorten(value: Any) -> Any:
    if isinstance(value, str) and len(value) > MAX_VALUE_LENGTH:
        return f"{value[:MAX_VALUE_LENGTH]}... ({len(value)} chars)"
    return value


def _note(changes: dict, path: str, old: Any, new: Any) -> None:
    old, new = _plain(old), _plain(new)
    if old != new:
        changes[path] = [_shorten(old), _shorten(new)]


@cache
def _columns(model: type[Model]) -> dict:
    return {
        column.name: column
        for column in model._meta.concrete_fields  # noqa: SLF001
        if not column.is_relation and not column.primary_key
    }


def _note_columns(  # noqa: PLR0913
    changes: dict,
    model: type[Model],
    stored: Model | None,
    data: dict,
    *,
    prefix: str = "",
    skip: Iterable[str] = (),
) -> None:
    """Note each key of ``data`` that is a column of ``model`` and differs."""
    for name, column in _columns(model).items():
        if name not in data or name in skip:
            continue
        value = data[name]
        base = getattr(column, "base_field", None)
        if base is not None and isinstance(value, list | tuple):
            value = [base.to_python(item) for item in value]
        elif value is not None:
            value = column.to_python(value)
        _note(changes, f"{prefix}{name}", getattr(stored, name, None), value)


def _image(image: Any) -> dict | None:
    """Return an image as the three values load_image keys it by."""
    if not image:
        return None
    get = image.get if isinstance(image, dict) else lambda key: getattr(image, key)
    return {key: get(key) for key in ("url", "description", "alt")}


@cache
def _topic_parents() -> dict[str, str | None]:
    return dict(LearningResourceTopic.objects.values_list("name", "parent__name"))


def _expected_topics(topics_data: Iterable[dict]) -> list[str]:
    """Return the topics load_topics would set: existing ones and their parents."""
    parents = _topic_parents()
    names = set()
    for topic in topics_data:
        name = topic["name"]
        while name in parents and name not in names:
            names.add(name)
            name = parents[name]
    return sorted(names)


@cache
def _offeror_code(lookup: tuple) -> str | None:
    offeror = LearningResourceOfferor.objects.filter(**dict(lookup)).first()
    return offeror.code if offeror else None


@cache
def _platform_codes() -> frozenset[str]:
    return frozenset(LearningResourcePlatform.objects.values_list("code", flat=True))


def _instructor_positions(instructors_data: Iterable[dict]) -> list[list]:
    """
    Return the [full_name, position] load_instructors would store, in order.
    A name it is given twice keeps the position of its last occurrence.
    """
    positions = {}
    for idx, instructor in enumerate(instructors_data):
        name = (
            instructor.get("full_name", "")
            or f"{instructor.get('first_name') or ''} "
            f"{instructor.get('last_name') or ''}"
        ).strip()
        if name:
            positions[name] = idx
    return sorted(([name, idx] for name, idx in positions.items()), key=_by_position)


def _by_position(relation: list) -> tuple:
    return relation[-1], relation[0]


def _note_runs(
    changes: dict, resource: LearningResource, item: dict, *, prune: bool
) -> None:
    """Note what load_run would change on each run of the item."""
    stored_runs = {run.run_id: run for run in resource.runs.all()}
    certification = item.get("certification", resource.certification)
    # load_run reads test_mode after the resource is saved with the item's
    test_mode = item.get("test_mode", resource.test_mode)
    runs_data = item.get("runs") or []
    for run_data in runs_data:
        run_id = run_data["run_id"]
        prefix = f"runs[{run_id}]."
        run = stored_runs.get(run_id)
        if run is None:
            changes[f"runs[{run_id}]"] = [None, "new run"]
            continue
        data = {**run_data, "published": True} if test_mode else run_data
        _note_columns(
            changes, LearningResourceRun, run, data, prefix=prefix, skip={"prices"}
        )
        _note(changes, f"{prefix}image", _image(run.image), _image(data.get("image")))
        instructors = data.get("instructors", [])
        if instructors is not None:
            _note(
                changes,
                f"{prefix}instructors",
                sorted(
                    (
                        [relation.instructor.full_name, relation.position]
                        for relation in run.instructor_relationships.all()
                    ),
                    key=_by_position,
                ),
                _instructor_positions(instructors),
            )
        prices = data.get("prices", [])
        if prices is not None:
            if data.get("status") == RunStatus.archived.value or certification is False:
                prices = []
            _note(
                changes,
                f"{prefix}prices",
                sorted(run.prices or []),
                sorted({Decimal(str(price["amount"])) for price in prices}),
            )
            _note(
                changes,
                f"{prefix}resource_prices",
                sorted(
                    [price.amount, price.currency]
                    for price in run.resource_prices.all()
                ),
                sorted(
                    [Decimal(str(price["amount"])), price["currency"]]
                    for price in prices
                ),
            )
    if prune and not test_mode:
        listed = {run_data["run_id"] for run_data in runs_data}
        for run_id, run in stored_runs.items():
            if run.published and run_id not in listed:
                changes[f"runs[{run_id}].published"] = [True, False]


def _resource_changes(
    resource: LearningResource,
    item: dict,
    resource_type: str,
    *,
    prune: bool,
    children: frozenset[tuple[str, str, str]] = frozenset(),
) -> dict[str, list]:
    """
    Return {path: [stored, incoming]} for what loading ``item`` would change.

    ``children`` are the (resource_type, platform, readable_id) a program
    load would find to link a program to (see ``_findable_children``).
    """
    has_runs = resource_type in _TYPES_WITH_RUNS
    data = {
        **_LOADER_DEFAULTS[resource_type],
        **item,
        **_LOADER_OVERRIDES.get(resource_type, {}),
    }
    if has_runs and not data.get("resource_category"):
        # what upsert_course_or_program stores for an item with none
        data["resource_category"] = LearningResourceType[resource_type].value
    changes: dict[str, list] = {}
    _note_columns(
        changes,
        LearningResource,
        resource,
        data,
        skip=_IDENTITY | (_RUN_DERIVED if has_runs else set()),
    )
    topics = data.get("topics")
    if topics is not None and (topics or resource_type != DOCUMENT):
        _note(
            changes,
            "topics",
            sorted(topic.name for topic in resource.topics.all()),
            _expected_topics(topics),
        )
    offered_by = data["offered_by"]
    _note(
        changes,
        "offered_by",
        resource.offered_by.code if resource.offered_by else None,
        None
        if offered_by is None
        else _offeror_code(tuple(sorted(offered_by.items()))),
    )
    _note(changes, "image", _image(resource.image), _image(data.get("image")))
    if "departments" in data:
        _note(
            changes,
            "departments",
            sorted(dept.department_id for dept in resource.departments.all()),
            sorted(data["departments"] or []),
        )
    if data.get("content_tags") is not None:
        _note(
            changes,
            "content_tags",
            sorted(tag.name for tag in resource.resource_tags.all()),
            sorted(set(data["content_tags"])),
        )
    detail = data.get(resource_type)
    if detail and resource_type in _DETAIL_MODELS:
        _note_columns(
            changes,
            _DETAIL_MODELS[resource_type],
            getattr(resource, resource_type, None),
            detail,
            prefix=f"{resource_type}.",
        )
    if has_runs:
        _note_runs(changes, resource, data, prune=prune)
    if resource_type == PROGRAM:
        _note(
            changes,
            "children",
            sorted(
                (
                    [
                        relation.child.readable_id,
                        relation.relation_type,
                        relation.position,
                    ]
                    for relation in resource.children.all()
                ),
                key=_by_position,
            ),
            _program_children(data, children),
        )
    return changes


def _program_children(
    data: dict, children: frozenset[tuple[str, str, str]]
) -> list[list]:
    """
    Return the [readable_id, relation_type, position] of the children a load of
    the program would link it to, in order: load_program's courses, then
    _create_child_program_relationships's programs, on the parent's platform.
    """
    courses = [
        course
        for course in data.get("courses") or []
        if course.get("readable_id")
        and (COURSE, course["platform"], course["readable_id"]) in children
    ]
    relations = [
        [
            course["readable_id"],
            LearningResourceRelationTypes.PROGRAM_COURSES.value,
            idx if course.get("position") is None else course["position"],
        ]
        for idx, course in enumerate(courses)
    ]
    child_programs = data.get("child_programs") or []
    next_position = (
        max(
            (
                position
                for position in [
                    *(relation[-1] for relation in relations),
                    *(child.get("position") for child in child_programs),
                ]
                if position is not None
            ),
            default=-1,
        )
        + 1
    )
    programs = {}
    for child in child_programs:
        readable_id = child.get("readable_id")
        if not readable_id or (PROGRAM, data["platform"], readable_id) not in children:
            continue
        position = child.get("position")
        if position is None:
            position = next_position
            next_position += 1
        programs[readable_id] = [
            readable_id,
            (
                LearningResourceRelationTypes.PROGRAM_COURSES.value
                if child.get("display_mode") == "course"
                else LearningResourceRelationTypes.PROGRAM_PROGRAMS.value
            ),
            position,
        ]
    return sorted([*relations, *programs.values()], key=_by_position)


def _stored(resource_type: str, readable_ids: list[str]) -> dict:
    """Return the stored resources of a type by readable_id, read for comparing."""
    resources: dict[str, list[LearningResource]] = {}
    for resource in (
        LearningResource.objects.filter(
            resource_type=resource_type, readable_id__in=readable_ids
        )
        .select_related("platform", "offered_by", "image", *_DETAIL_MODELS)
        .prefetch_related(
            "topics",
            "departments",
            "resource_tags",
            "children__child",
            "runs__image",
            "runs__resource_prices",
            Prefetch(
                "runs__instructor_relationships",
                queryset=RunInstructorRelationship.objects.select_related("instructor"),
            ),
        )
    ):
        resources.setdefault(resource.readable_id, []).append(resource)
    return resources


def _with_test_mode(
    item: dict, resource_type: str, *, published: bool, blocked: bool
) -> dict:
    """Return ``item`` with the test_mode and require_summaries the loader sets."""
    if blocked:
        # upsert_course_or_program takes a blocklisted resource out of test mode
        item = {**item, "test_mode": False}
    if resource_type == COURSE and item.get("force_ingest"):
        # load_course marks a force-ingested course for summaries, and puts it
        # in test mode when it does not publish it and it is not blocklisted
        item = {**item, "require_summaries": True}
        if not published and not blocked:
            item["test_mode"] = True
    return item


def _findable_children(
    programs: Sequence[dict],
    *,
    fetch_courses: bool,
    batch_programs: set[tuple[str, str]],
) -> frozenset[tuple[str, str, str]]:
    """
    Return the (resource_type, platform, readable_id) of the children a load of
    ``programs`` would link them to.

    load_program skips a course with no known platform, and with
    ``fetch_courses`` one that is not stored published or in test mode, as
    upsert_course_or_program finds it. _create_child_program_relationships
    skips a child program not stored on the parent's platform, after every
    program of the batch (``batch_programs``) is loaded.
    """
    platforms = _platform_codes()
    loaded = [program for program in programs if program["platform"] in platforms]
    courses = {
        (course["platform"], course["readable_id"])
        for program in loaded
        for course in program.get("courses") or []
        if course.get("readable_id")
    }
    if fetch_courses:
        courses &= set(
            LearningResource.objects.filter(
                Q(published=True) | Q(test_mode=True),
                resource_type=COURSE,
                readable_id__in={readable_id for _, readable_id in courses},
            ).values_list("platform__code", "readable_id")
        )
    else:
        courses = {course for course in courses if course[0] in platforms}
    child_ids = {
        child["readable_id"]
        for program in loaded
        for child in program.get("child_programs") or []
        if child.get("readable_id")
    }
    child_programs = batch_programs | set(
        LearningResource.objects.filter(
            resource_type=PROGRAM, readable_id__in=child_ids
        ).values_list("platform__code", "readable_id")
    )
    return frozenset(
        [(COURSE, *course) for course in courses]
        + [(PROGRAM, *program) for program in child_programs]
    )


def _observe_item(  # noqa: PLR0913
    report: _Report,
    candidates: list[LearningResource],
    item: dict,
    resource_type: str,
    *,
    prune: bool,
    blocklist: Sequence[str],
    children: frozenset[tuple[str, str, str]] = frozenset(),
) -> bool:
    """
    Classify one item of a batch against the stored resource it would load into.

    Returns:
        whether the loader would load the item
    """
    if resource_type in _TYPES_WITH_RUNS and item["platform"] not in _platform_codes():
        # upsert_course_or_program logs and skips an item with no known platform
        return False
    key = item["readable_id"]
    # the loaders key a resource on its platform too, so one on another
    # platform is a different resource and the item would be created
    resource = next(
        (
            candidate
            for candidate in candidates
            if candidate.platform and candidate.platform.code == item["platform"]
        ),
        None,
    )
    if resource is None:
        report.created.append(key)
        return True
    report.seen.add(resource.id)
    published = item.get("published", resource.published)
    blocked = resource_type in _TYPES_WITH_RUNS and key in blocklist
    if resource_type in _TYPES_WITH_RUNS and (not item.get("runs") or blocked):
        published = False
    item = _with_test_mode(item, resource_type, published=published, blocked=blocked)
    fields = _resource_changes(
        resource, item, resource_type, prune=prune, children=children
    )
    if resource.published and not published:
        report.unpublished.append(key)
    elif published and not resource.published:
        report.republished.append(key)
    elif not fields:
        report.unchanged += 1
    if fields:
        report.updated.append(key)
        report.field_counts.update({_LIST_ITEM.sub("[]", path) for path in fields})
        if len(report.changed) < MAX_CHANGED_DETAILS:
            report.changed[key] = fields
    return True


def observe(  # noqa: PLR0913
    etl_source: str,
    resource_type: str,
    items: Iterable[dict],
    *,
    prune: bool,
    prune_empty: bool = True,
    blocklist: Sequence[str] = (),
    keep: Q | None = None,
    fetch_courses: bool = False,
) -> None:
    """
    Compare a batch with the stored resources of a pair, for the shadow run
    in progress. Called by a batch loader in place of loading.

    Args:
        etl_source: the source the batch is loaded as
        resource_type: the type of every item
        items: the resources as the loader takes them
        prune: whether the load unpublishes what the batch leaves out (the
            pair's published resources, and a listed resource's runs)
        prune_empty: whether an empty batch prunes too
        blocklist: readable_ids the loader would not publish
        keep: stored resources the prune leaves alone
        fetch_courses: whether a program load looks its courses up instead
            of loading them

    Raises:
        KeyError: the pair is not one ``run_shadow`` was told the load writes
    """
    report = _reports.get()[(etl_source, resource_type)]
    report.observed = True
    batch_programs: set[tuple[str, str]] = set()
    if resource_type == PROGRAM:
        items = list(items)
        batch_programs = {
            (item["platform"], item["readable_id"])
            for item in items
            if item["platform"] in _platform_codes()
        }
    count = loaded = 0
    for chunk in batched(items, OBSERVE_CHUNK_SIZE):
        count += len(chunk)
        stored = _stored(resource_type, [item["readable_id"] for item in chunk])
        children = (
            _findable_children(
                chunk, fetch_courses=fetch_courses, batch_programs=batch_programs
            )
            if resource_type == PROGRAM
            else frozenset()
        )
        for item in chunk:
            loaded += _observe_item(
                report,
                stored.get(item["readable_id"], []),
                item,
                resource_type,
                prune=prune,
                blocklist=blocklist,
                children=children,
            )
    report.items += count
    # the loaders prune only when they loaded something, not on a batch of
    # items they all skipped
    if prune and (loaded or prune_empty):
        report.prune = True
        report.keep = keep or Q()


def observe_podcasts(podcasts_data: Iterable[dict], tracked_ids: Sequence[str]) -> None:
    """
    Compare the podcasts and their episodes as load_podcasts would load them.

    A podcast with no episodes is unpublished with its episodes and not
    otherwise loaded. A podcast in ``tracked_ids`` that the batch leaves out
    keeps its data, and so do the episodes of a podcast the batch does not
    publish.
    """
    etl_source = ETLSource.podcast.name
    # load_podcast and load_podcast_episode store every item on this platform
    platform = {"platform": PlatformType.podcast.name}
    podcasts, episodes, published, empty = [], [], set(), set()
    for podcast in podcasts_data:
        podcast_episodes = list(podcast.get("episodes", []))
        if not podcast_episodes:
            empty.add(podcast["readable_id"])
            continue
        podcasts.append({**podcast, **platform})
        if podcast.get("published", True):
            published.add(podcast["readable_id"])
            episodes.extend({**episode, **platform} for episode in podcast_episodes)
    observe(
        etl_source,
        PODCAST,
        podcasts,
        prune=True,
        keep=Q(readable_id__in=set(tracked_ids) - empty),
    )
    observe(
        etl_source,
        PODCAST_EPISODE,
        episodes,
        prune=True,
        keep=Q(parents__parent__readable_id__in=set(tracked_ids) - published - empty),
    )


def _finish(etl_source: str, resource_type: str, report: _Report) -> tuple[dict, dict]:
    """Add what the prune would unpublish and return the report's (counts, details)."""
    resources = LearningResource.objects.filter(
        etl_source=etl_source, resource_type=resource_type
    )
    before_published = resources.filter(published=True).count()
    if report.prune:
        pruned = resources.filter(published=True).exclude(report.keep)
        if resource_type == COURSE:
            pruned = pruned.exclude(test_mode=True)
        report.unpublished.extend(
            readable_id
            for resource_id, readable_id in pruned.values_list(
                "id", "readable_id"
            ).iterator()
            if resource_id not in report.seen
        )
    counts = {
        "items": report.items,
        "before": resources.count(),
        "before_published": before_published,
        "created": len(report.created),
        "unpublished": len(report.unpublished),
        "republished": len(report.republished),
        "updated": len(report.updated),
        "unchanged": report.unchanged,
    }
    details = {
        "created": sorted(report.created),
        "unpublished": sorted(report.unpublished),
        "republished": sorted(report.republished),
        "updated": sorted(report.updated),
        "field_counts": dict(report.field_counts.most_common()),
        "changed": report.changed,
        "changed_truncated": len(report.updated) > len(report.changed),
    }
    return counts, details


def _save(
    pairs: Sequence[tuple[str, str]], reports: dict, error: str = ""
) -> list[ETLShadowRun]:
    """Save one ETLShadowRun per pair and drop the pair's oldest ones."""
    pipeline = current_pipeline()
    runs = []
    for etl_source, resource_type in pairs:
        counts, details, pair_error = reports.get(
            (etl_source, resource_type), ({}, {}, error)
        )
        runs.append(
            ETLShadowRun.objects.create(
                etl_source=etl_source,
                resource_type=resource_type,
                pipeline=pipeline,
                counts=counts,
                details=details,
                error=pair_error,
            )
        )
        log.info(
            "Shadow run of %s as %s for %s/%s: %s",
            "failed load" if pair_error else "load",
            pipeline,
            etl_source,
            resource_type,
            pair_error or counts,
        )
        # Delete the expired ids rather than everything outside the kept ones,
        # so that a report another run saves meanwhile is not deleted with them
        expired = (
            ETLShadowRun.objects.filter(
                etl_source=etl_source, resource_type=resource_type, pipeline=pipeline
            )
            .order_by("-created_on", "-id")
            .values_list("id", flat=True)[SHADOW_RUNS_KEPT:]
        )
        ETLShadowRun.objects.filter(id__in=list(expired)).delete()
    return runs


def run_shadow(
    writes: Iterable[tuple[str, str | Iterable[str]]], load: Callable[[], Any]
) -> tuple[Any, list[ETLShadowRun]]:
    """
    Run ``load`` as a shadow of the current pipeline and report what it would
    have changed.

    Args:
        writes: the (etl_source, resource_types) ``load`` writes. A pair whose
            loader never reports is saved with NOT_OBSERVED as its error.
        load: the pipeline's load, called with no arguments. It must reach
            the catalog only through the batch loaders named in this module's
            docstring: nothing rolls back a write made any other way.

    Returns:
        ``load``'s return value and the saved ETLShadowRun of each pair.

    Raises:
        Exception: whatever ``load`` raises, after saving it as each pair's
            report. A load that fails as a shadow would fail as the owner.
    """
    pairs = [
        (etl_source, resource_type)
        for etl_source, resource_types in writes
        for resource_type in (
            [resource_types] if isinstance(resource_types, str) else resource_types
        )
    ]
    observed = {pair: _Report() for pair in pairs}
    token = _reports.set(observed)
    try:
        with shadowing():
            result = load()
        reports = {
            pair: (*_finish(*pair, report), "")
            if report.observed
            else ({}, {}, NOT_OBSERVED)
            for pair, report in observed.items()
        }
    except Exception as exc:
        try:
            _save(pairs, {}, error=f"{type(exc).__name__}: {exc}")
        except Exception:
            # the load's error is the one to raise, not the report's
            log.exception("Could not save the failed shadow run of %s", pairs)
        raise
    finally:
        _reports.reset(token)
        _topic_parents.cache_clear()
        _offeror_code.cache_clear()
        _platform_codes.cache_clear()
    return result, _save(pairs, reports)
