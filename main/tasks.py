"""Helpers for batched task jobs (TaskJob / TaskBatch)"""

import datetime
import logging

from django.conf import settings

from main.celery import app
from main.models import TaskBatch, TaskJob
from main.utils import now_in_utc

log = logging.getLogger(__name__)


def maybe_finish_task_job(job_id, finish_task):
    """
    Claim and enqueue the finish step if every batch of the job is done.

    The conditional UPDATE guarantees exactly one caller claims the finish;
    each batch commits its terminal status before calling this, so the last
    batch to finish is guaranteed to see all batches terminal.

    Args:
        job_id (int): TaskJob id
        finish_task (celery task): task taking a TaskJob id that finalizes it
    """
    claimed = (
        TaskJob.objects.filter(id=job_id, status=TaskJob.Status.RUNNING)
        .exclude(batches__status__in=TaskBatch.NON_TERMINAL_STATUSES)
        .update(status=TaskJob.Status.FINISHING)
    )
    if claimed:
        finish_task.delay(job_id)


@app.task
def delete_old_task_jobs():
    """
    Delete TaskJobs (and, by cascade, their batches) with no activity in the
    retention window. A job untouched for that long is treated as inactive,
    whatever its status.
    """
    threshold = now_in_utc() - datetime.timedelta(days=settings.TASK_JOB_RETENTION_DAYS)
    deleted, _ = TaskJob.objects.filter(updated_on__lt=threshold).delete()
    log.info("Deleted %d old task job/batch rows", deleted)
