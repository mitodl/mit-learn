"""
Per-(etl_source, resource_type) write-ownership guard.

Batch pull-ETL loaders (load_courses, load_programs, the canvas stale-course
sweep) implement full-sync unpublish/delete: anything not present in the
current batch is treated as removed upstream. If a push pipeline (webhook or
Dagster asset) also writes the same (etl_source, resource_type), each side's
full sync treats the other side's writes as missing, causing
unpublish/republish flapping.

ETLSourceOwnership records which pipeline currently owns writes for a given
pair. A missing row defaults to "pull" so existing sources are unaffected
until a row is explicitly created to cut a source over to push. Pull loaders
should call `pull_write_allowed` (or the stricter `assert_pull_allowed`)
before writing/pruning; push loaders should call `assert_push_allowed`
before writing, so a push pipeline can't silently write into a pair that
pull-ETL still owns and will prune on its next run.
"""

import logging

from learning_resources.models import ETLSourceOwnership

log = logging.getLogger(__name__)

PULL = ETLSourceOwnership.Mode.PULL
PUSH = ETLSourceOwnership.Mode.PUSH


class OwnershipError(Exception):
    """Raised when a loader writes to an (etl_source, resource_type) it does not own."""


def get_ownership_mode(etl_source: str, resource_type: str) -> str:
    """
    Return the write-ownership mode for an (etl_source, resource_type) pair.

    Defaults to PULL when no row exists.
    """
    row = ETLSourceOwnership.objects.filter(
        etl_source=etl_source, resource_type=resource_type
    ).first()
    return row.mode if row else PULL


def is_push_owned(etl_source: str, resource_type: str) -> bool:
    """Whether an (etl_source, resource_type) pair is push-owned."""
    return get_ownership_mode(etl_source, resource_type) == PUSH


def pull_write_allowed(etl_source: str, resource_type: str) -> bool:
    """Whether a pull-ETL loader may write/prune this (etl_source, resource_type)."""
    return not is_push_owned(etl_source, resource_type)


def assert_pull_allowed(etl_source: str, resource_type: str) -> None:
    """Hard guard for pull loaders: raise if this pair has been cut over to push."""
    if is_push_owned(etl_source, resource_type):
        msg = (
            f"Refusing pull write: {etl_source}/{resource_type} is push-owned. "
            "This source has been cut over to a push pipeline; the pull-ETL "
            "loader must not write or prune it."
        )
        raise OwnershipError(msg)


def assert_push_allowed(etl_source: str, resource_type: str) -> None:
    """
    Guard for push (webhook/event) loaders: raise unless this
    (etl_source, resource_type) has been explicitly cut over to push
    ownership. Prevents a push loader from writing into a pair that pull-ETL
    still owns and will prune/overwrite on its next scheduled run.
    """
    if not is_push_owned(etl_source, resource_type):
        msg = (
            f"Refusing push write: {etl_source}/{resource_type} is pull-owned. "
            "Create an ETLSourceOwnership row set to push before enabling "
            "push writes for this source."
        )
        raise OwnershipError(msg)
