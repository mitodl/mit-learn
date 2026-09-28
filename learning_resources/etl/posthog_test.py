"""Tests for the PostHog ETL library."""

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from django.db import IntegrityError, connection
from django.test.utils import CaptureQueriesContext
from freezegun import freeze_time

from learning_resources.etl import posthog
from learning_resources.factories import (
    LearningResourceFactory,
    LearningResourceViewEventFactory,
)
from learning_resources.models import LearningResourceViewEvent
from main.utils import now_in_utc


@pytest.mark.parametrize("existing_events", [True, False])
@pytest.mark.django_db
def test_posthog_extract_lrd_view_events(
    mocker, mock_posthog_event_bucket, settings, existing_events, posthog_aws_settings
):
    """
    Ensure that the extractor extracts to the intermediary format.

    This should get the data from the posthog bucket and return the properties field
    """

    # Ensure the mock bucket is created before use
    bucket = mock_posthog_event_bucket.bucket
    bucket.create()  # Explicitly create the bucket if not already created
    settings.POSTHOG_EVENT_S3_BUCKET = bucket.name
    settings.POSTHOG_EVENT_S3_PREFIX = "events/"

    if existing_events:
        lr = LearningResourceFactory.create()
        LearningResourceViewEvent.objects.create(
            learning_resource=lr,
            event_date=now_in_utc() - timedelta(days=1),
        )

    with Path.open(Path("test_json/posthog/test_data.parquet.zst"), "rb") as infile:
        bucket.put_object(
            Key="events/file1.parquet.zst",
            Body=infile.read(),
            ACL="public-read",
        )

    with freeze_time(now_in_utc() - timedelta(days=7)):  # noqa: SIM117
        with Path.open(Path("test_json/posthog/test_data.parquet.zst"), "rb") as infile:
            bucket.put_object(
                Key="events/file2.parquet.zst",
                Body=infile.read(),
                ACL="public-read",
            )

    events = posthog.posthog_extract_lrd_view_events()
    events = list(events)
    if existing_events:
        assert len(events) == 4
    else:
        assert len(events) == 8


@pytest.mark.django_db
def test_posthog_transform_lrd_view_events(mocker, mock_posthog_event_bucket, settings):
    """Ensure the second stage of the extractor loads properly"""

    bucket = mock_posthog_event_bucket.bucket
    settings.POSTHOG_EVENT_S3_BUCKET = bucket.name
    settings.POSTHOG_EVENT_S3_PREFIX = "events/"

    with Path.open(Path("test_json/posthog/test_data.parquet.zst"), "rb") as infile:
        bucket.put_object(
            Key="events/file1.parquet.zst",
            Body=infile.read(),
            ACL="public-read",
        )

    events = posthog.posthog_extract_lrd_view_events()
    transformed_events = posthog.posthog_transform_lrd_view_events(events)
    transformed_events = list(transformed_events)
    assert len(transformed_events) == 4

    # event_date is a stdlib datetime: the extractor decodes parquet via pyarrow,
    # which yields native types, so there is no pandas Timestamp to unwrap.
    assert transformed_events[0].resource_id == 3235
    assert transformed_events[0].event_date == datetime(
        2025, 8, 28, 15, 20, 10, 403000, tzinfo=UTC
    )
    assert transformed_events[1].resource_id == 3235
    assert transformed_events[1].event_date == datetime(
        2025, 8, 28, 15, 20, 13, 620000, tzinfo=UTC
    )


@pytest.mark.django_db
@pytest.mark.parametrize("resource_exists", [True, False])
@pytest.mark.parametrize("event_exists", [True, False])
def test_load_posthog_lrd_view_events(
    mocker, mock_posthog_event_bucket, settings, resource_exists, event_exists
):
    """Ensure the loader stage of the extractor creates database records"""
    LearningResourceViewEvent.objects.all().delete()
    bucket = mock_posthog_event_bucket.bucket
    settings.POSTHOG_EVENT_S3_BUCKET = bucket.name
    settings.POSTHOG_EVENT_S3_PREFIX = "events/"
    with Path.open(Path("test_json/posthog/test_data.parquet.zst"), "rb") as infile:
        bucket.put_object(
            Key="events/file1.parquet.zst",
            Body=infile.read(),
            ACL="public-read",
        )

    LearningResourceViewEvent.objects.all().delete()
    if resource_exists:
        resource = LearningResourceFactory.create(id=3235)

    mocker.patch(
        "learning_resources.etl.posthog.resource_upserted_actions",
        autospec=True,
    )
    posthog_events = posthog.posthog_extract_lrd_view_events()

    transformed_events = posthog.posthog_transform_lrd_view_events(posthog_events)

    if resource_exists and event_exists:
        LearningResourceViewEventFactory.create(
            learning_resource=resource,
            event_date=datetime(2025, 8, 28, 15, 20, 13, 620000, tzinfo=UTC),
        )

    # The loader returns the resource ids needing a recount, not the loaded rows:
    # it is called with a generator over the whole backlog, so it must not retain
    # a model instance per event. All four fixture events belong to resource 3235.
    recounted_ids = posthog.load_posthog_lrd_view_events(transformed_events)

    if resource_exists:
        assert LearningResourceViewEvent.objects.count() == 4
        assert recounted_ids == {resource.id}
    else:
        assert LearningResourceViewEvent.objects.count() == 0
        assert recounted_ids == set()


