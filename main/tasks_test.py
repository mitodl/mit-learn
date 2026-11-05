"""Tests for batched task job helpers"""

import datetime

import pytest
from django.conf import settings

from main.factories import TaskBatchFactory, TaskJobFactory
from main.models import TaskBatch, TaskJob
from main.tasks import delete_old_task_jobs, maybe_finish_task_job
from main.utils import now_in_utc

pytestmark = pytest.mark.django_db


def test_maybe_finish_task_job(mocker):
    """maybe_finish_task_job should claim the finish once all batches terminal"""
    finish_task = mocker.Mock()
    job = TaskJobFactory.create(status=TaskJob.Status.RUNNING)
    TaskBatchFactory.create(job=job, status=TaskBatch.Status.SUCCEEDED)
    running_batch = TaskBatchFactory.create(job=job, status=TaskBatch.Status.RUNNING)

    # a running (non-terminal) batch must block completion
    maybe_finish_task_job(job.id, finish_task)
    job.refresh_from_db()
    assert job.status == TaskJob.Status.RUNNING
    finish_task.delay.assert_not_called()

    TaskBatch.objects.filter(id=running_batch.id).update(status=TaskBatch.Status.FAILED)
    maybe_finish_task_job(job.id, finish_task)
    job.refresh_from_db()
    assert job.status == TaskJob.Status.FINISHING
    finish_task.delay.assert_called_once_with(job.id)

    # a second caller cannot claim the finish again
    maybe_finish_task_job(job.id, finish_task)
    assert finish_task.delay.call_count == 1


def test_delete_old_task_jobs():
    """Jobs untouched past the retention window are deleted with their batches"""
    old_job = TaskJobFactory.create(status=TaskJob.Status.SUCCEEDED)
    old_batch = TaskBatchFactory.create(job=old_job)
    recent_job = TaskJobFactory.create(status=TaskJob.Status.RUNNING)
    recent_batch = TaskBatchFactory.create(job=recent_job)

    stale = now_in_utc() - datetime.timedelta(days=settings.TASK_JOB_RETENTION_DAYS + 1)
    TaskJob.objects.filter(id=old_job.id).update(updated_on=stale)

    delete_old_task_jobs.delay()

    assert not TaskJob.objects.filter(id=old_job.id).exists()
    assert not TaskBatch.objects.filter(id=old_batch.id).exists()  # cascaded
    assert TaskJob.objects.filter(id=recent_job.id).exists()
    assert TaskBatch.objects.filter(id=recent_batch.id).exists()
