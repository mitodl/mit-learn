"""SQL warehouse pull infrastructure for data platform consumption.

Query engine is not hard-wired into the ETL tasks or row-iteration logic:
the concrete backend is selected at connect time via ``settings.WAREHOUSE_BACKEND``.
Trino is the only implemented backend today; the OL Data Platform may migrate
this endpoint to StarRocks later, and since both expose a standard Python
DB-API 2.0 cursor (``execute`` / ``fetchmany`` / ``description``), adding that
backend should only mean filling in ``_connect_starrocks`` below — ``iter_rows``
and ``BaseWarehouseETLTask`` need no changes.
"""

import logging
import re
import time
from datetime import UTC, datetime

import sentry_sdk
from celery import Task
from django.conf import settings
from django.core.cache import caches
from django.core.exceptions import ImproperlyConfigured

log = logging.getLogger(__name__)

# Only alphanumeric, underscores, and dots (schema.table notation). `\Z`
# (not `$`) is deliberate: `$` matches just before a trailing newline, which
# would let a `view_name` ending in "\n" slip through this check.
_SAFE_IDENTIFIER = re.compile(r"^[a-zA-Z0-9_.]+\Z")

# Cache alias for sync watermarks: must outlive Redis flushes (an evicted
# watermark just makes the next incremental run fetch a wider-than-necessary
# window, which is safe — see BaseWarehouseETLTask.fetch_and_upsert's
# ``since`` contract), but should not require a dedicated model + migration
# for what is ETL bookkeeping, not domain data.
_WATERMARK_CACHE = "durable"
_WATERMARK_SQL_FORMAT = "%Y-%m-%d %H:%M:%S.%f"


def _connect_trino():
    """Open a Trino DB-API connection using Django settings.

    Raises:
        ImproperlyConfigured: If TRINO_HOST or TRINO_USER is unset — fails
            fast with a clear message instead of BasicAuthentication
            silently pairing None/None credentials and connect() attempting
            host=None/user=None (Trino requires a non-empty user even for
            unauthenticated connections).
    """
    from trino.auth import BasicAuthentication
    from trino.dbapi import connect

    if not settings.TRINO_HOST or not settings.TRINO_USER:
        msg = (
            "WAREHOUSE_BACKEND is 'trino' but TRINO_HOST/TRINO_USER are not "
            "set. Set TRINO_HOST/TRINO_USER/TRINO_PASSWORD/TRINO_CATALOG, "
            "or switch WAREHOUSE_BACKEND to a configured backend."
        )
        raise ImproperlyConfigured(msg)

    auth = (
        BasicAuthentication(settings.TRINO_USER, settings.TRINO_PASSWORD)
        if settings.TRINO_USER and settings.TRINO_PASSWORD
        else None
    )
    return connect(
        host=settings.TRINO_HOST,
        port=settings.TRINO_PORT,
        user=settings.TRINO_USER,
        auth=auth,
        catalog=settings.TRINO_CATALOG,
    )


def _connect_starrocks():
    """Open a StarRocks DB-API connection using Django settings.

    Not yet implemented — no StarRocks endpoint is provisioned for MIT
    Learn. StarRocks speaks the MySQL wire protocol and the same DB-API 2.0
    cursor surface Trino does, so this should be a drop-in connect() call
    (e.g. via ``mysql-connector-python`` or ``starrocks``) once one exists.
    """
    msg = "The starrocks warehouse backend is not yet implemented"
    raise NotImplementedError(msg)


_CONNECTORS = {
    "trino": _connect_trino,
    "starrocks": _connect_starrocks,
}


def connect_to_warehouse():
    """Open and return a DB-API connection for the configured warehouse backend.

    Returns:
        A DB-API 2.0 connection (``trino.dbapi.Connection`` today).

    Raises:
        ValueError: If ``settings.WAREHOUSE_BACKEND`` names an unknown backend.
        Exception: propagated if the connection attempt fails.
    """
    backend = settings.WAREHOUSE_BACKEND
    try:
        connector = _CONNECTORS[backend]
    except KeyError:
        msg = f"Unknown WAREHOUSE_BACKEND: {backend!r}"
        raise ValueError(msg) from None

    try:
        conn = connector()
    except Exception:
        log.exception("Failed to connect to warehouse backend %s", backend)
        raise
    log.info("Connected to warehouse backend %s", backend)
    return conn


