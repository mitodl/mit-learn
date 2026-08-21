"""Integration tests for learning_resources.lib.warehouse against a real
StarRocks instance (the `starrocks/allin1-ubuntu` image — see
docker-compose.services.yml and .github/workflows/ci.yml).

Skipped entirely unless STARROCKS_HOST is configured, so a local `pytest`
run without the `backend` compose profile up (or without CI's service
container) doesn't fail — warehouse_test.py's mock-based tests already cover
this module's logic without a live dependency; these tests exist to prove
the DB-API wiring itself works against a real StarRocks server, which a
mock can't do.
"""

from datetime import UTC, datetime, timedelta

import pytest
from django.conf import settings

from learning_resources.lib.warehouse import BaseWarehouseETLTask, iter_rows
from learning_resources.lib.warehouse_factories import WarehouseTestRowFactory

pytestmark = [
    pytest.mark.skipif(
        not settings.STARROCKS_HOST,
        reason="STARROCKS_HOST is not configured — no live StarRocks to test against",
    ),
]

_TEST_DB = "test_integrations"
_TEST_TABLE = "integrations__learn__test"
_TEST_VIEW = f"{_TEST_DB}.{_TEST_TABLE}"


@pytest.fixture
def starrocks_conn():
    """Open a live connection to the StarRocks test instance, with a scratch
    table created before the test and dropped after.
    """
    import pymysql

    conn = pymysql.connect(
        host=settings.STARROCKS_HOST,
        port=settings.STARROCKS_PORT,
        user=settings.STARROCKS_USER,
        password=settings.STARROCKS_PASSWORD,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS {_TEST_DB}")
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS {_TEST_VIEW} (
                    id INT,
                    title VARCHAR(255),
                    last_modified DATETIME
                )
                ENGINE=OLAP
                DUPLICATE KEY(id)
                DISTRIBUTED BY HASH(id)
                PROPERTIES ("replication_num" = "1")
            """)
        conn.commit()
        yield conn
    finally:
        with conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {_TEST_VIEW}")
        conn.commit()
        conn.close()


def _insert_rows(conn, rows):
    with conn.cursor() as cur:
        cur.executemany(
            f"INSERT INTO {_TEST_VIEW} (id, title, last_modified) VALUES (%s, %s, %s)",  # noqa: S608
            [(row["id"], row["title"], row["last_modified"]) for row in rows],
        )
    conn.commit()


class _CollectingTask(BaseWarehouseETLTask):
    name = "test.CollectingTask"
    view_name = _TEST_VIEW

    def fetch_and_upsert(self, conn, *, since=None) -> int:
        self.collected = list(iter_rows(conn, self.view_name, since=since))
        return len(self.collected)


def test_iter_rows_reads_real_rows(starrocks_conn):
    """iter_rows pulls actual rows back from a live StarRocks table."""
    rows = WarehouseTestRowFactory.create_batch(3)
    _insert_rows(starrocks_conn, rows)

    result = sorted(iter_rows(starrocks_conn, _TEST_VIEW), key=lambda r: r["id"])

    assert [r["id"] for r in result] == sorted(row["id"] for row in rows)
    assert [r["title"] for r in result] == [
        row["title"] for row in sorted(rows, key=lambda r: r["id"])
    ]


def test_iter_rows_since_filters_real_rows(starrocks_conn):
    """An incremental pull only returns rows newer than the watermark."""
    now = datetime.now(tz=UTC)
    old_row = WarehouseTestRowFactory.create(
        id=1, last_modified=now - timedelta(days=1)
    )
    new_row = WarehouseTestRowFactory.create(
        id=2, last_modified=now + timedelta(minutes=1)
    )
    _insert_rows(starrocks_conn, [old_row, new_row])

    result = list(iter_rows(starrocks_conn, _TEST_VIEW, since=now))

    assert [r["id"] for r in result] == [new_row["id"]]


def test_base_warehouse_etl_task_runs_against_real_starrocks(mocker, starrocks_conn):
    """BaseWarehouseETLTask.run() connects, fetches, and closes against a
    real StarRocks connection end-to-end (connect_to_warehouse itself, not
    just iter_rows, since the other tests here pass starrocks_conn directly).

    Uses a second, task-owned connection rather than the `starrocks_conn`
    fixture's own connection: `run()` unconditionally closes whatever
    connect_to_warehouse() returns, which would otherwise close the
    fixture's connection out from under its own teardown.
    """
    import pymysql

    task_conn = pymysql.connect(
        host=settings.STARROCKS_HOST,
        port=settings.STARROCKS_PORT,
        user=settings.STARROCKS_USER,
        password=settings.STARROCKS_PASSWORD,
    )
    mocker.patch(
        "learning_resources.lib.warehouse.connect_to_warehouse",
        return_value=task_conn,
    )
    rows = WarehouseTestRowFactory.create_batch(2)
    _insert_rows(starrocks_conn, rows)

    task = _CollectingTask()
    count = task.run()

    assert count == len(rows)
    assert {r["id"] for r in task.collected} == {row["id"] for row in rows}
