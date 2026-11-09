"""Unit tests for learning_resources.lib.warehouse.

Intentionally avoids loading the full Django application — patches
django.conf.settings directly so these tests run in milliseconds with no
database setup required.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import ANY, MagicMock, patch

import django
import pytest
from celery.exceptions import MaxRetriesExceededError, Retry
from django.conf import settings as django_settings
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings
from freezegun import freeze_time

# Configure Django minimally if not already configured — keeps this test
# module self-contained and fast (no database, no app registry needed).
if not django_settings.configured:
    django_settings.configure(
        WAREHOUSE_BACKEND="starrocks",
        STARROCKS_HOST="starrocks.example.com",
        STARROCKS_PORT=9030,
        STARROCKS_USER="testuser",
        STARROCKS_PASSWORD="secret",  # noqa: S106
        WAREHOUSE_CATALOG="ol_data_lake_production",
        WAREHOUSE_SCHEMA="ol_warehouse_production_integrations",
    )
    django.setup()

# `caches["durable"]` (the incremental watermark store) is only touched on
# the full_refresh=False path — every test below mocks it directly rather
# than configuring a real CACHES setting, keeping this module's "no
# database, no app registry" guarantee intact.


from learning_resources.etl import shadow
from learning_resources.etl.ownership import (
    Pipeline,
    RunMode,
    current_pipeline,
    is_shadow_run,
    may_write,
)
from learning_resources.factories import ETLSourceOwnershipFactory
from learning_resources.lib.warehouse import (
    _WATERMARK_LOOKBACK,
    SYNC_LOCK_CACHE,
    SYNC_LOCK_MAX_RETRIES,
    SYNC_LOCK_RETRY_SECONDS,
    SYNC_LOCK_SECONDS,
    BaseWarehouseETLTask,
    connect_to_warehouse,
    iter_group_stats,
    iter_rows,
)
from learning_resources.models import ETLShadowRun

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _patch_settings(**kwargs):
    """Return a patcher that overrides specific Django settings values."""
    return patch.multiple("django.conf.settings", **kwargs)


def _warehouse_settings(**overrides):
    settings = {
        "WAREHOUSE_BACKEND": "starrocks",
        "STARROCKS_HOST": "starrocks.example.com",
        "STARROCKS_PORT": 9030,
        "STARROCKS_USER": "testuser",
        "STARROCKS_PASSWORD": "secret",
    }
    settings.update(overrides)
    return settings


def _make_cursor(columns, rows):
    """Build a minimal mock cursor returning all rows in one batch then empty."""
    cursor = MagicMock()
    cursor.description = [(col,) for col in columns]
    cursor.fetchmany.side_effect = [rows, []]
    return cursor


# ---------------------------------------------------------------------------
# connect_to_warehouse
# ---------------------------------------------------------------------------


@patch("pymysql.connect")
def test_connect_to_warehouse_starrocks_uses_settings(mock_connect):
    """connect_to_warehouse dispatches to StarRocks and passes settings through."""
    mock_conn = MagicMock()
    mock_connect.return_value = mock_conn

    with _patch_settings(**_warehouse_settings()):
        result = connect_to_warehouse()

    assert result is mock_conn
    call_kwargs = mock_connect.call_args.kwargs
    assert call_kwargs["host"] == "starrocks.example.com"
    assert call_kwargs["port"] == 9030
    assert call_kwargs["user"] == "testuser"
    assert call_kwargs["password"] == "secret"  # noqa: S105
    assert "database" not in call_kwargs


@patch("pymysql.connect", side_effect=OSError("unreachable"))
def test_connect_to_warehouse_propagates_exception(mock_connect):
    """connect_to_warehouse re-raises connection errors."""
    with (
        _patch_settings(**_warehouse_settings()),
        pytest.raises(OSError, match="unreachable"),
    ):
        connect_to_warehouse()


def test_connect_to_warehouse_requires_host_and_user():
    """connect_to_warehouse fails fast when STARROCKS_HOST/USER are unset,
    rather than letting pymysql attempt host=None/user=None.
    """
    with (
        _patch_settings(**_warehouse_settings(STARROCKS_HOST=None)),
        pytest.raises(ImproperlyConfigured, match="STARROCKS_HOST"),
    ):
        connect_to_warehouse()


def test_connect_to_warehouse_rejects_unknown_backend():
    """connect_to_warehouse raises ValueError for an unconfigured backend name."""
    with (
        _patch_settings(**_warehouse_settings(WAREHOUSE_BACKEND="snowflake")),
        pytest.raises(ValueError, match="Unknown WAREHOUSE_BACKEND"),
    ):
        connect_to_warehouse()


# ---------------------------------------------------------------------------
# iter_rows
# ---------------------------------------------------------------------------


def test_iter_rows_yields_column_keyed_dicts():
    """iter_rows converts raw tuples to column-keyed dicts."""
    conn = MagicMock()
    cursor = _make_cursor(["id", "title"], [(1, "Course A"), (2, "Course B")])
    conn.cursor.return_value = cursor

    rows = list(iter_rows(conn, "catalog.schema.my_view"))

    assert rows == [
        {"id": 1, "title": "Course A"},
        {"id": 2, "title": "Course B"},
    ]


def test_iter_rows_respects_batch_size():
    """iter_rows passes batch_size to fetchmany."""
    conn = MagicMock()
    cursor = _make_cursor(["id"], [(1,), (2,)])
    conn.cursor.return_value = cursor

    list(iter_rows(conn, "catalog.schema.my_view", batch_size=500))

    cursor.fetchmany.assert_any_call(500)


def test_iter_rows_closes_cursor_on_success():
    """iter_rows always closes the cursor on normal exit."""
    conn = MagicMock()
    cursor = _make_cursor(["id"], [])
    conn.cursor.return_value = cursor

    list(iter_rows(conn, "catalog.schema.view"))

    cursor.close.assert_called_once()


def test_iter_rows_closes_cursor_on_error():
    """iter_rows closes the cursor even when execution raises."""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.execute.side_effect = RuntimeError("query failed")
    conn.cursor.return_value = cursor

    with pytest.raises(RuntimeError):
        list(iter_rows(conn, "catalog.schema.view"))

    cursor.close.assert_called_once()


@pytest.mark.parametrize(
    "bad_name",
    [
        "'; DROP TABLE courses; --",
        "schema.table; DELETE FROM users",
        "schema.table WHERE 1=1",
        "../etc/passwd",
        pytest.param("schema.table\n", id="trailing-newline"),
    ],
)
def test_iter_rows_rejects_unsafe_view_names(bad_name):
    """iter_rows raises ValueError for names that could allow SQL injection."""
    conn = MagicMock()
    with pytest.raises(ValueError, match="Unsafe view name"):
        list(iter_rows(conn, bad_name))


def test_iter_rows_without_since_has_no_where_clause():
    """A full-refresh pull (since=None) queries the view unfiltered."""
    conn = MagicMock()
    cursor = _make_cursor(["id"], [])
    conn.cursor.return_value = cursor

    list(iter_rows(conn, "catalog.schema.my_view"))

    query = cursor.execute.call_args.args[0]
    assert query == "SELECT * FROM catalog.schema.my_view"


def test_iter_rows_with_since_filters_on_last_modified():
    """An incremental pull (since=<timestamp>) adds a last_modified predicate."""
    conn = MagicMock()
    cursor = _make_cursor(["id"], [])
    conn.cursor.return_value = cursor
    since = datetime(2026, 6, 15, 12, 30, 0, tzinfo=UTC)

    list(iter_rows(conn, "catalog.schema.my_view", since=since))

    query = cursor.execute.call_args.args[0]
    assert query == (
        "SELECT * FROM catalog.schema.my_view "
        "WHERE last_modified > '2026-06-15 12:30:00.000'"
    )


def test_iter_rows_with_where_binds_its_values():
    """A where filter is parameterized, and combines with since."""
    conn = MagicMock()
    cursor = _make_cursor(["id"], [])
    conn.cursor.return_value = cursor
    since = datetime(2026, 6, 15, 12, 30, 0, tzinfo=UTC)

    list(
        iter_rows(
            conn,
            "catalog.schema.my_view",
            since=since,
            where={"etl_source": "ocw", "run_readable_id": "a'b"},
        )
    )

    cursor.execute.assert_called_once_with(
        "SELECT * FROM catalog.schema.my_view WHERE etl_source = %s "
        "AND run_readable_id = %s AND last_modified > '2026-06-15 12:30:00.000'",
        ["ocw", "a'b"],
    )


def test_iter_group_stats_aggregates_each_column():
    """iter_group_stats asks for a count and a max of each column, per group."""
    conn = MagicMock()
    cursor = _make_cursor(
        ["run_readable_id", "row_count", "last_modified_count", "last_modified_max"],
        [("run-1", 3, 2, "2026-10-20")],
    )
    conn.cursor.return_value = cursor

    rows = list(
        iter_group_stats(
            conn,
            "catalog.schema.my_view",
            "run_readable_id",
            columns=("last_modified",),
            where={"etl_source": "ocw"},
        )
    )

    assert rows == [
        {
            "run_readable_id": "run-1",
            "row_count": 3,
            "last_modified_count": 2,
            "last_modified_max": "2026-10-20",
        }
    ]
    cursor.execute.assert_called_once_with(
        "SELECT run_readable_id, COUNT(*) AS row_count, "
        "COUNT(last_modified) AS last_modified_count, "
        "MAX(last_modified) AS last_modified_max "
        "FROM catalog.schema.my_view WHERE etl_source = %s "
        "GROUP BY run_readable_id",
        ["ocw"],
    )


@pytest.mark.parametrize(
    ("group_by", "columns", "where"),
    [
        ("run; DROP TABLE x", (), None),
        ("run_id", ("last_modified) --",), None),
        ("run_id", (), {"etl_source = 1 OR 1": "x"}),
    ],
)
def test_iter_group_stats_rejects_unsafe_column_names(group_by, columns, where):
    """Column names go into the SQL, so anything but an identifier is refused."""
    with pytest.raises(ValueError, match="Unsafe column name"):
        list(
            iter_group_stats(
                MagicMock(),
                "catalog.schema.view",
                group_by,
                columns=columns,
                where=where,
            )
        )


def test_iter_group_stats_rejects_unsafe_view_names():
    """iter_group_stats checks the view name as iter_rows does."""
    with pytest.raises(ValueError, match="Unsafe view name"):
        list(iter_group_stats(MagicMock(), "view; DROP TABLE x", "run_id"))


def test_iter_rows_rejects_unsafe_where_columns():
    """A where column goes into the SQL, so anything but an identifier is refused."""
    with pytest.raises(ValueError, match="Unsafe column name"):
        list(iter_rows(MagicMock(), "catalog.schema.view", where={"a = 1 --": "x"}))


def test_iter_rows_accepts_dotted_identifiers():
    """iter_rows accepts fully-qualified catalog.schema.table names."""
    conn = MagicMock()
    cursor = _make_cursor(["id"], [])
    conn.cursor.return_value = cursor

    # Should not raise
    list(
        iter_rows(
            conn,
            "ol_data_lake_production.ol_warehouse_production_integrations."
            "integrations__learn__ocw_courses",
        )
    )


def test_iter_rows_defers_description_until_first_fetch():
    """Some DB-API drivers only populate cursor.description once results
    start arriving, not immediately after execute() (PEP 249 leaves this
    driver-defined) — iter_rows must not read it until after the first
    fetchmany call.
    """
    conn = MagicMock()
    cursor = MagicMock()
    cursor.description = None
    calls = []

    def _fetchmany(size):
        if not calls:
            calls.append(1)
            cursor.description = [("id",), ("title",)]
            return [(1, "Course A")]
        return []

    cursor.fetchmany.side_effect = _fetchmany
    conn.cursor.return_value = cursor

    rows = list(iter_rows(conn, "catalog.schema.my_view"))

    assert rows == [{"id": 1, "title": "Course A"}]


# ---------------------------------------------------------------------------
# BaseWarehouseETLTask
# ---------------------------------------------------------------------------


class _ConcreteTask(BaseWarehouseETLTask):
    name = "test.ConcreteTask"
    table_name = "integrations__learn__test"
    writes = None

    def fetch_and_upsert(self, conn, *, since=None, **_) -> int:  # noqa: ARG002
        return 42


class _ErrorTask(BaseWarehouseETLTask):
    name = "test.ErrorTask"
    table_name = "integrations__learn__test"
    writes = None

    def fetch_and_upsert(self, conn, *, since=None, **_) -> int:  # noqa: ARG002
        msg = "downstream failure"
        raise RuntimeError(msg)


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_base_warehouse_etl_task_run_success(mock_connect):
    """run() calls fetch_and_upsert, closes the connection, and returns row count."""
    mock_conn = MagicMock()
    mock_connect.return_value = mock_conn

    result = _ConcreteTask().run()

    assert result == 42
    mock_conn.close.assert_called_once()


class _FlagRecordingTask(BaseWarehouseETLTask):
    name = "test.FlagRecordingTask"
    table_name = "integrations__learn__test"
    writes = None

    def fetch_and_upsert(
        self,
        conn,  # noqa: ARG002
        *,
        since=None,  # noqa: ARG002
        allow_mass_unpublish=False,
    ) -> int:
        self.allow_mass_unpublish = allow_mass_unpublish
        return 0


@pytest.mark.parametrize(
    ("kwargs", "allow"),
    [
        ({"allow_mass_unpublish": True}, True),
        ({}, False),
        ({"allow_mass_unpublish": "false"}, False),
        ({"allow_mass_unpublish": 1}, False),
    ],
)
@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_base_warehouse_etl_task_forwards_allow_mass_unpublish(
    mock_connect, kwargs, allow
):
    """
    run() hands fetch_and_upsert the flag itself, not Celery's request, so it
    holds for a direct call. Only the boolean True lifts the limit.
    """
    mock_connect.return_value = MagicMock()
    task = _FlagRecordingTask()

    task.run(**kwargs)

    assert task.allow_mass_unpublish is allow


class _PipelineRecordingTask(BaseWarehouseETLTask):
    name = "test.PipelineRecordingTask"
    table_name = "integrations__learn__test"
    writes = None

    def fetch_and_upsert(self, conn, *, since=None, **_) -> int:  # noqa: ARG002
        self.pipeline = current_pipeline()
        return 0


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_base_warehouse_etl_task_writes_as_the_warehouse_pipeline(mock_connect):
    """Loaders called from fetch_and_upsert see the warehouse pipeline, and only there."""
    mock_connect.return_value = MagicMock()
    task = _PipelineRecordingTask()

    task.run()

    assert task.pipeline == Pipeline.WAREHOUSE
    assert current_pipeline() == Pipeline.LEGACY


class _CatalogTask(_PipelineRecordingTask):
    name = "test.CatalogTask"
    writes = ("ocw", ["course"])


@pytest.mark.parametrize("owned", [True, False])
@patch("learning_resources.lib.warehouse.run_mode")
@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_base_warehouse_etl_task_runs_only_what_the_warehouse_owns(
    mock_connect, mock_run_mode, owned
):
    """A task whose pair the warehouse doesn't own returns 0 without connecting."""
    mock_run_mode.side_effect = lambda *_: (
        RunMode.WRITE
        if current_pipeline() == Pipeline.WAREHOUSE and owned
        else RunMode.SKIP
    )
    task = _CatalogTask()
    task.pipeline = None

    assert task.run() == 0

    mock_run_mode.assert_called_once_with("ocw", ["course"])
    assert mock_connect.called is owned
    assert task.pipeline == (Pipeline.WAREHOUSE if owned else None)


