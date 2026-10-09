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
  ones the loaders derive from the best run (``_RUN_DERIVED``);
- ``published``, as the loader would set it (false for a course or program
  with no runs or on the blocklist, and for a podcast with no episodes);
- topics (with the parents the loader adds), offered_by, image, departments,
  content tags, and the columns of the detail row (``course``, ``podcast``,
  ``podcast_episode``);
- each run by ``run_id``: its columns, prices, instructors and image, and the
  published runs a pruning load would unpublish;
- a program's child courses and programs, by readable_id;
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

from learning_resources.constants import LearningResourceType, RunStatus
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.ownership import current_pipeline, shadowing
from learning_resources.models import (
    Course,
    ETLShadowRun,
    LearningResource,
    LearningResourceOfferor,
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
# What each loader does with a key its item leaves out. None means "leave the
# stored value alone" for topics and content_tags, and "clear it" for the rest.
_LOADER_DEFAULTS = {
    COURSE: {
        "topics": None,
        "offered_by": None,
        "image": None,
        "departments": [],
        "content_tags": [],
    },
    PROGRAM: {"topics": [], "offered_by": None, "image": None, "departments": None},
    DOCUMENT: {"offered_by": None},
    PODCAST: {"topics": [], "offered_by": None, "image": None, "departments": []},
    PODCAST_EPISODE: {
        "topics": [],
        "offered_by": {},
        "image": None,
        "departments": [],
    },
}
_DETAIL_MODELS = {COURSE: Course, PODCAST: Podcast, PODCAST_EPISODE: PodcastEpisode}


@dataclass
class _Report:
    """What one shadow run has found for a pair so far."""

    observed: bool = False
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


def _instructor_names(instructors_data: Iterable[dict]) -> list[str]:
    names = [
        (
            instructor.get("full_name", "")
            or f"{instructor.get('first_name') or ''} "
            f"{instructor.get('last_name') or ''}"
        ).strip()
        for instructor in instructors_data
    ]
    return sorted({name for name in names if name})


def _note_runs(
    changes: dict, resource: LearningResource, item: dict, *, prune: bool
) -> None:
    """Note what load_run would change on each run of the item."""
    stored_runs = {run.run_id: run for run in resource.runs.all()}
    certification = item.get("certification", resource.certification)
    runs_data = item.get("runs") or []
    for run_data in runs_data:
        run_id = run_data["run_id"]
        prefix = f"runs[{run_id}]."
        run = stored_runs.get(run_id)
        if run is None:
            changes[f"runs[{run_id}]"] = [None, "new run"]
            continue
        data = {**run_data, "published": True} if resource.test_mode else run_data
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
                    relation.instructor.full_name
                    for relation in run.instructor_relationships.all()
                ),
                _instructor_names(instructors),
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
    if prune and not resource.test_mode:
        listed = {run_data["run_id"] for run_data in runs_data}
        for run_id, run in stored_runs.items():
            if run.published and run_id not in listed:
                changes[f"runs[{run_id}].published"] = [True, False]


def _resource_changes(
    resource: LearningResource, item: dict, resource_type: str, *, prune: bool
) -> dict[str, list]:
    """Return {path: [stored, incoming]} for what loading ``item`` would change."""
    has_runs = resource_type in _TYPES_WITH_RUNS
    data = {**_LOADER_DEFAULTS[resource_type], **item}
    if has_runs and not data.get("resource_category"):
        data.pop("resource_category", None)
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
                {relation.child.readable_id for relation in resource.children.all()}
            ),
            sorted(
                {
                    child["readable_id"]
                    for key in ("courses", "child_programs")
                    for child in data.get(key) or []
                    if child.get("readable_id")
                }
            ),
        )
    return changes


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


def _observe_item(  # noqa: PLR0913
    report: _Report,
    candidates: list[LearningResource],
    item: dict,
    resource_type: str,
    *,
    prune: bool,
    blocklist: Sequence[str],
) -> None:
    """Classify one item of a batch against the stored resource it would load into."""
    key = item["readable_id"]
    if not candidates:
        report.created.append(key)
        return
    resource = next(
        (
            candidate
            for candidate in candidates
            if candidate.platform and candidate.platform.code == item.get("platform")
        ),
        candidates[0],
    )
    report.seen.add(resource.id)
    published = item.get("published", resource.published)
    if resource_type in _TYPES_WITH_RUNS and (not item.get("runs") or key in blocklist):
        published = False
    fields = _resource_changes(resource, item, resource_type, prune=prune)
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


def observe(  # noqa: PLR0913
    etl_source: str,
    resource_type: str,
    items: Iterable[dict],
    *,
    prune: bool,
    prune_empty: bool = True,
    blocklist: Sequence[str] = (),
    keep: Q | None = None,
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

    Raises:
        KeyError: the pair is not one ``run_shadow`` was told the load writes
    """
    report = _reports.get()[(etl_source, resource_type)]
    report.observed = True
    count = 0
    for chunk in batched(items, OBSERVE_CHUNK_SIZE):
        count += len(chunk)
        stored = _stored(resource_type, [item["readable_id"] for item in chunk])
        for item in chunk:
            _observe_item(
                report,
                stored.get(item["readable_id"], []),
                item,
                resource_type,
                prune=prune,
                blocklist=blocklist,
            )
    if prune and (count or prune_empty):
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
    podcasts, episodes, published, empty = [], [], set(), set()
    for podcast in podcasts_data:
        podcast_episodes = list(podcast.get("episodes", []))
        if not podcast_episodes:
            empty.add(podcast["readable_id"])
            continue
        podcasts.append(podcast)
        if podcast.get("published", True):
            published.add(podcast["readable_id"])
            episodes.extend(podcast_episodes)
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
        kept = ETLShadowRun.objects.filter(
            etl_source=etl_source, resource_type=resource_type, pipeline=pipeline
        ).values_list("id", flat=True)[:SHADOW_RUNS_KEPT]
        ETLShadowRun.objects.filter(
            etl_source=etl_source, resource_type=resource_type, pipeline=pipeline
        ).exclude(id__in=list(kept)).delete()
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
    return result, _save(pairs, reports)
