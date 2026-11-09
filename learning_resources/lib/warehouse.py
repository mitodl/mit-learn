"""SQL warehouse pull infrastructure for data platform consumption.

Query engine is not hard-wired into the ETL tasks or row-iteration logic:
the concrete backend is selected at connect time via
``settings.WAREHOUSE_BACKEND``. StarRocks is the only implemented backend
today, but any engine exposing a standard Python DB-API 2.0 cursor
(``execute`` / ``fetchmany`` / ``description`` — e.g. DuckDB) is a drop-in
addition: add a ``_connect_<backend>`` function and register it in
``_CONNECTORS`` below. ``BaseWarehouseETLTask`` needs no changes to support a
new backend. ``iter_rows`` and ``iter_group_stats`` bind values with ``%s``, so
one with another paramstyle needs that passed through.
"""

import logging
import re
import time
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import sentry_sdk
from celery import Task
from celery.exceptions import MaxRetriesExceededError
from django.conf import settings
from django.core.cache import caches
from django.core.exceptions import ImproperlyConfigured

from learning_resources.etl.ownership import Pipeline, RunMode, run_mode, writing_as
from learning_resources.etl.shadow import run_shadow

log = logging.getLogger(__name__)

# Only alphanumeric, underscores, and dots (schema.table notation). `\Z`
# (not `$`) is deliberate: `$` matches just before a trailing newline, which
# would let a `view_name` ending in "\n" slip through this check.
_SAFE_IDENTIFIER = re.compile(r"^[a-zA-Z0-9_.]+\Z")
# One catalog, schema or table name. No dots: a WAREHOUSE_SCHEMA of "a.b"
# would pass _SAFE_IDENTIFIER once composed but point at a different catalog.
_SAFE_NAME_PART = re.compile(r"^[a-zA-Z0-9_]+\Z")

# Cache alias for sync state (watermarks, sync generations): must outlive
# Redis flushes (an evicted watermark just makes the next incremental run
# fetch a wider-than-necessary window, which is safe, see
# BaseWarehouseETLTask.fetch_and_upsert's ``since`` contract), but should not
# require a dedicated model + migration for what is ETL bookkeeping, not
# domain data.
WAREHOUSE_STATE_CACHE = "durable"
_WATERMARK_SQL_FORMAT = "%Y-%m-%d %H:%M:%S.%f"

# A run of a sync holds a lock, so that two runs of it never prune at once on
# reads that predate each other's writes: the daily beat entry and a webhook, or
# two webhooks. A run that finds the lock held re-queues itself rather than
# holding a worker slot, and gives up once the lock would have expired, leaving
# what it would have read to the sync's next run. A worker killed mid-run holds
# up the sync until then. The time limit keeps a run inside its lock, and inside
# the hour after which the broker redelivers an unacknowledged task (kombu's
# Redis visibility_timeout), so a redelivered copy can't prune beside it. It is
# hard, so it fires whatever the sync is doing.
SYNC_LOCK_CACHE = "redis"
SYNC_LOCK_SECONDS = 60 * 60
SYNC_TIME_LIMIT_SECONDS = 55 * 60
SYNC_LOCK_RETRY_SECONDS = 60
SYNC_LOCK_MAX_RETRIES = 60

# Subtracted from the wall-clock watermark before it's stored: this consumer
# doesn't know the warehouse's own build/replication lag, so a row modified
# just before fetch_started_at could still be invisible in the queried view
# at query time (a dbt run hasn't rebuilt yet, an Iceberg commit hasn't
# landed) and would otherwise be permanently skipped by every future
# incremental pull, since its true last_modified is already below the
# watermark. This overlap trades a few harmlessly-reprocessed rows each
# incremental run (upsert is idempotent) for closing that skip window, as
# long as warehouse lag never exceeds it.
_WATERMARK_LOOKBACK = timedelta(minutes=10)