class _ShadowRecordingTask(BaseWarehouseETLTask):
    name = "test.ShadowRecordingTask"
    table_name = "integrations__learn__test"
    writes = ("ocw", ["course"])

    def fetch_and_upsert(self, conn, *, since=None, **_) -> int:  # noqa: ARG002
        self.seen = (is_shadow_run(), since, may_write(*self.writes))
        # what a batch loader hands to the comparison in place of loading
        shadow.observe(
            "ocw",
            "course",
            [{"readable_id": readable_id, "platform": "ocw"} for readable_id in "ab"],
            prune=False,
        )
        return 0


@pytest.mark.django_db
@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_base_warehouse_etl_task_shadows_a_pair(mock_connect):
    """
    As a pair's shadow the task does a full load inside a shadow run, saves the
    report, returns how many items it compared and leaves the watermark alone,
    even when queued as incremental.
    """
    mock_connect.return_value = MagicMock()
    ETLSourceOwnershipFactory.create(
        etl_source="ocw", resource_type="course", shadow=Pipeline.WAREHOUSE
    )
    task = _ShadowRecordingTask()

    with (
        patch.object(task, "_get_watermark") as mock_get_watermark,
        patch.object(task, "_set_watermark") as mock_set_watermark,
    ):
        assert task.run(full_refresh=False) == 2

    assert task.seen == (True, None, False)
    mock_get_watermark.assert_not_called()
    mock_set_watermark.assert_not_called()
    run = ETLShadowRun.objects.get()
    assert (run.etl_source, run.resource_type, run.pipeline) == (
        "ocw",
        "course",
        Pipeline.WAREHOUSE,
    )
    assert is_shadow_run() is False


