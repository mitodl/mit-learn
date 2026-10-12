"""
Per-(etl_source, resource_type) write ownership.

Three pipelines can load the same catalog data: the legacy Celery ETL, the
warehouse pull (BaseWarehouseETLTask, reading OL Data Platform views), and the
data platform's webhook push (/api/v1/webhooks/learning_resources/). The batch
loaders they share (load_courses, load_programs, load_podcasts, ...) do a full
sync: anything absent from the batch is unpublished. Two pipelines writing the
same pair would each unpublish the other's rows on every run.

ETLSourceOwnership names the one pipeline allowed to write a pair. A missing row
means legacy, so nothing changes until a row is created. Changing the row in
Django admin is the per-source cutover (and the rollback), with no deploy.

Each pipeline declares itself once, at its entry point, with ``writing_as``, and
calls ``may_write`` there, before it extracts anything, so a pipeline that does
not own a pair costs one query and no extract or transform. Code that never
declares a pipeline is the legacy Celery ETL: its checks are in
``learning_resources.etl.pipelines`` and at the top of the tasks that have no
pipeline function (``get_youtube_data``, ``sync_canvas_courses``,
``get_ocw_data``); a warehouse task declares ``writes`` and
``BaseWarehouseETLTask.run`` checks it before connecting.

The batch loaders call ``may_write`` again as a backstop, so a caller that
skipped the entry check (a shell session, a new pipeline) still cannot write a
pair it does not own.

A row can also name a ``shadow`` pipeline. The shadow extracts and transforms
while the owner keeps writing, and the batch loaders compare its batch with
the stored resources instead of loading it
(``learning_resources.etl.shadow.run_shadow``). What it would have changed is
saved as an ETLShadowRun. ``run_mode`` tells an entry point which of the three
it is doing: write, shadow or skip. ``may_write`` is never true for a shadow,
nor for anyone inside a shadow run, so a shadow writes nothing.
"""

import logging
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from enum import StrEnum

from learning_resources.models import ETLSourceOwnership

log = logging.getLogger(__name__)

Pipeline = ETLSourceOwnership.Pipeline

_current_pipeline: ContextVar[str] = ContextVar(
    "etl_current_pipeline", default=Pipeline.LEGACY
)


class OwnershipError(Exception):
    """Raised when a pipeline writes an (etl_source, resource_type) it does not own."""


@contextmanager
def writing_as(pipeline: str) -> Iterator[None]:
    """Declare which pipeline the loaders called inside this block are running for."""
    token = _current_pipeline.set(Pipeline(pipeline))
    try:
        yield
    finally:
        _current_pipeline.reset(token)


def current_pipeline() -> str:
    """Return the pipeline declared by the enclosing ``writing_as`` (legacy if none)."""
    return _current_pipeline.get()


class RunMode(StrEnum):
    """What a pipeline's run does for the pairs it loads."""

    WRITE = "write"
    SHADOW = "shadow"
    SKIP = "skip"


_shadow_run: ContextVar[bool] = ContextVar("etl_shadow_run", default=False)


@contextmanager
def shadowing() -> Iterator[None]:
    """
    Mark the block as a shadow run. Only ``run_shadow`` enters it, because it
    is what collects what the batch loaders report inside the block.
    """
    token = _shadow_run.set(True)
    try:
        yield
    finally:
        _shadow_run.reset(token)


def is_shadow_run() -> bool:
    """Whether the caller is inside a shadow run, which must write nothing."""
    return _shadow_run.get()


def _get_row(etl_source: str, resource_type: str) -> ETLSourceOwnership | None:
    return ETLSourceOwnership.objects.filter(
        etl_source=etl_source, resource_type=resource_type
    ).first()


def get_owner(etl_source: str, resource_type: str) -> str:
    """Return the pipeline that owns an (etl_source, resource_type) pair."""
    row = _get_row(etl_source, resource_type)
    return row.owner if row else Pipeline.LEGACY


def run_mode(etl_source: str, resource_types: str | Iterable[str]) -> RunMode:
    """
    Return what the current pipeline's run does for ``resource_types`` of a source.

    WRITE if it owns every one of them. A batch loader that writes several
    types together (a podcast and its episodes) needs all of them: owning only
    some would leave the rest to a pipeline that never receives them.

    SHADOW if it is the owner or the shadow of every one and the shadow of at
    least one. Nothing is written inside a shadow run, so the types it owns
    are not written by that run either.

    SKIP otherwise.
    """
    if isinstance(resource_types, str):
        resource_types = [resource_types]
    pipeline = current_pipeline()
    mode = RunMode.WRITE
    not_owned = {}
    for resource_type in resource_types:
        row = _get_row(etl_source, resource_type)
        owner = row.owner if row else Pipeline.LEGACY
        if owner == pipeline:
            continue
        if row and row.shadow == pipeline:
            mode = RunMode.SHADOW
        else:
            not_owned[resource_type] = owner
    if not_owned:
        log.info(
            "Skipping %s write for %s: owned by %s",
            pipeline,
            etl_source,
            ", ".join(f"{rtype}={owner}" for rtype, owner in not_owned.items()),
        )
        return RunMode.SKIP
    return mode


def may_write(etl_source: str, resource_types: str | Iterable[str]) -> bool:
    """
    Return whether the current pipeline may write ``resource_types`` of a
    source: it owns every one of them and is not inside a shadow run.
    """
    return not is_shadow_run() and run_mode(etl_source, resource_types) == RunMode.WRITE


def assert_owner(etl_source: str, resource_types: str | Iterable[str]) -> None:
    """
    Raise unless the current pipeline owns every one of ``resource_types``.

    For entry points that must fail rather than skip, e.g. the webhook handler,
    where a silent skip would report success to a sender that delivered nothing.
    """
    if not may_write(etl_source, resource_types):
        msg = (
            f"{current_pipeline()} does not own {etl_source}/{resource_types}. "
            "Set its ETLSourceOwnership row in Django admin to cut it over."
        )
        raise OwnershipError(msg)
