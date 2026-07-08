"""Unit tests for learning_resources.lib.warehouse.

Intentionally avoids loading the full Django application — patches
django.conf.settings directly so these tests run in milliseconds with no
database setup required.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import django
import pytest
from django.conf import settings as django_settings
from freezegun import freeze_time

# Configure Django minimally if not already configured — keeps this test
# module self-contained and fast (no database, no app registry needed).
if not django_settings.configured:
    django_settings.configure(
        WAREHOUSE_BACKEND="trino",
        TRINO_HOST="trino.example.com",
        TRINO_PORT=443,
        TRINO_USER="testuser",
        TRINO_PASSWORD="secret",  # noqa: S106
        TRINO_CATALOG="ol_warehouse_production",
    )
    django.setup()

# `caches["durable"]` (the incremental watermark store) is only touched on
# the full_refresh=False path — every test below mocks it directly rather
# than configuring a real CACHES setting, keeping this module's "no
# database, no app registry" guarantee intact.


from learning_resources.lib.warehouse import (
    BaseWarehouseETLTask,
    connect_to_warehouse,
    iter_rows,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _patch_settings(**kwargs):
    """Return a patcher that overrides specific Django settings values."""
    return patch.multiple("django.conf.settings", **kwargs)


def _warehouse_settings(**overrides):
    settings = {
        "WAREHOUSE_BACKEND": "trino",
        "TRINO_HOST": "trino.example.com",
        "TRINO_PORT": 443,
        "TRINO_USER": "testuser",
        "TRINO_PASSWORD": "secret",
        "TRINO_CATALOG": "ol_warehouse_production",
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


@patch("trino.dbapi.connect")
def test_connect_to_warehouse_trino_uses_settings(mock_connect):
    """connect_to_warehouse dispatches to Trino and passes Django settings through."""
    mock_conn = MagicMock()
    mock_connect.return_value = mock_conn

    with _patch_settings(**_warehouse_settings()):
        result = connect_to_warehouse()

    assert result is mock_conn
    call_kwargs = mock_connect.call_args.kwargs
    assert call_kwargs["host"] == "trino.example.com"
    assert call_kwargs["port"] == 443
    assert call_kwargs["user"] == "testuser"
    assert call_kwargs["catalog"] == "ol_warehouse_production"


@patch("trino.dbapi.connect", side_effect=OSError("unreachable"))
def test_connect_to_warehouse_propagates_exception(mock_connect):
    """connect_to_warehouse re-raises connection errors."""
    with (
        _patch_settings(**_warehouse_settings()),
        pytest.raises(OSError, match="unreachable"),
    ):
        connect_to_warehouse()


def test_connect_to_warehouse_rejects_unknown_backend():
    """connect_to_warehouse raises ValueError for an unconfigured backend name."""
    with (
        _patch_settings(**_warehouse_settings(WAREHOUSE_BACKEND="snowflake")),
        pytest.raises(ValueError, match="Unknown WAREHOUSE_BACKEND"),
    ):
        connect_to_warehouse()


def test_connect_to_warehouse_starrocks_not_yet_implemented():
    """The starrocks backend is a documented placeholder, not yet wired up."""
    with (
        _patch_settings(**_warehouse_settings(WAREHOUSE_BACKEND="starrocks")),
        pytest.raises(NotImplementedError, match="starrocks"),
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
        "WHERE last_modified > TIMESTAMP '2026-06-15 12:30:00.000'"
    )


def test_iter_rows_accepts_dotted_identifiers():
    """iter_rows accepts fully-qualified catalog.schema.table names."""
    conn = MagicMock()
    cursor = _make_cursor(["id"], [])
    conn.cursor.return_value = cursor

    # Should not raise
    list(
        iter_rows(
            conn,
            "ol_warehouse_production.integrations.integrations__learn__ocw_courses",
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
    view_name = "ol_warehouse_production.integrations.integrations__learn__test"

    def fetch_and_upsert(self, conn, *, since=None) -> int:  # noqa: ARG002
        return 42


class _ErrorTask(BaseWarehouseETLTask):
    name = "test.ErrorTask"
    view_name = "ol_warehouse_production.integrations.integrations__learn__test"

    def fetch_and_upsert(self, conn, *, since=None) -> int:  # noqa: ARG002
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
def test_base_warehouse_etl_task_raises_when_view_name_empty(mock_connect):
    """run() raises ValueError immediately when view_name is not set."""

    class _NoViewTask(BaseWarehouseETLTask):
        view_name = ""

        def fetch_and_upsert(self, conn) -> int:  # noqa: ARG002
            return 0

    with pytest.raises(ValueError, match="view_name must be set"):
        _NoViewTask().run()

    mock_connect.assert_not_called()


def test_base_warehouse_etl_task_fetch_and_upsert_is_abstract():
    """fetch_and_upsert raises NotImplementedError on the base class."""
    task = BaseWarehouseETLTask()
    task.view_name = "catalog.schema.view"
    with pytest.raises(NotImplementedError):
        task.fetch_and_upsert(conn=None)


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
    view_name = "ol_warehouse_production.integrations.integrations__learn__test"

    def fetch_and_upsert(self, conn, *, since=None) -> int:  # noqa: ARG002
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
    mock_caches.__getitem__.assert_not_called()


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
    mock_cache.get.assert_called_once_with(
        "warehouse_etl:last_synced_at:test.RecordingTask"
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

    mock_caches.__getitem__.assert_not_called()


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_incremental_watermark_is_stamped_before_fetch_not_after(mock_connect):
    """The watermark records when the fetch *started*, not when it finished.

    Otherwise a row modified while a long-running fetch is in flight would
    fall in the gap between this pull's window and the next incremental
    run's `since` — invisible until the next full_refresh heals it.
    """
    mock_connect.return_value = MagicMock()
    fetch_started_at = datetime(2026, 6, 1, 12, 0, 0, tzinfo=UTC)

    with freeze_time(fetch_started_at) as frozen_time:

        class _SlowTask(BaseWarehouseETLTask):
            name = "test.SlowTask"
            view_name = "ol_warehouse_production.integrations.integrations__learn__test"

            def fetch_and_upsert(self, conn, *, since=None) -> int:  # noqa: ARG002
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
    assert stored_watermark == fetch_started_at


@patch("learning_resources.lib.warehouse.connect_to_warehouse")
def test_incremental_does_not_advance_watermark_on_failure(mock_connect):
    """A failed incremental run leaves the watermark untouched (retry re-covers the gap)."""
    mock_connect.return_value = MagicMock()

    class _FailingTask(BaseWarehouseETLTask):
        name = "test.FailingTask"
        view_name = "ol_warehouse_production.integrations.integrations__learn__test"

        def fetch_and_upsert(self, conn, *, since=None) -> int:  # noqa: ARG002
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