def test_subclass_must_say_what_it_writes():
    """A task with no writes declaration would run unchecked beside the owner."""
    with pytest.raises(TypeError, match="must set writes"):

        class _UndeclaredTask(BaseWarehouseETLTask):
            table_name = "integrations__learn__test"


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_base_warehouse_etl_task_closes_connection_on_error(mock_connect):
    """run() closes the warehouse connection even when fetch_and_upsert raises."""
    mock_conn = MagicMock()
    mock_connect.return_value = mock_conn

    with pytest.raises(RuntimeError, match="downstream failure"):
        _ErrorTask().run()

    mock_conn.close.assert_called_once()


@patch("learning_resources.lib.warehouse.sentry_sdk")
@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_base_warehouse_etl_task_adds_sentry_breadcrumb_on_error(
    mock_connect, mock_sentry
):
    """run() adds a Sentry breadcrumb at error level when fetch_and_upsert fails."""
    mock_connect.return_value = MagicMock()

    with pytest.raises(RuntimeError):
        _ErrorTask().run()

    mock_sentry.add_breadcrumb.assert_called_once()
    call_kwargs = mock_sentry.add_breadcrumb.call_args.kwargs
    assert call_kwargs["level"] == "error"
    assert call_kwargs["category"] == "warehouse_etl"


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_base_warehouse_etl_task_raises_when_table_name_empty(mock_connect):
    """run() raises ValueError immediately when table_name is not set."""

    class _NoViewTask(BaseWarehouseETLTask):
        table_name = ""
        writes = None

        def fetch_and_upsert(self, conn) -> int:  # noqa: ARG002
            return 0

    with pytest.raises(ValueError, match="table_name must be set"):
        _NoViewTask().run()

    mock_connect.assert_not_called()


