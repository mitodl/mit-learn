"""Tests for the PostHog ETL library."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
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

    assert transformed_events[0].resourceType == "course"
    assert transformed_events[0].platformCode == "see"
    assert transformed_events[0].resourceId == 3235
    assert transformed_events[0].readableId == "a05U1000004xD2BIAU"
    assert transformed_events[0].event_date.to_pydatetime() == datetime(
        2025, 8, 28, 15, 20, 10, 403000, tzinfo=UTC
    )

    assert transformed_events[1].resourceType == "course"
    assert transformed_events[1].platformCode == "see"
    assert transformed_events[1].resourceId == 3235
    assert transformed_events[1].readableId == "a05U1000004xD2BIAU"
    assert transformed_events[1].event_date.to_pydatetime() == datetime(
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

    loaded_events = posthog.load_posthog_lrd_view_events(transformed_events)
    assert len(loaded_events) == 4

    if resource_exists:
        assert LearningResourceViewEvent.objects.count() == 4
        assert len([event for event in loaded_events if event is not None]) == 4
    else:
        assert LearningResourceViewEvent.objects.count() == 0
        assert len([event for event in loaded_events if event is not None]) == 0
