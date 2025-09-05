"""Tests for the PostHog ETL library."""

from datetime import timedelta
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
    mocker, mock_posthog_event_bucket, settings, existing_events
):
    """
    Ensure that the extractor extracts to the intermediary format.

    This should get the data from the posthog bucket and return the properties field
    """

    bucket = mock_posthog_event_bucket.bucket
    settings.POSTHOG_EVENT_S3_FOLDER = bucket.name

    if existing_events:
        lr = LearningResourceFactory.create()
        LearningResourceViewEvent.objects.create(
            learning_resource=lr,
            event_date=now_in_utc() - timedelta(days=1),
        )

    with Path.open(
        Path("test_json/posthog/test_posthog_events1.jsonl"), "rb"
    ) as infile:
        bucket.put_object(
            Key="file1.jsonl",
            Body=infile.read(),
            ACL="public-read",
        )

    with freeze_time(now_in_utc() - timedelta(days=7)):  # noqa: SIM117
        with Path.open(
            Path("test_json/posthog/test_posthog_events2.jsonl"), "rb"
        ) as infile:
            bucket.put_object(
                Key="file2.jsonl",
                Body=infile.read(),
                ACL="public-read",
            )

    events = posthog.posthog_extract_lrd_view_events()
    events = list(events)
    if existing_events:
        assert len(events) == 2
    else:
        assert len(events) == 4
    for event in list(events):
        assert event.get("properties").get("resource").get("id") == 3235


@pytest.mark.django_db
def test_posthog_transform_lrd_view_events(mocker, mock_posthog_event_bucket, settings):
    """Ensure the second stage of the extractor loads properly"""

    bucket = mock_posthog_event_bucket.bucket
    settings.POSTHOG_EVENT_S3_FOLDER = bucket.name
    with Path.open(
        Path("test_json/posthog/test_posthog_events1.jsonl"), "rb"
    ) as infile:
        bucket.put_object(
            Key="file1.jsonl",
            Body=infile.read(),
            ACL="public-read",
        )

    events = posthog.posthog_extract_lrd_view_events()
    transformed_events = posthog.posthog_transform_lrd_view_events(events)
    transformed_events = list(transformed_events)
    assert len(transformed_events) == 2

    assert transformed_events[0].resourceType == "course"
    assert transformed_events[0].platformCode == "see"
    assert transformed_events[0].resourceId == 3235
    assert transformed_events[0].readableId == "a05U1000004xD2BIAU"
    assert transformed_events[0].event_date == "2025-08-28T19:31:27.434000+00:00"

    assert transformed_events[1].resourceType == "course"
    assert transformed_events[1].platformCode == "see"
    assert transformed_events[1].resourceId == 3235
    assert transformed_events[1].readableId == "a05U1000004xD2BIAU"
    assert transformed_events[1].event_date == "2025-08-28T19:31:23.778000+00:00"


@pytest.mark.django_db
@pytest.mark.parametrize("resource_exists", [True, False])
@pytest.mark.parametrize("event_exists", [True, False])
def test_load_posthog_lrd_view_events(
    mocker, mock_posthog_event_bucket, settings, resource_exists, event_exists
):
    """Ensure the loader stage of the extractor creates database records"""

    bucket = mock_posthog_event_bucket.bucket
    settings.POSTHOG_EVENT_S3_FOLDER = bucket.name
    with Path.open(
        Path("test_json/posthog/test_posthog_events1.jsonl"), "rb"
    ) as infile:
        bucket.put_object(
            Key="file1.jsonl",
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
            event_date="2025-08-28T19:31:27.434000+00:00",
        )

    loaded_events = posthog.load_posthog_lrd_view_events(transformed_events)
    assert len(loaded_events) == 2

    if resource_exists:
        assert LearningResourceViewEvent.objects.count() == 2
        assert len([event for event in loaded_events if event is not None]) == 2
    else:
        assert LearningResourceViewEvent.objects.count() == 0
        assert len([event for event in loaded_events if event is not None]) == 0