def _connect_starrocks():
    """Open a StarRocks DB-API connection using Django settings.

    No database is set at connect time — pymysql's `database=` becomes
    MySQL's COM_INIT_DB, which StarRocks resolves as a database name (or a
    `catalog.database` pair), never a bare catalog name alone. Every
    view_name used with this connection must stay fully catalog-qualified
    (catalog.database.table) as a result — see iter_rows's docstring.

    Raises:
        ImproperlyConfigured: If STARROCKS_HOST or STARROCKS_USER is unset —
            fails fast with a clear message instead of pymysql attempting
            host=None/user=None.
    """
    import pymysql

    if not settings.STARROCKS_HOST or not settings.STARROCKS_USER:
        msg = (
            "WAREHOUSE_BACKEND is 'starrocks' but STARROCKS_HOST/"
            "STARROCKS_USER are not set. Set STARROCKS_HOST/STARROCKS_PORT/"
            "STARROCKS_USER/STARROCKS_PASSWORD, or switch WAREHOUSE_BACKEND "
            "to a configured backend."
        )
        raise ImproperlyConfigured(msg)

    return pymysql.connect(
        host=settings.STARROCKS_HOST,
        port=settings.STARROCKS_PORT,
        user=settings.STARROCKS_USER,
        password=settings.STARROCKS_PASSWORD,
        cursorclass=pymysql.cursors.Cursor,
    )


_CONNECTORS = {
    "starrocks": _connect_starrocks,
}


