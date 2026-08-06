"""
Classes related to models for main
"""

from django.db import models
from django.db.models import DateTimeField, Model
from django.db.models.query import QuerySet

from main.utils import now_in_utc


class TimestampedModelQuerySet(QuerySet):
    """
    Subclassed QuerySet for TimestampedModelManager
    """

    def update(self, **kwargs):
        """
        Automatically update updated_on timestamp when .update(). This is because .update()
        does not go through .save(), thus will not auto_now, because it happens on the
        database level without loading objects into memory.
        """  # noqa: E501
        if "updated_on" not in kwargs:
            kwargs["updated_on"] = now_in_utc()
        return super().update(**kwargs)


class TimestampedModel(Model):
    """
    Base model for create/update timestamps
    """

    objects = TimestampedModelQuerySet.as_manager()
    created_on = DateTimeField(auto_now_add=True, db_index=True)  # UTC  # noqa: DJ012
    updated_on = DateTimeField(auto_now=True)  # UTC

    class Meta:
        abstract = True


class NoDefaultTimestampedModel(TimestampedModel):
    """
    This model is an alternative for TimestampedModel with one
    important difference: it doesn't specify `auto_now` and `auto_now_add`.
    This allows us to pass in our own values without django overriding them.
    You'd typically use this model when backpopulating data from a source that
    already has values for these fields and then switch to TimestampedModel
    after existing data has been backpopulated.
    """

    created_on = DateTimeField(default=now_in_utc)
    updated_on = DateTimeField(default=now_in_utc)

    class Meta:
        abstract = True


class TaskJob(TimestampedModel):
    """
    Tracks a long-running celery task that has been decomposed into batches
    (TaskBatch rows), so its progress and completion live in the database
    rather than in any single worker process
    """

    class Status(models.TextChoices):
        QUEUED = "queued"  # created; the start task has not completed yet
        RUNNING = "running"  # batches created and executing
        FINISHING = "finishing"  # all batches done; finish step claimed
        SUCCEEDED = "succeeded"
        FAILED = "failed"

    ACTIVE_STATUSES = (Status.QUEUED, Status.RUNNING, Status.FINISHING)

    task_name = models.CharField(max_length=255, db_index=True)
    params = models.JSONField(default=dict)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.QUEUED,
        db_index=True,
    )
    error = models.TextField(blank=True)

    def __str__(self):
        return f"Task job {self.id} {self.task_name} ({self.status})"


class TaskBatch(TimestampedModel):
    """A unit of work for a TaskJob"""

    class Status(models.TextChoices):
        QUEUED = "queued"  # waiting for a worker to pick it up
        RUNNING = "running"  # a worker has started executing it
        SUCCEEDED = "succeeded"
        FAILED = "failed"

    NON_TERMINAL_STATUSES = (Status.QUEUED, Status.RUNNING)

    job = models.ForeignKey(TaskJob, on_delete=models.CASCADE, related_name="batches")
    batch_key = models.CharField(max_length=255)
    kind = models.CharField(max_length=64)
    params = models.JSONField(default=dict)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.QUEUED,
        db_index=True,
    )
    error = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["job", "batch_key"], name="unique_task_batch_key"
            )
        ]
        indexes = [
            models.Index(fields=["job", "status"], name="taskbatch_job_status_idx")
        ]

    def __str__(self):
        return f"Task batch {self.batch_key} ({self.status}) for job {self.job_id}"