def test_view_name_defaults_to_the_production_catalog():
    """With no override, view_name reads the production integrations schema,
    matching the literal every task carried before it was configurable.
    """
    assert _ConcreteTask().view_name == (
        "ol_data_lake_production.ol_warehouse_production_integrations"
        ".integrations__learn__test"
    )


def test_view_name_follows_warehouse_settings():
    """WAREHOUSE_CATALOG/WAREHOUSE_SCHEMA point every task at another
    environment's lake, e.g. QA reading ol_data_lake_qa.
    """
    with override_settings(
        WAREHOUSE_CATALOG="ol_data_lake_qa",
        WAREHOUSE_SCHEMA="ol_warehouse_qa_integrations",
    ):
        assert _ConcreteTask().view_name == (
            "ol_data_lake_qa.ol_warehouse_qa_integrations.integrations__learn__test"
        )


@pytest.mark.parametrize(
    ("setting", "value"),
    [
        ("WAREHOUSE_CATALOG", "ol_data_lake_qa.other"),
        ("WAREHOUSE_SCHEMA", "schema; DROP TABLE x"),
        ("WAREHOUSE_SCHEMA", ""),
    ],
)
@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_view_name_rejects_unsafe_setting_parts(mock_connect, setting, value):
    """Each part is checked on its own: a dotted WAREHOUSE_CATALOG would still
    pass iter_rows's check once composed, but address a different catalog.
    """
    with (
        override_settings(**{setting: value}),
        pytest.raises(ValueError, match="Unsafe warehouse identifier"),
    ):
        _ConcreteTask().run()

    mock_connect.assert_not_called()


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_view_name_rejects_dotted_table_name(mock_connect):
    """A dotted table_name would reach into another schema of the same catalog."""

    class _DottedTask(BaseWarehouseETLTask):
        table_name = "other_schema.integrations__learn__test"
        writes = None

        def fetch_and_upsert(self, conn, *, since=None, **_) -> int:  # noqa: ARG002
            return 0

    with pytest.raises(ValueError, match="Unsafe warehouse identifier"):
        _DottedTask().run()

    mock_connect.assert_not_called()


