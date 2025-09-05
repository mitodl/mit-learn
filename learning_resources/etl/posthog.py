"""PostHog ETL"""

import dataclasses
import json
import logging
from collections.abc import Generator
from datetime import UTC, datetime

import boto3
import requests
from django.conf import settings

from learning_resources.models import LearningResource, LearningResourceViewEvent
from learning_resources.utils import get_s3_object_and_read, resource_upserted_actions

log = logging.getLogger(__name__)


@dataclasses.dataclass
class PostHogLearningResourceViewEvent:
    """
    Represents a learning resource view (lrd_view) event.

    PostHog event properties include a lot of other stuff - this just includes
    the lrd_view specific properties.
    """

    resourceType: str  # noqa: N815
    platformCode: str  # noqa: N815
    resourceId: int  # noqa: N815
    readableId: str  # noqa: N815
    event_date: datetime


class PostHogApiAuth(requests.auth.AuthBase):
    """Implements Bearer authentication for the PostHog private API"""

    def __init__(self, token):
        """Store the passed-in token."""

        self.token = token

    def __call__(self, request):
        """Add the bearer token to the headers."""

        request.headers["Authorization"] = f"Bearer {self.token}"
        return request


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
    posthog_events_bucket = s3.Bucket(settings.POSTHOG_EVENT_S3_FOLDER)

    for obj in posthog_events_bucket.objects.all():
        if last_event_time is None or obj.last_modified > last_event_time:
            get_s3_object_and_read(obj)
            for line in get_s3_object_and_read(obj).splitlines():
                event = json.loads(line)
                yield event.get("properties")


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

    for result in events:
        props = json.loads(result)

        yield PostHogLearningResourceViewEvent(
            resourceType=props.get("resourceType", ""),
            platformCode=props.get("platformCode", ""),
            resourceId=props.get("resourceId", ""),
            readableId=props.get("readableId", ""),
            event_date=result.timestamp,
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
        learning_resource = LearningResource.objects.filter(pk=event.resourceId).get()
    except LearningResource.DoesNotExist:
        skip_warning = (
            f"WARNING: skipping event for resource ID {event.resourceId}"
            " - resource not found"
        )
        log.warning(skip_warning)
        return None
    except LearningResource.MultipleObjectsReturned:
        skip_warning = (
            f"WARNING: skipping event for resource ID {event.resourceId}"
            " - multiple objects returned"
        )
        log.warning(skip_warning)
        return None
    except ValueError:
        skip_warning = (
            f"WARNING: skipping event for resource ID {event.resourceId} - invalid ID"
        )
        log.warning(skip_warning)
        return None

    lr_event, _ = LearningResourceViewEvent.objects.update_or_create(
        learning_resource=learning_resource,
        event_date=event.event_date,
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
            resource_upserted_actions(learning_resource, percolate=False)

    return events