def connect_to_warehouse():
    """Open and return a DB-API connection for the configured warehouse backend.

    Returns:
        A DB-API 2.0 connection (``pymysql.connections.Connection`` today).

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


def _check_view_name(view_name):
    """
    Refuse a view name that isn't a dotted identifier.

    Raises:
        ValueError: If *view_name* contains characters that could allow SQL
            injection.
    """
    if not _SAFE_IDENTIFIER.match(view_name):
        msg = f"Unsafe view name: {view_name!r}"
        raise ValueError(msg)


def _equal_conditions(where):
    """
    Build the SQL conditions and parameters for column = value pairs.

    Raises:
        ValueError: If a column name is not a plain identifier.
    """
    where = where or {}
    for column in where:
        if not _SAFE_NAME_PART.match(column):
            msg = f"Unsafe column name: {column!r}"
            raise ValueError(msg)
    return [f"{column} = %s" for column in where], list(where.values())


def _fetch_rows(conn, query, params, batch_size):
    """Run a query and yield its rows as column-keyed dicts."""
    cur = conn.cursor()
    try:
        cur.execute(query, params or None)
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


def iter_rows(conn, view_name, *, since=None, where=None, batch_size=1000):
    """Iterate over rows in a warehouse view as column-keyed dicts.

    The connection's default cursor reads the whole result into memory at
    ``execute``, whatever ``batch_size`` says, so a view too large to hold
    has to be read through ``where``.

    Args:
        conn: An open DB-API connection.
        view_name (str): Schema-qualified view name, e.g.
            ``"ol_data_lake_production.ol_warehouse_production_integrations."
            "integrations__learn__ocw_courses"``. A bare ``schema.table``
            name also works if the connection's default database supplies
            the catalog. Must contain only alphanumeric characters,
            underscores, and dots.
        since (datetime | None): If given, only rows whose ``last_modified``
            column is greater than this timestamp are returned — every
            ``integrations__learn__*`` view exposes ``last_modified`` per the
            contract in ol-data-platform's docs/learn_marts_contract.md, so
            this is safe to assume for any view passed here. ``None`` (the
            default) pulls every row.
        where (dict | None): Column names and the values they must equal.
        batch_size (int): Rows fetched per round-trip.

    Yields:
        dict: One row, keyed by column name.

    Raises:
        ValueError: If *view_name* or a column in *where* contains characters
            that could allow SQL injection.
    """
    _check_view_name(view_name)
    conditions, params = _equal_conditions(where)
    if since is not None:
        # `since` is produced by our own watermark tracking, never user
        # input, so a formatted literal is safe here (no parameterization
        # needed). A bare quoted string, NOT a `TIMESTAMP '...'` literal —
        # confirmed against a live StarRocks instance that the `TIMESTAMP`
        # keyword form is a syntax error there (StarRocks implicitly casts
        # a string literal compared against a DATETIME column instead).
        watermark = since.strftime(_WATERMARK_SQL_FORMAT)[:-3]
        conditions.append(f"last_modified > '{watermark}'")

    query = f"SELECT * FROM {view_name}"  # noqa: S608
    if conditions:
        query += f" WHERE {' AND '.join(conditions)}"
    yield from _fetch_rows(conn, query, params, batch_size)


def iter_group_stats(  # noqa: PLR0913
    conn, view_name, group_by, *, columns=(), where=None, batch_size=1000
):
    """Iterate over one row of aggregates per value of a column of a view.

    For a view too large to read whole, to tell which groups are worth reading.

    Args:
        conn: An open DB-API connection.
        view_name (str): The view, as for ``iter_rows``.
        group_by (str): The column to group by.
        columns (Sequence[str]): Columns to aggregate.
        where (dict | None): Column names and the values they must equal.
        batch_size (int): Rows fetched per round-trip.

    Yields:
        dict: ``group_by``'s value, ``row_count``, and ``<column>_count`` (rows
        where it is not null) and ``<column>_max`` for each of ``columns``.

    Raises:
        ValueError: If *view_name* or a column contains characters that could
            allow SQL injection.
    """
    _check_view_name(view_name)
    for column in (group_by, *columns):
        if not _SAFE_NAME_PART.match(column):
            msg = f"Unsafe column name: {column!r}"
            raise ValueError(msg)

    aggregates = "".join(
        f", COUNT({column}) AS {column}_count, MAX({column}) AS {column}_max"
        for column in columns
    )
    conditions, params = _equal_conditions(where)
    query = f"SELECT {group_by}, COUNT(*) AS row_count{aggregates} FROM {view_name}"  # noqa: S608
    if conditions:
        query += f" WHERE {' AND '.join(conditions)}"
    query += f" GROUP BY {group_by}"
    yield from _fetch_rows(conn, query, params, batch_size)


def run_locked(  # noqa: PLR0913
    task, lock_key, work, *, lock_seconds, retry_seconds, max_retries
):
    """Run ``work`` holding a lock, or re-queue ``task`` while another holds it.

    The lock is taken without blocking, so a task waiting for it doesn't hold
    a worker slot. A run that outlives its lock leaves the lock of the run
    that took it next alone.

    Args:
        task (celery.Task): the running task, bound, which re-queues itself
        lock_key (str): what the lock excludes
        work (Callable[[], T]): what to run holding it
        lock_seconds (int): how long the lock lasts if it is never released
        retry_seconds (int): how long to wait before trying again
        max_retries (int): how many times to try again

    Returns:
        T | None: what ``work`` returned, or None once the retries are spent

    Raises:
        celery.exceptions.Retry: when the lock is held and retries are left
    """
    lock = caches[SYNC_LOCK_CACHE]
    token = uuid.uuid4().hex
    if not lock.add(lock_key, token, timeout=lock_seconds):
        try:
            raise task.retry(countdown=retry_seconds, max_retries=max_retries)
        except MaxRetriesExceededError:
            return None
    try:
        return work()
    finally:
        if lock.get(lock_key) == token:
            lock.delete(lock_key)


class BaseWarehouseETLTask(Task):
    """Celery task base class for warehouse-pull ETL jobs.

    Subclasses declare ``table_name`` (the bare view name, e.g.
    ``"integrations__learn__ocw_courses"``) and ``writes`` (the
    ``(etl_source, resource_types)`` the task loads, or ``None`` for a task
    that loads no catalog resource), and implement
    ``fetch_and_upsert(conn, *, since, allow_mass_unpublish)``. ``run``
    returns 0 without connecting unless ETLSourceOwnership names the
    warehouse for every one of those resource types, as their owner or as
    their shadow. As a shadow,
    the batch is compared with the stored resources and reported instead of
    loaded (see ``learning_resources.etl.shadow``), which only happens in the
    batch loaders named there: a ``fetch_and_upsert`` that writes any other
    way, or hands its writes to other tasks, must not do so when
    ``ownership.is_shadow_run()``. ``view_name`` qualifies it with
    ``settings.WAREHOUSE_CATALOG`` and ``settings.WAREHOUSE_SCHEMA``, so the
    same task reads ``ol_data_lake_qa`` in QA and ``ol_data_lake_production``
    in production. Register concrete subclasses via
    ``app.register_task(SubclassTask())`` — a class decorated with
    ``@app.task(base=BaseWarehouseETLTask)`` does *not* work: Celery's
    function-task machinery wraps the decorated object as a ``staticmethod``
    and calls it positionally, which — given a class — tries to instantiate
    it as the task body instead of running its bound
    ``run()``/``fetch_and_upsert()`` methods.

    One run of a task syncs at a time, whoever queued it. A run queued while
    another holds the task's lock re-queues itself (see ``SYNC_LOCK_SECONDS``).

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
      source. On success the watermark is advanced to "now minus
      ``_WATERMARK_LOOKBACK``" (not exactly "now") — see that constant's
      comment for why a bare wall-clock watermark can permanently skip
      warehouse rows under build/replication lag.

    ``allow_mass_unpublish=True``, passed the same way, reaches
    ``fetch_and_upsert`` whether the task was queued or ``run()`` was called
    directly. A task that refuses to unpublish a large share of its source
    lifts that limit on it; the others ignore it. Only the boolean counts: a
    serialized ``"false"`` is truthy.

    Example::

        class SyncOCWCoursesTask(BaseWarehouseETLTask):
            name = "learning_resources.tasks.SyncOCWCoursesTask"
            table_name = "integrations__learn__ocw_courses"
            writes = ("ocw", ["course"])

            def fetch_and_upsert(
                self, conn, *, since=None, allow_mass_unpublish=False
            ):
                for row in iter_rows(conn, self.view_name, since=since):
                    upsert_ocw_course(row, prune=since is None)

        SyncOCWCoursesTask = app.register_task(SyncOCWCoursesTask())
    """

    abstract = True
    acks_late = True
    reject_on_worker_lost = True
    time_limit = SYNC_TIME_LIMIT_SECONDS
    table_name: str = ""
    # No default: a task that forgot to say what it writes would run as a
    # second writer next to the pair's owner.
    writes: tuple[str, Sequence[str]] | None

    def __init_subclass__(cls, **kwargs):
        """Reject subclasses that set ``view_name`` or leave ``writes`` unset.

        A ``view_name`` class attribute would shadow the property below and
        read whatever catalog it names, whatever environment this runs in.
        """
        super().__init_subclass__(**kwargs)
        if "view_name" in cls.__dict__:
            msg = f"{cls.__name__} must set table_name, not view_name"
            raise TypeError(msg)
        if not hasattr(cls, "writes"):
            msg = (
                f"{cls.__name__} must set writes to the (etl_source, "
                "resource_types) it loads, or to None if it loads no catalog "
                "resource"
            )
            raise TypeError(msg)

    @property
    def view_name(self) -> str:
        """``table_name`` qualified as ``catalog.schema.table`` from settings.

        Fully qualified because the connection sets no default database; see
        ``_connect_starrocks``.

        Raises:
            ValueError: If ``table_name`` is unset, or any part is not a
                plain identifier.
        """
        if not self.table_name:
            msg = f"{self.__class__.__name__}.table_name must be set"
            raise ValueError(msg)
        return self.qualified_name(self.table_name)

    @staticmethod
    def qualified_name(table_name: str) -> str:
        """Qualify a bare view name as ``catalog.schema.table`` from settings.

        For a task that reads more than the one view ``table_name`` names.

        Raises:
            ValueError: If any part is not a plain identifier.
        """
        parts = (settings.WAREHOUSE_CATALOG, settings.WAREHOUSE_SCHEMA, table_name)
        for part in parts:
            if not _SAFE_NAME_PART.match(part):
                msg = f"Unsafe warehouse identifier: {part!r}"
                raise ValueError(msg)
        return ".".join(parts)

    def run(
        self,
        *args,  # noqa: ARG002
        full_refresh: bool = True,
        allow_mass_unpublish: bool = False,
        **kwargs,  # noqa: ARG002
    ):
        """Open a warehouse connection, delegate to ``fetch_and_upsert``, log counts."""
        view_name = self.view_name

        mode = RunMode.WRITE
        if self.writes is not None:
            with writing_as(Pipeline.WAREHOUSE):
                mode = run_mode(*self.writes)
            if mode == RunMode.SKIP:
                return 0
        # A shadow run is always a full one, so that its report includes what
        # the prune would unpublish, and it leaves the watermark alone.
        if mode == RunMode.SHADOW:
            full_refresh = True

        count = run_locked(
            self,
            f"warehouse_etl:running:{self.name}",
            lambda: self._sync(
                mode,
                view_name,
                full_refresh=full_refresh,
                allow_mass_unpublish=allow_mass_unpublish,
            ),
            lock_seconds=SYNC_LOCK_SECONDS,
            retry_seconds=SYNC_LOCK_RETRY_SECONDS,
            max_retries=SYNC_LOCK_MAX_RETRIES,
        )
        if count is None:
            log.warning(
                "Gave up waiting for a run of %s, leaving it to the next one",
                self.name,
            )
            return 0
        return count

    def _sync(
        self,
        mode: RunMode,
        view_name: str,
        *,
        full_refresh: bool,
        allow_mass_unpublish: bool,
    ) -> int:
        """Run one sync that ``run`` has decided to make, holding its lock."""
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
            # The loaders check ownership again as the pipeline named here.
            with writing_as(Pipeline.WAREHOUSE):
                if mode == RunMode.SHADOW:
                    # the loaders return nothing in a shadow, so count what
                    # they compared instead
                    _, runs = run_shadow(
                        [self.writes],
                        lambda: self.fetch_and_upsert(
                            conn,
                            since=None,
                            allow_mass_unpublish=allow_mass_unpublish is True,
                        ),
                    )
                    count = sum(run.counts.get("items", 0) for run in runs)
                else:
                    count = self.fetch_and_upsert(
                        conn,
                        since=since,
                        allow_mass_unpublish=allow_mass_unpublish is True,
                    )
        except Exception:
            log.exception("Warehouse ETL task %s failed", self.name)
            sentry_sdk.add_breadcrumb(
                category="warehouse_etl",
                message=f"{self.name} failed",
                data={"view_name": view_name, "full_refresh": full_refresh},
                level="error",
            )
            raise
        finally:
            conn.close()

        # A subclass that forgets `return count` (or returns the wrong
        # type) implicitly returns None — checked before advancing the
        # watermark, not just before the %d-formatted log line below, so a
        # broken fetch_and_upsert fails loudly here instead of silently
        # advancing the watermark and then crashing on the log call,
        # which would permanently skip whatever this run should have
        # picked up (the watermark update wouldn't roll back on that
        # crash).
        if not isinstance(count, int):
            msg = (
                f"{self.__class__.__name__}.fetch_and_upsert must return "
                f"int, got {type(count).__name__}"
            )
            raise TypeError(msg)

        if not full_refresh:
            self._set_watermark(fetch_started_at - _WATERMARK_LOOKBACK)

        elapsed = time.monotonic() - start
        if mode == RunMode.SHADOW:
            log.info(
                "Warehouse ETL task %s finished (shadow): %d items compared in %.1fs",
                self.name,
                count,
                elapsed,
            )
        else:
            log.info(
                "Warehouse ETL task %s finished (%s): %d rows in %.1fs",
                self.name,
                "full_refresh" if full_refresh else "incremental",
                count,
                elapsed,
            )
        return count

    def fetch_and_upsert(
        self, conn, *, since=None, allow_mass_unpublish: bool = False
    ) -> int:
        """Pull rows from the warehouse and upsert into Django models.

        Args:
            conn: An open DB-API connection (will be closed by ``run``).
            since (datetime | None): Forwarded from ``run()``. ``None`` means
                a full refresh — pull everything and prune. Otherwise, pull
                only rows changed since this watermark and skip pruning.
            allow_mass_unpublish (bool): Forwarded from ``run()``. Lifts the
                limit on how much of a source one run may unpublish.

        Returns:
            int: Number of rows processed.
        """
        raise NotImplementedError

    def _watermark_cache_key(self) -> str:
        return f"warehouse_etl:last_synced_at:{self.name}"

    def _get_watermark(self):
        """Return this task's last recorded incremental watermark, if any."""
        return caches[WAREHOUSE_STATE_CACHE].get(self._watermark_cache_key())

    def _set_watermark(self, value: datetime) -> None:
        """Persist ``value`` as this task's incremental watermark."""
        caches[WAREHOUSE_STATE_CACHE].set(
            self._watermark_cache_key(), value, timeout=None
        )