def test_subclass_cannot_pin_view_name():
    """Assigning view_name on a subclass would bypass WAREHOUSE_* entirely."""
    with pytest.raises(TypeError, match="must set table_name, not view_name"):

        class _PinnedTask(BaseWarehouseETLTask):
            view_name = "ol_data_lake_production.schema.view"


def test_base_warehouse_etl_task_fetch_and_upsert_is_abstract():
    """fetch_and_upsert raises NotImplementedError on the base class."""
    task = BaseWarehouseETLTask()
    task.table_name = "view"
    with pytest.raises(NotImplementedError):
        task.fetch_and_upsert(conn=None)


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_base_warehouse_etl_task_rejects_non_int_return(mock_connect):
    """A subclass that forgets `return count` (implicitly returning None,
    or any other non-int) fails loudly, and — critically — never advances
    the watermark, so the run's data isn't silently skipped by every
    future incremental pull.
    """
    mock_connect.return_value = MagicMock()

    class _BrokenTask(BaseWarehouseETLTask):
        name = "test.BrokenTask"
        table_name = "integrations__learn__test"
        writes = None

        def fetch_and_upsert(self, conn, *, since=None, **_):
            pass  # forgot to return count

    task = _BrokenTask()
    mock_cache = MagicMock()

    with patch("learning_resources.lib.warehouse.caches") as mock_caches:
        mock_caches.__getitem__.return_value = mock_cache
        with pytest.raises(TypeError, match="must return int"):
            task.run(full_refresh=False)

    mock_cache.set.assert_not_called()


