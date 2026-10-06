"""
Shadow runs: load a source as a pipeline that does not own it, without writing.

``run_shadow`` runs the pipeline's real load (the same loaders, prune included)
inside a transaction, serializes the source's resources before and after it,
and rolls the transaction back. The difference is saved as one ETLShadowRun per
(etl_source, resource_type), so a cutover can be checked against the live
catalog before the ETLSourceOwnership row is flipped.

No index hears of it either: the search index and embedding tasks the loaders
trigger are dropped while ``is_shadow_run()`` is true
(``learning_resources_search.plugins.try_with_retry_as_task``), and anything
queued with ``transaction.on_commit`` goes with the rollback. What the loaders
read still happens (the course blocklist fetch and its cache entry, the
similar-topics lookup for a resource with no topics).

The load runs in one transaction, so the row locks it takes (the loaders'
``select_for_update`` among them) last until the rollback instead of one
resource's load. The owner's run of the same source waits behind them, as does
a user write that references a locked resource (a list or learning path item).
The transaction is READ COMMITTED, so a change someone else commits to the
source between the two snapshots is reported as the shadow's.
"""

import json
import logging
import re
from collections import Counter
from collections.abc import Callable, Iterable, Sequence
from typing import Any

from django.db import transaction
from rest_framework.utils.encoders import JSONEncoder

from learning_resources.etl.ownership import current_pipeline, shadowing
from learning_resources.models import ETLShadowRun, LearningResource
from learning_resources.serializers import LearningResourceSerializer

log = logging.getLogger(__name__)

# Serialized keys that differ between two loads of the same data.
_VOLATILE_KEYS = {"id", "created_on", "updated_on", "views", "best_run_id"}
# The key that names an item of a serialized list of dicts, first match wins,
# so a reordered or lengthened list reports the items that changed.
_LIST_ITEM_KEYS = ("run_id", "readable_id", "department_id", "code", "name")

# Resources whose field differences a report lists in full; counts cover all.
MAX_CHANGED_DETAILS = 200
MAX_VALUE_LENGTH = 300
# Reports kept per (etl_source, resource_type, pipeline).
SHADOW_RUNS_KEPT = 20

Snapshot = dict[str, dict[str, Any]]


class _Rollback(Exception):  # noqa: N818
    """Raised to leave the shadow transaction without committing it."""


def _flatten(value: Any, path: str = "") -> Iterable[tuple[str, Any]]:
    """Yield (dotted path, leaf value) for a serialized resource."""
    if isinstance(value, dict):
        for key, item in value.items():
            if key not in _VOLATILE_KEYS:
                yield from _flatten(item, f"{path}.{key}" if path else key)
    elif isinstance(value, list) and value and all(isinstance(i, dict) for i in value):
        item_key = next(
            (key for key in _LIST_ITEM_KEYS if all(key in item for item in value)),
            None,
        )
        for index, item in enumerate(value):
            label = item[item_key] if item_key else index
            yield from _flatten(item, f"{path}[{label}]")
    else:
        yield path, value


def snapshot(etl_source: str, resource_type: str) -> Snapshot:
    """
    Serialize every resource of a pair, published or not, as the API would,
    flattened to {path: value} and keyed by readable_id.
    """
    serializer = LearningResourceSerializer()
    resources: Snapshot = {}
    for resource in (
        LearningResource.objects.filter(
            etl_source=etl_source, resource_type=resource_type
        )
        .for_serialization()
        .order_by("id")
        .iterator(chunk_size=500)
    ):
        data = json.loads(
            json.dumps(serializer.to_representation(resource), cls=JSONEncoder)
        )
        key = resource.readable_id
        if key in resources:
            # readable_id is unique per platform, not per etl_source
            key = f"{key}@{resource.platform_id}"
        resources[key] = dict(_flatten(data))
    return resources


def _shorten(value: Any) -> Any:
    if isinstance(value, str) and len(value) > MAX_VALUE_LENGTH:
        return f"{value[:MAX_VALUE_LENGTH]}... ({len(value)} chars)"
    return value