def iter_rows(conn, view_name, *, since=None, batch_size=1000):
    """Iterate over rows in a warehouse view as column-keyed dicts.

    Backend-agnostic: relies only on the DB-API 2.0 cursor surface
    (``execute`` / ``description`` / ``fetchmany``), which Trino and
    StarRocks both implement.

    Args:
        conn: An open DB-API connection.
        view_name (str): Schema-qualified view name, e.g.
            ``"integrations.integrations__learn__ocw_courses"`` — not
            catalog-qualified; the connection's configured catalog (e.g.
            ``settings.TRINO_CATALOG``) supplies that. A fully-qualified
            ``catalog.schema.table`` name also works if callers want to
            override the connection's default catalog for one query. Must
            contain only alphanumeric characters, underscores, and dots.
        since (datetime | None): If given, only rows whose ``last_modified``
            column is greater than this timestamp are returned — every
            ``integrations__learn__*`` view exposes ``last_modified`` per the
            contract in ol-data-platform's docs/learn_marts_contract.md, so
            this is safe to assume for any view passed here. ``None`` (the
            default) pulls every row.
        batch_size (int): Rows fetched per round-trip.

    Yields:
        dict: One row, keyed by column name.

    Raises:
        ValueError: If *view_name* contains characters that could allow SQL injection.
    """
    if not _SAFE_IDENTIFIER.match(view_name):
        msg = f"Unsafe view name: {view_name!r}"
        raise ValueError(msg)

    query = f"SELECT * FROM {view_name}"  # noqa: S608
    if since is not None:
        # `since` is produced by our own watermark tracking, never user
        # input, so a formatted literal is safe here (no parameterization
        # needed) — and `TIMESTAMP '...'` literal syntax is understood by
        # Trino, StarRocks/MySQL, and DuckDB alike.
        watermark = since.strftime(_WATERMARK_SQL_FORMAT)[:-3]
        query += f" WHERE last_modified > TIMESTAMP '{watermark}'"

    cur = conn.cursor()
    try:
        cur.execute(query)
        # Read columns from the first non-empty batch rather than
        # immediately after execute(): some DB-API drivers only populate
        # `description` once results start arriving, not at execute()
        # time (PEP 249 leaves this driver-defined).
        columns = None
        while True:
            batch = cur.fetchmany(batch_size)
            if not batch:
                break
            if columns is None:
                columns = [d[0] for d in cur.description]
            for row in batch:
                yield dict(zip(columns, row))
    finally:
        cur.close()


class BaseWarehouseETLTask(Task):
    """Celery task base class for warehouse-pull ETL jobs.

    Subclasses declare ``view_name`` and implement
    ``fetch_and_upsert(conn, *, since)``. Register concrete subclasses via
    ``app.register_task(SubclassTask())`` — a class decorated with
    ``@app.task(base=BaseWarehouseETLTask)`` does *not* work: Celery's
    function-task machinery wraps the decorated object as a ``staticmethod``
    and calls it positionally, which — given a class — tries to instantiate
    it as the task body instead of running its bound
    ``run()``/``fetch_and_upsert()`` methods.

    Two sync modes, selected by the ``full_refresh`` kwarg passed to
    ``run()``/``.delay()``/``.apply_async()``:

    - ``full_refresh=True`` (the default, and what the daily beat schedule
      uses today): ``since`` is ``None`` — ``fetch_and_upsert`` pulls every
      row and should prune resources no longer present in the source. This
      is the self-healing baseline: it's the only mode that ever sees
      deletes/unpublishes upstream.
    - ``full_refresh=False``: ``since`` is this task's last recorded
      watermark (or ``None`` if it has never completed an incremental run,
      in which case it behaves like a full pull). ``fetch_and_upsert``
      should pass ``since`` through to ``iter_rows`` and skip pruning —
      a partial pull must never be treated as the complete state of the
      source. On success the watermark is advanced to "now".

    Example::

        class SyncOCWCoursesTask(BaseWarehouseETLTask):
            name = "learning_resources.tasks.SyncOCWCoursesTask"
            view_name = "integrations.integrations__learn__ocw_courses"

            def fetch_and_upsert(self, conn, *, since=None):
                for row in iter_rows(conn, self.view_name, since=since):
                    upsert_ocw_course(row, prune=since is None)

        SyncOCWCoursesTask = app.register_task(SyncOCWCoursesTask())
    """

    abstract = True
    acks_late = True
    view_name: str = ""

    def run(self, *args, full_refresh: bool = True, **kwargs):  # noqa: ARG002
        """Open a warehouse connection, delegate to ``fetch_and_upsert``, log counts."""
        if not self.view_name:
            msg = f"{self.__class__.__name__}.view_name must be set"
            raise ValueError(msg)

        since = None if full_refresh else self._get_watermark()
        # Captured before the fetch, not after: a row modified while the
        # fetch is in flight must still be picked up by the *next*
        # incremental run. Stamping the watermark post-fetch would let it
        # fall between this window and the next, invisible until the next
        # full_refresh heals it.
        fetch_started_at = datetime.now(tz=UTC)

        conn = connect_to_warehouse()
        start = time.monotonic()
        try:
            count = self.fetch_and_upsert(conn, since=since)
        except Exception:
            log.exception("Warehouse ETL task %s failed", self.name)
            sentry_sdk.add_breadcrumb(
                category="warehouse_etl",
                message=f"{self.name} failed",
                data={"view_name": self.view_name, "full_refresh": full_refresh},
                level="error",
            )
            raise
        finally:
            conn.close()

        if not full_refresh:
            self._set_watermark(fetch_started_at)

        elapsed = time.monotonic() - start
        log.info(
            "Warehouse ETL task %s finished (%s): %d rows in %.1fs",
            self.name,
            "full_refresh" if full_refresh else "incremental",
            count,
            elapsed,
        )
        return count

    def fetch_and_upsert(self, conn, *, since=None) -> int:
        """Pull rows from the warehouse and upsert into Django models.

        Args:
            conn: An open DB-API connection (will be closed by ``run``).
            since (datetime | None): Forwarded from ``run()``. ``None`` means
                a full refresh — pull everything and prune. Otherwise, pull
                only rows changed since this watermark and skip pruning.

        Returns:
            int: Number of rows processed.
        """
        raise NotImplementedError

    def _watermark_cache_key(self) -> str:
        return f"warehouse_etl:last_synced_at:{self.name}"

    def _get_watermark(self):
        """Return this task's last recorded incremental watermark, if any."""
        return caches[_WATERMARK_CACHE].get(self._watermark_cache_key())

    def _set_watermark(self, value: datetime) -> None:
        """Persist ``value`` as this task's incremental watermark."""
        caches[_WATERMARK_CACHE].set(self._watermark_cache_key(), value, timeout=None)