@pytest.mark.django_db
@pytest.mark.parametrize("runs", [1, 2])
def test_load_posthog_lrd_view_events_duplicate_legacy_rows(
    mocker, mock_posthog_event_bucket, settings, runs
):
    """Duplicate legacy rows are tolerated, and re-running the ETL stays idempotent"""
    LearningResourceViewEvent.objects.all().delete()
    bucket = mock_posthog_event_bucket.bucket
    settings.POSTHOG_EVENT_S3_BUCKET = bucket.name
    settings.POSTHOG_EVENT_S3_PREFIX = "events/"
    with Path.open(Path("test_json/posthog/test_data.parquet.zst"), "rb") as infile:
        bucket.put_object(
            Key="events/file1.parquet.zst",
            Body=infile.read(),
            ACL="public-read",
        )

    resource = LearningResourceFactory.create(id=3235)
    mocker.patch(
        "learning_resources.etl.posthog.resource_upserted_actions",
        autospec=True,
    )

    event_date = datetime(2025, 8, 28, 15, 20, 13, 620000, tzinfo=UTC)
    legacy_rows = LearningResourceViewEventFactory.create_batch(
        2, learning_resource=resource, event_date=event_date
    )

    for _ in range(runs):
        posthog.load_posthog_lrd_view_events(
            posthog.posthog_transform_lrd_view_events(
                posthog.posthog_extract_lrd_view_events()
            )
        )

    stamped = [
        row
        for row in LearningResourceViewEvent.objects.filter(
            pk__in=[r.pk for r in legacy_rows]
        )
        if row.event_uuid is not None
    ]
    assert len(stamped) == 1
    # The unstamped duplicate survives rather than being deleted
    assert (
        LearningResourceViewEvent.objects.filter(
            learning_resource=resource, event_date=event_date, event_uuid__isnull=True
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_load_posthog_lrd_view_event_adoption_lost_to_concurrent_run(mocker):
    """Losing the adoption race to a concurrent run doesn't crash the loader"""
    resource = LearningResourceFactory.create()
    event_date = now_in_utc()
    LearningResourceViewEventFactory.create(
        learning_resource=resource, event_date=event_date
    )
    event_uuid = "0198f143-cf8c-79b6-bab8-9c9063659a54"
    # Simulates another worker stamping a different duplicate with this uuid
    # between our existence check and the adoption update
    mocker.patch(
        "django.db.models.QuerySet.update",
        side_effect=IntegrityError("duplicate key value violates unique constraint"),
    )

    lr_event = posthog.load_posthog_lrd_view_event(
        posthog.PostHogLearningResourceViewEvent(
            resource_id=resource.id, event_date=event_date, event_uuid=event_uuid
        )
    )

    assert lr_event is not None
    assert LearningResourceViewEvent.objects.filter(event_uuid=event_uuid).count() == 1


def _view_event(resource_id, *, minutes_ago=0):
    """Build a transformed event without going through parquet."""
    return posthog.PostHogLearningResourceViewEvent(
        resource_id=resource_id,
        event_date=now_in_utc() - timedelta(minutes=minutes_ago),
        event_uuid=str(uuid.uuid4()),
    )


@pytest.mark.django_db
def test_load_posthog_lrd_view_events_does_not_query_per_event(mocker):
    """
    Query count must not scale with the number of events.

    The per-event path cost 2-8 queries each, which is what made a full backlog
    pass outrun the celery visibility timeout; past that, acks_late redelivers
    the still-running task to another worker and the copies multiply until they
    own the pool.
    """
    mocker.patch(
        "learning_resources.etl.posthog.resource_upserted_actions", autospec=True
    )
    resource = LearningResourceFactory.create()

    with CaptureQueriesContext(connection) as small:
        posthog.load_posthog_lrd_view_events(
            [_view_event(resource.id, minutes_ago=i) for i in range(5)]
        )
    with CaptureQueriesContext(connection) as large:
        posthog.load_posthog_lrd_view_events(
            [_view_event(resource.id, minutes_ago=i) for i in range(100, 200)]
        )

    assert LearningResourceViewEvent.objects.count() == 105
    # 20x the events, same number of round trips: both fit in one batch.
    assert len(large.captured_queries) == len(small.captured_queries)


@pytest.mark.django_db
def test_load_posthog_lrd_view_events_spans_batches(mocker, settings):
    """Events beyond one batch are still loaded."""
    mocker.patch(
        "learning_resources.etl.posthog.resource_upserted_actions", autospec=True
    )
    mocker.patch.object(posthog, "POSTHOG_LOAD_BATCH_SIZE", 10)
    resource = LearningResourceFactory.create()

    recounted = posthog.load_posthog_lrd_view_events(
        [_view_event(resource.id, minutes_ago=i) for i in range(25)]
    )

    assert recounted == {resource.id}
    assert LearningResourceViewEvent.objects.count() == 25


@pytest.mark.django_db
def test_load_posthog_lrd_view_events_survives_invalid_resource_id(mocker):
    """
    A malformed resource id skips its own event, not the whole batch.

    The per-event path caught ValueError per event; batched, an unfiltered bad
    id inside pk__in would raise and lose every event alongside it.
    """
    mocker.patch(
        "learning_resources.etl.posthog.resource_upserted_actions", autospec=True
    )
    resource = LearningResourceFactory.create()
    events = [
        _view_event(resource.id, minutes_ago=1),
        _view_event("not-an-integer", minutes_ago=2),
        _view_event(resource.id, minutes_ago=3),
    ]

    recounted = posthog.load_posthog_lrd_view_events(events)

    assert recounted == {resource.id}
    assert LearningResourceViewEvent.objects.count() == 2


@pytest.mark.django_db
def test_load_posthog_lrd_view_events_is_idempotent(mocker):
    """Re-loading the same events inserts nothing further.

    bulk_create(ignore_conflicts=True) leans on the partial unique index over
    event_uuid, so a repeat run -- which is every run, since the newest S3
    object is always re-read -- converges instead of duplicating.
    """
    mocker.patch(
        "learning_resources.etl.posthog.resource_upserted_actions", autospec=True
    )
    resource = LearningResourceFactory.create()
    events = [_view_event(resource.id, minutes_ago=i) for i in range(10)]

    posthog.load_posthog_lrd_view_events(events)
    posthog.load_posthog_lrd_view_events(events)

    assert LearningResourceViewEvent.objects.count() == 10


@pytest.mark.django_db
def test_load_posthog_lrd_view_events_accepts_string_resource_id(mocker):
    """
    A resource id that arrives as a string still loads.

    PostHog properties are JSON, so learning_resource_id can be either an int
    or a string. The per-event path handed it to filter(pk=...), which coerced
    it; the batch path compares it against ids read back from the database,
    where "3235" != 3235 would drop the event without a trace.
    """
    mocker.patch(
        "learning_resources.etl.posthog.resource_upserted_actions", autospec=True
    )
    resource = LearningResourceFactory.create()

    recounted = posthog.load_posthog_lrd_view_events(
        [_view_event(str(resource.id), minutes_ago=1)]
    )

    assert recounted == {resource.id}
    assert LearningResourceViewEvent.objects.count() == 1


@pytest.mark.django_db
def test_load_posthog_lrd_view_events_batch_survives_adoption_race(mocker):
    """
    An IntegrityError from bulk_update loads the batch per-event instead.

    bulk_update fails the whole batch where the per-event savepoint fails a
    single event, so without this fallback one adoption race would lose every
    event alongside it.
    """
    mocker.patch(
        "learning_resources.etl.posthog.resource_upserted_actions", autospec=True
    )
    resource = LearningResourceFactory.create()
    events = [_view_event(resource.id, minutes_ago=i) for i in range(1, 4)]

    # A legacy row for the first event, so the adoption path is reached at all.
    LearningResourceViewEventFactory.create(
        learning_resource=resource,
        event_date=events[0].event_date,
        event_uuid=None,
    )
    bulk_update = mocker.patch.object(
        LearningResourceViewEvent.objects,
        "bulk_update",
        side_effect=IntegrityError("adopted concurrently"),
    )

    recounted = posthog.load_posthog_lrd_view_events(events)

    assert bulk_update.called
    assert recounted == {resource.id}
    # All three survive via the per-event fallback: the legacy row adopted by
    # the first event, plus a fresh row for each of the other two.
    assert LearningResourceViewEvent.objects.count() == 3
    assert (
        LearningResourceViewEvent.objects.filter(
            event_uuid__in=[uuid.UUID(event.event_uuid) for event in events]
        ).count()
        == 3
    )