def _field_changes(old: dict, new: dict) -> dict[str, list]:
    return {
        path: [_shorten(old.get(path)), _shorten(new.get(path))]
        for path in sorted(old.keys() | new.keys())
        if path != "published" and old.get(path) != new.get(path)
    }


def diff_snapshots(before: Snapshot, after: Snapshot) -> tuple[dict, dict]:
    """
    Compare two snapshots of a pair.

    Returns:
        (counts, details). ``counts`` is the number of resources created,
        deleted, unpublished, republished, updated and unchanged. ``details``
        lists the readable_ids behind each count, ``field_counts`` (how many
        updated resources changed each field, list items collapsed to ``[]``)
        and ``changed`` ({readable_id: {path: [before, after]}}) for the first
        MAX_CHANGED_DETAILS updated resources, then the republished ones: a
        resource that goes live again does so with the fields listed there.
        An unpublished resource's other changes are not listed. It leaves
        the catalog, and its runs leaving the serialized form with it would
        read as changes.
    """
    created = sorted(after.keys() - before.keys())
    deleted = sorted(before.keys() - after.keys())
    unpublished, republished, unchanged = [], [], 0
    changed: dict[str, dict] = {}
    republished_changes: dict[str, dict] = {}
    field_counts: Counter[str] = Counter()
    for key in sorted(before.keys() & after.keys()):
        old, new = before[key], after[key]
        if old == new:
            unchanged += 1
        elif old["published"] and not new["published"]:
            unpublished.append(key)
        elif new["published"] and not old["published"]:
            republished.append(key)
            if fields := _field_changes(old, new):
                republished_changes[key] = fields
        else:
            fields = _field_changes(old, new)
            field_counts.update({re.sub(r"\[[^\]]*\]", "[]", path) for path in fields})
            changed[key] = fields
    counts = {
        "before": len(before),
        "before_published": sum(1 for r in before.values() if r["published"]),
        "after_published": sum(1 for r in after.values() if r["published"]),
        "created": len(created),
        "deleted": len(deleted),
        "unpublished": len(unpublished),
        "republished": len(republished),
        "updated": len(changed),
        "unchanged": unchanged,
    }
    details = {
        "created": created,
        "deleted": deleted,
        "unpublished": unpublished,
        "republished": republished,
        "updated": sorted(changed),
        "field_counts": dict(field_counts.most_common()),
        "changed": dict(
            [*changed.items(), *republished_changes.items()][:MAX_CHANGED_DETAILS]
        ),
        "changed_truncated": len(changed) + len(republished_changes)
        > MAX_CHANGED_DETAILS,
    }
    return counts, details


def _save(pairs: Sequence[tuple[str, str]], reports: dict, error: str = "") -> list:
    """Save one ETLShadowRun per pair and drop the pair's oldest ones."""
    pipeline = current_pipeline()
    runs = []
    for etl_source, resource_type in pairs:
        counts, details = reports.get((etl_source, resource_type), ({}, {}))
        runs.append(
            ETLShadowRun.objects.create(
                etl_source=etl_source,
                resource_type=resource_type,
                pipeline=pipeline,
                counts=counts,
                details=details,
                error=error,
            )
        )
        log.info(
            "Shadow run of %s as %s for %s/%s: %s",
            "failed load" if error else "load",
            pipeline,
            etl_source,
            resource_type,
            error or counts,
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
        writes: the (etl_source, resource_types) ``load`` writes. Every pair
            is compared, and they are rolled back together, so a load whose
            later part reads what its earlier part wrote (programs linking to
            the courses of the same batch) behaves as it would for real.
        load: the pipeline's load, called with no arguments.

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
    reports = {}
    result = None
    try:
        with transaction.atomic():
            before = {pair: snapshot(*pair) for pair in pairs}
            with shadowing():
                result = load()
            reports = {
                pair: diff_snapshots(before[pair], snapshot(*pair)) for pair in pairs
            }
            raise _Rollback  # noqa: TRY301
    except _Rollback:
        pass
    except Exception as exc:
        _save(pairs, {}, error=f"{type(exc).__name__}: {exc}")
        raise
    return result, _save(pairs, reports)
