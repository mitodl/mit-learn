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
``get_ocw_data``). The loaders themselves do not check.
"""

import logging
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar

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


def get_owner(etl_source: str, resource_type: str) -> str:
    """Return the pipeline that owns an (etl_source, resource_type) pair."""
    row = ETLSourceOwnership.objects.filter(
        etl_source=etl_source, resource_type=resource_type
    ).first()
    return row.owner if row else Pipeline.LEGACY


def may_write(etl_source: str, resource_types: str | Iterable[str]) -> bool:
    """
    Whether the current pipeline owns every one of ``resource_types`` for a source.

    A batch loader that writes several types together (a podcast and its
    episodes) needs all of them: owning only some would leave the rest to a
    pipeline that never receives them.
    """
    if isinstance(resource_types, str):
        resource_types = [resource_types]
    pipeline = current_pipeline()
    not_owned = {
        resource_type: owner
        for resource_type in resource_types
        if (owner := get_owner(etl_source, resource_type)) != pipeline
    }
    if not_owned:
        log.info(
            "Skipping %s write for %s: owned by %s",
            pipeline,
            etl_source,
            ", ".join(f"{rtype}={owner}" for rtype, owner in not_owned.items()),
        )
    return not not_owned


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
