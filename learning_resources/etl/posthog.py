"""PostHog ETL"""

import dataclasses
import io
import json
import logging
from collections.abc import Generator
from datetime import UTC, datetime

import boto3
import pandas as pd
from django.conf import settings
from django.db import IntegrityError, transaction

from learning_resources.models import LearningResource, LearningResourceViewEvent
from learning_resources.utils import resource_upserted_actions

log = logging.getLogger(__name__)


@dataclasses.dataclass
class PostHogLearningResourceViewEvent:
    """
    Represents a learning resource view (lrd_view) event.

    PostHog event properties include a lot of other stuff - this just includes
    the lrd_view specific properties.
    """

    resource_id: int
    event_date: datetime
    event_uuid: str


def posthog_extract_lrd_view_events() -> Generator[dict, None, None]:
    """
    Retrieve lrd_view events from the PostHog Query API.

    This will filter results based on the last record retrieved:
    - If there are any stored events, the query will start after the last event
      date
    - If there aren't any stored events, no filter is applied and you will get
      all events to date

    Due to limitations on the PostHog API side, this converts the last event
    date explicitly to UTC and then to a naive datetime. The PostHog query
    processor doesn't like timezone info and expects UTC.

    Returns:
    - Generator that yields PostHogEvent
    """

    last_event = LearningResourceViewEvent.objects.order_by("-event_date").first()

    last_event_time = last_event.event_date.astimezone(UTC) if last_event else None

    s3 = boto3.resource(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    posthog_events_bucket = s3.Bucket(settings.POSTHOG_EVENT_S3_BUCKET)

    for obj in posthog_events_bucket.objects.filter(
        Prefix=settings.POSTHOG_EVENT_S3_PREFIX
    ):
        if last_event_time is None or obj.last_modified > last_event_time:
            s3_object = s3.Object(settings.POSTHOG_EVENT_S3_BUCKET, obj.key)
            parquet_data = io.BytesIO(s3_object.get()["Body"].read())

            df = pd.read_parquet(parquet_data)
            for _, row in list(df.iterrows()):
                yield row.to_dict()


def posthog_transform_lrd_view_events(
    events: iter,
) -> Generator[PostHogLearningResourceViewEvent, None, None]:
    """
    Transform PostHogEvents into PostHogLearningResourceViewEvents.

    Args:
    - events (list[PostHogEvent]) - list of events to process
    Returns:
    Generator that yields PostHogLearningResourceViewEvent
    """

    for event in events:
        properties = event.get("properties", "{}")
        properties = json.loads(properties)
        resource = properties.get("resource")
        resource_id = properties.get("learning_resource_id")

        if resource and isinstance(resource, dict):
            resource_id = resource.get("id")
        # The PostHog data files contain other kinds of events, for example llm calls.
        # We only want to the resource views

        if not resource_id:
            continue

        event_uuid = event.get("uuid")
        if not event_uuid:
            # PostHog assigns every event a uuid, so this indicates
            # malformed source data
            log.warning(
                "Skipping lrd_view event without a uuid for resource %s", resource_id
            )
            continue

        yield PostHogLearningResourceViewEvent(
            resource_id=resource_id,
            event_date=event.get("timestamp"),
            event_uuid=event_uuid,
        )


def load_posthog_lrd_view_event(
    event: PostHogLearningResourceViewEvent,
) -> LearningResourceViewEvent | None:
    """
    Load a PostHogLearningResourceViewEvent into the database.

    Args:
    - event (PostHogLearningResourceViewEvent): the event to load
    Returns:
    LearningResourceViewEvent of the event
    """

    try:
        learning_resource = LearningResource.objects.filter(pk=event.resource_id).get()
    except LearningResource.DoesNotExist:
        skip_warning = (
            f"WARNING: skipping event for resource ID {event.resource_id}"
            " - resource not found"
        )
        log.warning(skip_warning)
        return None
    except LearningResource.MultipleObjectsReturned:
        skip_warning = (
            f"WARNING: skipping event for resource ID {event.resource_id}"
            " - multiple objects returned"
        )
        log.warning(skip_warning)
        return None
    except ValueError:
        skip_warning = (
            f"WARNING: skipping event for resource ID {event.resource_id} - invalid ID"
        )
        log.warning(skip_warning)
        return None

    # The newest S3 file is re-read on every run (its last_modified is always
    # later than the events it holds), so most events arrive already stored.
    # Return early: stamping this uuid onto another legacy duplicate below
    # would violate the unique index.
    existing = LearningResourceViewEvent.objects.filter(
        event_uuid=event.event_uuid
    ).first()
    if existing:
        return existing

    # Adopt a matching legacy row (loaded before event_uuid existed) so re-read
    # S3 files don't duplicate it. Stamp only the oldest one; the legacy tail
    # can hold duplicate (resource, event_date) rows.
    legacy_row = (
        LearningResourceViewEvent.objects.filter(
            learning_resource=learning_resource,
            event_date=event.event_date,
            event_uuid__isnull=True,
        )
        .order_by("id")
        .first()
    )
    if legacy_row:
        try:
            # Savepoint: the check above is not a lock, so a concurrent run can
            # adopt a different duplicate for this uuid first. get_or_create
            # below then finds that row.
            with transaction.atomic():
                LearningResourceViewEvent.objects.filter(pk=legacy_row.pk).update(
                    event_uuid=event.event_uuid
                )
        except IntegrityError:
            log.info(
                "Legacy view event row for resource %s was adopted concurrently",
                event.resource_id,
            )

    lr_event, _ = LearningResourceViewEvent.objects.get_or_create(
        event_uuid=event.event_uuid,
        defaults={
            "learning_resource": learning_resource,
            "event_date": event.event_date,
        },
    )

    return lr_event


def load_posthog_lrd_view_events(
    events: iter,
) -> list[LearningResourceViewEvent]:
    """
    Load a list of PostHogLearningResourceViewEvent into the database.

    Args:
    - events (list[PostHogLearningResourceViewEvent]): the events to load
    Returns:
    List of LearningResourceViewEvent
    """

    events = [load_posthog_lrd_view_event(event) for event in events]
    learning_resource_ids = {
        event.learning_resource_id for event in events if event is not None
    }

    for resource_id in learning_resource_ids:
        learning_resource = LearningResource.objects.filter(
            id=resource_id, published=True
        ).first()
        if learning_resource:
            learning_resource.view_count = learning_resource.views.count()
            learning_resource.save(update_fields=["view_count"])

            resource_upserted_actions(
                learning_resource, percolate=False, generate_embeddings=False
            )

    return events