def test_a_sync_stops_inside_its_lock_and_the_broker_redelivery():
    """
    A run can't outlive the lock that keeps a second run out, or the hour after
    which the broker hands an unacknowledged task to another worker
    """
    redis_visibility_timeout = 60 * 60  # kombu's default; main/ doesn't set one
    assert BaseWarehouseETLTask.time_limit < SYNC_LOCK_SECONDS
    assert BaseWarehouseETLTask.time_limit < redis_visibility_timeout
    assert _ConcreteTask().time_limit == BaseWarehouseETLTask.time_limit
    assert BaseWarehouseETLTask.reject_on_worker_lost is True


def test_base_warehouse_etl_task_acks_late():
    """acks_late=True, matching the rest of the ETL task fleet (get_ocw_data,
    ingest_edx_run_archive, etc.) — a worker lost mid-pull shouldn't lose
    the message.
    """
    assert BaseWarehouseETLTask.acks_late is True


# ---------------------------------------------------------------------------
# full_refresh vs. incremental
# ---------------------------------------------------------------------------


class _RecordingTask(BaseWarehouseETLTask):
    """Records the `since` it was called with instead of hitting a real view."""

    name = "test.RecordingTask"
    table_name = "integrations__learn__test"
    writes = None

    def fetch_and_upsert(self, conn, *, since=None, **_) -> int:  # noqa: ARG002
        self.seen_since = since
        return 7


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_full_refresh_defaults_to_true_and_passes_since_none(mock_connect):
    """Calling run() with no kwargs is a full refresh: since=None, no watermark I/O."""
    mock_connect.return_value = MagicMock()
    task = _RecordingTask()

    with patch("learning_resources.lib.warehouse.caches") as mock_caches:
        result = task.run()

    assert result == 7
    assert task.seen_since is None
    # only the sync lock
    assert {c.args for c in mock_caches.__getitem__.call_args_list} == {
        (SYNC_LOCK_CACHE,)
    }


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_incremental_reads_watermark_and_passes_it_through(mock_connect):
    """full_refresh=False reads the last recorded watermark and forwards it."""
    mock_connect.return_value = MagicMock()
    task = _RecordingTask()
    stored_watermark = datetime(2026, 6, 1, tzinfo=UTC)
    mock_cache = MagicMock()
    mock_cache.get.return_value = stored_watermark

    with patch("learning_resources.lib.warehouse.caches") as mock_caches:
        mock_caches.__getitem__.return_value = mock_cache
        result = task.run(full_refresh=False)

    assert result == 7
    assert task.seen_since is stored_watermark
    # first the watermark, then the sync lock on the way out
    assert mock_cache.get.call_args_list[0].args == (
        "warehouse_etl:last_synced_at:test.RecordingTask",
    )


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_incremental_with_no_prior_watermark_passes_since_none(mock_connect):
    """An incremental run with no recorded watermark yet behaves like a full pull."""
    mock_connect.return_value = MagicMock()
    task = _RecordingTask()
    mock_cache = MagicMock()
    mock_cache.get.return_value = None

    with patch("learning_resources.lib.warehouse.caches") as mock_caches:
        mock_caches.__getitem__.return_value = mock_cache
        task.run(full_refresh=False)

    assert task.seen_since is None


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_incremental_advances_watermark_on_success(mock_connect):
    """A successful incremental run stores a fresh watermark, durably."""
    mock_connect.return_value = MagicMock()
    task = _RecordingTask()
    mock_cache = MagicMock()
    mock_cache.get.return_value = None

    with patch("learning_resources.lib.warehouse.caches") as mock_caches:
        mock_caches.__getitem__.return_value = mock_cache
        task.run(full_refresh=False)

    mock_caches.__getitem__.assert_called_with("durable")
    mock_cache.set.assert_called_once()
    call_args = mock_cache.set.call_args
    assert call_args.args[0] == "warehouse_etl:last_synced_at:test.RecordingTask"
    assert isinstance(call_args.args[1], datetime)
    assert call_args.kwargs["timeout"] is None


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_full_refresh_does_not_advance_watermark(mock_connect):
    """A full-refresh run never writes to the watermark cache."""
    mock_connect.return_value = MagicMock()
    task = _RecordingTask()

    with patch("learning_resources.lib.warehouse.caches") as mock_caches:
        task.run(full_refresh=True)

    # only the sync lock
    assert {c.args for c in mock_caches.__getitem__.call_args_list} == {
        (SYNC_LOCK_CACHE,)
    }
    mock_caches.__getitem__.return_value.set.assert_not_called()


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_incremental_watermark_is_stamped_before_fetch_not_after(mock_connect):
    """The watermark records when the fetch *started* (minus the lookback
    window), not when it finished.

    Otherwise a row modified while a long-running fetch is in flight would
    fall in the gap between this pull's window and the next incremental
    run's `since` — invisible until the next full_refresh heals it.
    """
    mock_connect.return_value = MagicMock()
    fetch_started_at = datetime(2026, 6, 1, 12, 0, 0, tzinfo=UTC)

    with freeze_time(fetch_started_at) as frozen_time:

        class _SlowTask(BaseWarehouseETLTask):
            name = "test.SlowTask"
            table_name = "integrations__learn__test"
            writes = None

            def fetch_and_upsert(self, conn, *, since=None, **_) -> int:  # noqa: ARG002
                # Simulate a fetch that takes real wall-clock time.
                frozen_time.tick(timedelta(minutes=10))
                return 3

        task = _SlowTask()
        mock_cache = MagicMock()
        mock_cache.get.return_value = None

        with patch("learning_resources.lib.warehouse.caches") as mock_caches:
            mock_caches.__getitem__.return_value = mock_cache
            task.run(full_refresh=False)

    stored_watermark = mock_cache.set.call_args.args[1]
    assert stored_watermark == fetch_started_at - _WATERMARK_LOOKBACK


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_incremental_does_not_advance_watermark_on_failure(mock_connect):
    """A failed incremental run leaves the watermark untouched (retry re-covers the gap)."""
    mock_connect.return_value = MagicMock()

    class _FailingTask(BaseWarehouseETLTask):
        name = "test.FailingTask"
        table_name = "integrations__learn__test"
        writes = None

        def fetch_and_upsert(self, conn, *, since=None, **_) -> int:  # noqa: ARG002
            msg = "boom"
            raise RuntimeError(msg)

    task = _FailingTask()
    mock_cache = MagicMock()
    mock_cache.get.return_value = None

    with (
        patch("learning_resources.lib.warehouse.caches") as mock_caches,
        patch("learning_resources.lib.warehouse.sentry_sdk"),
    ):
        mock_caches.__getitem__.return_value = mock_cache
        with pytest.raises(RuntimeError, match="boom"):
            task.run(full_refresh=False)

    mock_cache.set.assert_not_called()


