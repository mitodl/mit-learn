"""PostHog ETL"""

import dataclasses
import io
import json
import logging
import uuid
from collections.abc import Generator
from datetime import UTC, datetime

import boto3
import pyarrow.parquet as pq
from django.conf import settings
from django.db import IntegrityError, transaction

from learning_resources.models import LearningResource, LearningResourceViewEvent
from learning_resources.utils import resource_upserted_actions
from main.utils import chunks

log = logging.getLogger(__name__)

# The only columns posthog_transform_lrd_view_events reads. The PostHog export
# also carries person_properties, elements_chain, distinct_id, person_id,
# created_at, _inserted_at and event; person_properties in particular is a JSON
# blob comparable in size to properties, and all of them were being decoded for
# every row and then discarded.
POSTHOG_EVENT_COLUMNS = ["uuid", "timestamp", "properties"]

# Rows decoded per batch. Bounds peak memory to roughly one batch rather than
# one whole file, and is small enough that a batch stays cheap even though
# properties holds the full PostHog client context per event.
POSTHOG_EXTRACT_BATCH_SIZE = 1000

# Events loaded per database round trip. The per-event path costs 2-8 queries
# against a table of several million rows; batching brings a full backlog pass
# back inside the celery visibility timeout, past which acks_late redelivers a
# still-running task to another worker and the copies multiply.
POSTHOG_LOAD_BATCH_SIZE = 1000


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

            # Decode a batch at a time rather than materialising the whole file:
            # the previous pandas path read every column into a DataFrame and
            # then wrapped `iterrows()` in `list()`, which holds a Series object
            # for every row in the file simultaneously.
            parquet_file = pq.ParquetFile(parquet_data)
            for batch in parquet_file.iter_batches(
                batch_size=POSTHOG_EXTRACT_BATCH_SIZE,
                columns=POSTHOG_EVENT_COLUMNS,
            ):
                yield from batch.to_pylist()


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


def _event_uuid(event: PostHogLearningResourceViewEvent) -> uuid.UUID | None:
    """
    Parse an event's uuid, or None if it is malformed.

    The batch path compares uuids in Python, where a str never equals the
    uuid.UUID the ORM returns, so they have to be normalised on the way in.
    """
    try:
        return uuid.UUID(str(event.event_uuid))
    except (AttributeError, TypeError, ValueError):
        log.warning(
            "Skipping lrd_view event for resource %s - malformed uuid %r",
            event.resource_id,
            event.event_uuid,
        )
        return None


def _existing_resource_ids(
    events: list[PostHogLearningResourceViewEvent],
) -> set[int]:
    """
    Return the resource ids in `events` that exist as LearningResources.

    Non-integer ids are dropped before the query rather than after: a bad value
    inside pk__in raises for the whole batch, where the per-event loader only
    skips the one event.
    """
    candidate_ids = set()
    for event in events:
        try:
            candidate_ids.add(int(event.resource_id))
        except (TypeError, ValueError):
            log.warning(
                "Skipping lrd_view event for resource %r - invalid ID",
                event.resource_id,
            )
    return set(
        LearningResource.objects.filter(pk__in=candidate_ids).values_list(
            "id", flat=True
        )
    )


def _claim_legacy_rows(
    events: list[PostHogLearningResourceViewEvent],
) -> list[tuple[int, uuid.UUID]]:
    """
    Pair each event with a distinct legacy row to adopt, where one exists.

    Legacy rows predate event_uuid; stamping one stops a re-read S3 file
    inserting a duplicate alongside it. The tail can hold several rows for the
    same (resource, event_date), so a row is claimed at most once per batch.

    Args:
    - events (list[PostHogLearningResourceViewEvent]): events not already stored
    Returns:
    List of (row primary key, event uuid) pairs to stamp
    """
    wanted = {(event.resource_id, event.event_date) for event in events}
    candidates: dict[tuple[int, datetime], list[int]] = {}
    rows = (
        LearningResourceViewEvent.objects.filter(
            event_uuid__isnull=True,
            learning_resource_id__in={key[0] for key in wanted},
            event_date__in={key[1] for key in wanted},
        )
        .order_by("id")
        .values_list("id", "learning_resource_id", "event_date")
    )
    for row_id, resource_id, event_date in rows:
        key = (resource_id, event_date)
        # The filter is a cross product of ids and dates rather than a set of
        # exact pairs, so it also returns rows no event in this batch asked for.
        if key in wanted:
            candidates.setdefault(key, []).append(row_id)

    assignments = []
    for event in events:
        available = candidates.get((event.resource_id, event.event_date))
        if available:
            assignments.append((available.pop(0), _event_uuid(event)))
    return assignments


