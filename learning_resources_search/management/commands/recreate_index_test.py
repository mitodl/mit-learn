"""Tests for the recreate_index management command"""

from io import StringIO

import pytest
from django.core.management import call_command

from learning_resources_search.constants import (
    ALL_INDEX_TYPES,
    HYBRID_COMBINED_INDEX,
    REINDEX_TASK_NAME,
)
from main.factories import TaskBatchFactory, TaskJobFactory
from main.models import TaskBatch, TaskJob

pytestmark = pytest.mark.django_db


@pytest.fixture
def start_recreate_index_mock(mocker):
    """Mock the start_recreate_index task"""
    return mocker.patch(
        "learning_resources_search.management.commands.recreate_index.start_recreate_index",
        autospec=True,
    )


@pytest.fixture
def _no_existing_reindexing_indexes(mocker):
    """Mock get_existing_reindexing_indexes to return nothing"""
    mocker.patch(
        "learning_resources_search.management.commands.recreate_index.get_existing_reindexing_indexes",
        autospec=True,
        return_value=[],
    )


@pytest.mark.usefixtures("_no_existing_reindexing_indexes")
def test_recreate_index_starts_job(start_recreate_index_mock):
    """The command should create a job, enqueue the start task and exit"""
    stdout = StringIO()
    call_command("recreate_index", "--programs", stdout=stdout)

    job = TaskJob.objects.get()
    assert job.task_name == REINDEX_TASK_NAME
    assert job.params == {
        "indexes": ["program"],
        "restart": False,
    }
    assert job.status == TaskJob.Status.QUEUED
    start_recreate_index_mock.delay.assert_called_once_with(job.id)
    output = stdout.getvalue()
    assert f"Started reindex job {job.id}" in output
    assert f"--status {job.id}" in output


@pytest.mark.usefixtures("_no_existing_reindexing_indexes")
def test_recreate_index_all_excludes_combined_hybrid(start_recreate_index_mock):
    """--all should reindex every type except the experimental hybrid index"""
    call_command("recreate_index", "--all", stdout=StringIO())

    job = TaskJob.objects.get()
    assert HYBRID_COMBINED_INDEX not in job.params["indexes"]
    assert set(job.params["indexes"]) == {
        index for index in ALL_INDEX_TYPES if index != HYBRID_COMBINED_INDEX
    }


@pytest.mark.usefixtures("_no_existing_reindexing_indexes")
def test_recreate_index_combined_hybrid_flag(start_recreate_index_mock):
    """--combined_hybrid should still reindex the hybrid index explicitly"""
    call_command("recreate_index", "--combined_hybrid", stdout=StringIO())

    job = TaskJob.objects.get()
    assert job.params["indexes"] == [HYBRID_COMBINED_INDEX]


@pytest.mark.usefixtures("_no_existing_reindexing_indexes")
def test_recreate_index_blocks_on_active_job(start_recreate_index_mock):
    """The command should not start a job when an overlapping job is active"""
    active_job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={"indexes": ["program"]},
        status=TaskJob.Status.RUNNING,
    )

    stdout = StringIO()
    call_command("recreate_index", "--programs", stdout=stdout)

    assert TaskJob.objects.count() == 1
    start_recreate_index_mock.delay.assert_not_called()
    assert str(active_job.id) in stdout.getvalue()


@pytest.mark.usefixtures("_no_existing_reindexing_indexes")
def test_recreate_index_supersedes_active_job(start_recreate_index_mock):
    """--restart should fail overlapping active jobs"""
    active_job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={"indexes": ["program"]},
        status=TaskJob.Status.RUNNING,
    )

    stdout = StringIO()
    call_command(
        "recreate_index",
        "--programs",
        "--restart",
        stdout=stdout,
    )

    active_job.refresh_from_db()
    new_job = TaskJob.objects.exclude(id=active_job.id).get()
    assert active_job.status == TaskJob.Status.FAILED
    assert f"superseded by reindex job {new_job.id}" == active_job.error
    assert new_job.params["restart"] is True
    start_recreate_index_mock.delay.assert_called_once_with(new_job.id)


def test_recreate_index_blocks_on_existing_reindexing_indexes(
    mocker, start_recreate_index_mock
):
    """The command should not start a job when reindexing indexes exist"""
    mocker.patch(
        "learning_resources_search.management.commands.recreate_index.get_existing_reindexing_indexes",
        autospec=True,
        return_value=["some_reindexing_index"],
    )

    stdout = StringIO()
    call_command("recreate_index", "--programs", stdout=stdout)

    assert TaskJob.objects.count() == 0
    start_recreate_index_mock.delay.assert_not_called()
    assert "some_reindexing_index" in stdout.getvalue()


def test_recreate_index_requires_index_selection(start_recreate_index_mock):
    """The command should print valid options when no index is selected"""
    stdout = StringIO()
    call_command("recreate_index", stdout=stdout)

    assert TaskJob.objects.count() == 0
    start_recreate_index_mock.delay.assert_not_called()
    assert "Must select at least one index to update" in stdout.getvalue()


def test_recreate_index_status(start_recreate_index_mock):
    """--status should print the job status without starting anything"""
    job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={"indexes": ["course"], "backing_indexes": {"course": "backing"}},
        status=TaskJob.Status.RUNNING,
    )
    TaskBatchFactory.create(
        job=job, kind="learning_resources", status=TaskBatch.Status.SUCCEEDED
    )
    TaskBatchFactory.create(
        job=job, kind="learning_resources", status=TaskBatch.Status.QUEUED
    )

    stdout = StringIO()
    call_command("recreate_index", "--status", str(job.id), stdout=stdout)

    output = stdout.getvalue()
    assert f"Reindex job {job.id}: running" in output
    assert "learning_resources" in output
    assert "'succeeded': 1" in output
    assert "'queued': 1" in output
    start_recreate_index_mock.delay.assert_not_called()


def test_recreate_index_status_latest(start_recreate_index_mock):
    """--status with no id should print the most recent job"""
    TaskJobFactory.create(task_name=REINDEX_TASK_NAME, params={"indexes": ["course"]})
    latest_job = TaskJobFactory.create(
        task_name=REINDEX_TASK_NAME,
        params={"indexes": ["program"]},
        status=TaskJob.Status.SUCCEEDED,
    )

    stdout = StringIO()
    call_command("recreate_index", "--status", stdout=stdout)

    assert f"Reindex job {latest_job.id}: succeeded" in stdout.getvalue()
    start_recreate_index_mock.delay.assert_not_called()


def test_recreate_index_status_no_jobs(start_recreate_index_mock):
    """--status should handle there being no jobs at all"""
    stdout = StringIO()
    call_command("recreate_index", "--status", stdout=stdout)

    assert "No reindex job found" in stdout.getvalue()
    start_recreate_index_mock.delay.assert_not_called()