def test_qualified_name_qualifies_any_view_with_the_warehouse_settings():
    """A task that reads several views gets each from the configured schema"""
    with override_settings(
        WAREHOUSE_CATALOG="ol_data_lake_qa",
        WAREHOUSE_SCHEMA="ol_warehouse_qa_integrations",
    ):
        assert _ConcreteTask.qualified_name("integrations__learn__other") == (
            "ol_data_lake_qa.ol_warehouse_qa_integrations.integrations__learn__other"
        )
    with pytest.raises(ValueError, match="Unsafe warehouse identifier"):
        _ConcreteTask.qualified_name("other; drop table x")


# ---------------------------------------------------------------------------
# One run at a time
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("task_class", [_ConcreteTask, _ErrorTask])
@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_run_holds_the_sync_lock_until_it_finishes(mock_connect, task_class):
    """A run takes the task's lock before reading and lets it go, even on error"""
    mock_lock = MagicMock()
    mock_lock.add.return_value = True
    mock_lock.get.side_effect = lambda _key: mock_lock.add.call_args.args[1]
    mock_connect.return_value = MagicMock()

    with (
        patch("learning_resources.lib.warehouse.caches") as mock_caches,
        patch("learning_resources.lib.warehouse.sentry_sdk"),
    ):
        mock_caches.__getitem__.return_value = mock_lock
        try:
            task_class().run()
        except RuntimeError:
            assert task_class is _ErrorTask

    mock_caches.__getitem__.assert_any_call(SYNC_LOCK_CACHE)
    key = f"warehouse_etl:running:{task_class.name}"
    mock_lock.add.assert_called_once_with(key, ANY, timeout=SYNC_LOCK_SECONDS)
    mock_lock.delete.assert_called_once_with(key)


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_run_that_outlived_its_lock_leaves_the_next_runs_lock(mock_connect):
    """A run whose lock expired and was taken by another run doesn't release it"""
    mock_lock = MagicMock()
    mock_lock.add.return_value = True
    mock_lock.get.return_value = "another run's token"
    mock_connect.return_value = MagicMock()

    with patch("learning_resources.lib.warehouse.caches") as mock_caches:
        mock_caches.__getitem__.return_value = mock_lock
        assert _ConcreteTask().run() == 42

    mock_lock.delete.assert_not_called()


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_run_requeues_while_another_run_holds_the_lock(mock_connect):
    """A run that finds the lock held re-queues itself rather than waiting in the worker"""
    mock_lock = MagicMock()
    mock_lock.add.return_value = False
    task = _ConcreteTask()

    with (
        patch("learning_resources.lib.warehouse.caches") as mock_caches,
        patch.object(task, "retry", side_effect=Retry()) as mock_retry,
    ):
        mock_caches.__getitem__.return_value = mock_lock
        with pytest.raises(Retry):
            task.run()

    mock_retry.assert_called_once_with(
        countdown=SYNC_LOCK_RETRY_SECONDS, max_retries=SYNC_LOCK_MAX_RETRIES
    )
    mock_lock.delete.assert_not_called()
    mock_connect.assert_not_called()


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_run_gives_up_to_the_next_run_after_its_retries(mock_connect):
    """Past the retry cap, what the run would have read is left to the next run"""
    mock_lock = MagicMock()
    mock_lock.add.return_value = False
    task = _ConcreteTask()

    with (
        patch("learning_resources.lib.warehouse.caches") as mock_caches,
        patch.object(task, "retry", side_effect=MaxRetriesExceededError()),
    ):
        mock_caches.__getitem__.return_value = mock_lock
        assert task.run() == 0

    mock_lock.delete.assert_not_called()
    mock_connect.assert_not_called()


def test_run_takes_no_lock_when_the_warehouse_does_not_own_the_pair():
    """A run that skips for ownership doesn't hold up one that would write"""
    with (
        patch("learning_resources.lib.warehouse.run_mode", return_value=RunMode.SKIP),
        patch("learning_resources.lib.warehouse.caches") as mock_caches,
    ):
        assert _CatalogTask().run() == 0

    mock_caches.__getitem__.assert_not_called()