def _load_posthog_lrd_view_event_batch(
    events: list[PostHogLearningResourceViewEvent],
) -> tuple[set[int], int]:
    """
    Load one batch of events.

    Args:
    - events (list[PostHogLearningResourceViewEvent]): the batch to load
    Returns:
    Tuple of (resource ids needing a recount, number of events loaded)
    """
    resource_ids = _existing_resource_ids(events)
    events = [
        event
        for event in events
        if event.resource_id in resource_ids and _event_uuid(event) is not None
    ]
    if not events:
        return set(), 0

    # Most events arrive already stored: the extract re-reads the newest S3
    # object every run, because its last_modified always postdates the events
    # it holds.
    stored_uuids = set(
        LearningResourceViewEvent.objects.filter(
            event_uuid__in=[_event_uuid(event) for event in events]
        ).values_list("event_uuid", flat=True)
    )
    new_events = [event for event in events if _event_uuid(event) not in stored_uuids]
    if not new_events:
        return {event.resource_id for event in events}, 0

    assignments = _claim_legacy_rows(new_events)
    if assignments:
        adopted = [
            LearningResourceViewEvent(pk=row_id, event_uuid=event_uuid)
            for row_id, event_uuid in assignments
        ]
        try:
            with transaction.atomic():
                LearningResourceViewEvent.objects.bulk_update(
                    adopted, ["event_uuid"], batch_size=POSTHOG_LOAD_BATCH_SIZE
                )
        except IntegrityError:
            # A concurrent run adopted one of these rows for the same uuid.
            # bulk_update fails the whole batch where the per-event path fails
            # a single event, so fall back to it rather than lose the batch.
            log.info(
                "Legacy view event adoption raced for %d row(s); "
                "falling back to per-event load",
                len(adopted),
            )
            loaded = [
                event
                for event in new_events
                if load_posthog_lrd_view_event(event) is not None
            ]
            return {event.resource_id for event in events}, len(loaded)

    LearningResourceViewEvent.objects.bulk_create(
        [
            LearningResourceViewEvent(
                learning_resource_id=event.resource_id,
                event_date=event.event_date,
                event_uuid=_event_uuid(event),
            )
            for event in new_events
        ],
        # ON CONFLICT DO NOTHING against the partial unique index on event_uuid.
        # Atomic where get_or_create is a read-then-write race, so overlapping
        # runs converge instead of raising.
        ignore_conflicts=True,
        batch_size=POSTHOG_LOAD_BATCH_SIZE,
    )
    return {event.resource_id for event in events}, len(new_events)


def load_posthog_lrd_view_events(
    events: iter,
) -> set[int]:
    """
    Load PostHogLearningResourceViewEvents into the database.

    Consumes `events` in batches and keeps only the set of learning resource
    ids that need recounting, so memory stays bounded by one batch rather than
    by the size of the backlog.

    Args:
    - events (iterable[PostHogLearningResourceViewEvent]): the events to load
    Returns:
    Set of learning resource ids whose view counts were updated
    """

    attempted = 0
    loaded = 0
    learning_resource_ids: set[int] = set()

    for batch in chunks(events, chunk_size=POSTHOG_LOAD_BATCH_SIZE):
        attempted += len(batch)
        batch_resource_ids, batch_loaded = _load_posthog_lrd_view_event_batch(batch)
        learning_resource_ids |= batch_resource_ids
        loaded += batch_loaded

    log.info(
        "PostHog lrd_view load: %d event(s) attempted, %d loaded, "
        "%d learning resource(s) to recount",
        attempted,
        loaded,
        len(learning_resource_ids),
    )

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

    return learning_resource_ids
