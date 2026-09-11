import datetime
import logging
from uuid import uuid4

import celery
import grpc
import sentry_sdk
from celery.exceptions import Ignore
from celery.utils.time import get_exponential_backoff_interval
from django.conf import settings
from django.core.cache import caches
from django.db.models import Q

from learning_resources.models import (
    ContentFile,
    Course,
    LearningResource,
    LearningResourceRun,
)
from learning_resources.serializers import (
    ContentFileSerializer,
)
from learning_resources.utils import load_course_blocklist
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
    COURSE_TYPE,
    LEARNING_RESOURCE_TYPES,
    PROGRAM_TYPE,
    SEARCH_CONN_EXCEPTIONS,
)
from learning_resources_search.exceptions import RetryError
from learning_resources_search.serializers import (
    serialize_bulk_learning_resources,
)
from learning_resources_search.tasks import wrap_retry_exception
from main.celery import app
from main.utils import (
    chunks,
    now_in_utc,
)
from vector_search.constants import (
    CONTENT_FILE_PREPASS_PAYLOAD_FIELDS,
    CONTENT_FILES_COLLECTION_NAME,
    RESOURCES_COLLECTION_NAME,
)
from vector_search.utils import (
    _stored_content_payloads,
    embed_learning_resources,
    embed_topics,
    filter_existing_qdrant_points_by_ids,
    remove_qdrant_records,
    vector_point_id,
    vector_point_key,
)
from vector_search.utils import (
    tune_qdrant_collections as tune_qdrant_collections_util,
)

log = logging.getLogger(__name__)

EMBED_FAILURE_TTL = 60 * 60 * 24  # 24h defensive cleanup for the per-run counter

# point ids per Qdrant existence lookup in the healthcheck tasks
HEALTHCHECK_POINT_BATCH_SIZE = 200

# resources per batched resource-embedding check task. Checking a resource is one
# payload-free point, so batching trades task count for Qdrant round trips: at 1 per
# task a full run costs one round trip per resource.
HEALTHCHECK_RESOURCE_BATCH_SIZE = 200

# content files per batched content-file check task. Lower than the resource batch:
# each one is serialized with its chunked text, so this bounds the text a worker
# holds at once
HEALTHCHECK_CONTENT_FILE_BATCH_SIZE = 100

# TTL for the per-run Sentry alert counters; long enough to outlive a healthcheck
# run (including redelivered tasks) and short enough to not accumulate in redis
HEALTHCHECK_ALERT_TTL = 60 * 60 * 24


def _record_embedding_failure(failure_key: str) -> None:
    """Bump the per-invocation embedding-failure counter in the shared redis cache."""
    cache = caches["redis"]
    key = f"embed_errors:{failure_key}"
    try:
        cache.incr(key)
    except ValueError:  # key absent
        cache.set(key, 1, EMBED_FAILURE_TTL)


@app.task
def tune_qdrant_collections():
    """
    Tune optimizer settings for Qdrant collections.
    """
    log.info("Running Qdrant collection tuning task")
    tune_qdrant_collections_util()


def _replace_with_chain(task, task_signatures):
    """
    Replace a task with a chain only when there is work to do.
    """
    if not task_signatures:
        return None
    return task.replace(celery.chain(*task_signatures))


def _replace_with_finalized_chain(
    task: celery.Task, content_file_ids: list[int], *, overwrite: bool
) -> None:
    """
    Chain of content-file embedding chunks + a finalize tail that fails the parent
    if any chunk failed. Returns None when there is nothing to embed.
    """
    failure_key = task.request.id
    sigs = [
        generate_embeddings.si(
            ids, CONTENT_FILE_TYPE, overwrite=overwrite, failure_key=failure_key
        )
        for ids in chunks(content_file_ids, chunk_size=settings.QDRANT_CHUNK_SIZE)
    ]
    if not sigs:
        return None
    return task.replace(celery.chain(*sigs, finalize_embeddings.si(failure_key)))


def _queue_program_content_file_embedding_tasks(index_tasks, program_ids, overwrite):
    """Queue content file embedding tasks for programs using a single bulk query."""
    if not program_ids:
        return

    contentfile_ids = (
        ContentFile.objects.filter(
            learning_resource_id__in=program_ids,
            published=True,
        )
        .order_by("id")
        .values_list("id", flat=True)
    )
    index_tasks.extend(
        [
            generate_embeddings.si(ids, CONTENT_FILE_TYPE, overwrite)
            for ids in chunks(
                contentfile_ids,
                chunk_size=settings.QDRANT_CHUNK_SIZE,
            )
        ]
    )


def _retry_countdown(retries: int) -> int:
    """
    Full-jitter exponential backoff capped at 10m. Minutes-scale so retries land
    after a qdrant CPU-throttle episode instead of hammering it while saturated.
    """
    return get_exponential_backoff_interval(
        factor=120, retries=retries, maximum=600, full_jitter=True
    )


@app.task(
    bind=True,
    acks_late=True,
    reject_on_worker_lost=True,
    max_retries=3,
    rate_limit="200/m",
)
def generate_embeddings(
    self,
    ids: list[int],
    resource_type: str,
    overwrite: bool,  # noqa: FBT001
    failure_key: str | None = None,
) -> None:
    """
    Generate learning resource embeddings and index in Qdrant.

    Retries transient Qdrant/search errors with jittered backoff. On exhaustion or a
    non-transient error: if failure_key is set, log + record the failure and return so
    the chain continues (finalize_embeddings fails the parent); otherwise propagate.
    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            embed_learning_resources(ids, resource_type, overwrite)
    except Ignore:
        raise
    except SystemExit as err:  # worker shutdown: transient; propagate if exhausted
        if self.request.retries < self.max_retries:
            raise self.retry(exc=err, countdown=_retry_countdown(self.request.retries))  # noqa: B904
        raise
    except Exception as err:
        is_transient_grpc = isinstance(err, grpc.RpcError) and err.code() in (
            grpc.StatusCode.DEADLINE_EXCEEDED,
            grpc.StatusCode.UNAVAILABLE,
        )
        if (isinstance(err, RetryError) or is_transient_grpc) and (
            self.request.retries < self.max_retries
        ):
            raise self.retry(exc=err, countdown=_retry_countdown(self.request.retries))  # noqa: B904
        if failure_key is None:
            raise  # generic callers: propagate terminal failure (current behavior)
        log.exception("generate_embeddings failed for %s", resource_type)
        _record_embedding_failure(failure_key)


@app.task(
    acks_late=True,
    reject_on_worker_lost=True,
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_VECTOR_SEARCH_RATE_LIMIT,
)
def remove_embeddings(ids, resource_type):
    """
    Remove resource embeddings from Qdrant

    Args:
        ids(list of int): List of resource id's
        resource_type (string): resource_type value for the learning resource objects

    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            remove_qdrant_records(ids, resource_type)
    except (RetryError, Ignore):
        raise
    except SystemExit as err:
        raise RetryError(SystemExit.__name__) from err
    except grpc.RpcError as err:
        if err.code() == grpc.StatusCode.DEADLINE_EXCEEDED:
            raise RetryError(str(err)) from err
        raise


@app.task
def finalize_embeddings(failure_key: str) -> None:
    """Chain tail: fail the parent task if any chunk recorded a failure."""
    cache = caches["redis"]
    key = f"embed_errors:{failure_key}"
    failures = cache.get(key, 0)
    cache.delete(key)
    if failures:
        msg = f"{failures} embedding chunk(s) failed for {failure_key}"
        log.error(msg)
        raise RuntimeError(msg)


@app.task(bind=True)
def start_embed_resources(self, indexes, skip_content_files, overwrite):  # noqa: C901
    """
    Celery task to embed all learning resources for given indexes

    Args:
        indexes (list of str): resource types to embed
        skip_content_files (bool): whether to skip embedding content files
    """
    index_tasks = []
    if not all([settings.QDRANT_HOST, settings.QDRANT_BASE_COLLECTION_NAME]):
        log.warning(
            "skipping. start_embed_resources called without setting "
            "QDRANT_HOST and QDRANT_BASE_COLLECTION_NAME"
        )
        return None
    try:
        if COURSE_TYPE in indexes:
            blocklisted_ids = load_course_blocklist()

            index_tasks = [
                generate_embeddings.si(ids, COURSE_TYPE, overwrite)
                for ids in chunks(
                    Course.objects.filter(learning_resource__published=True)
                    .exclude(learning_resource__readable_id__in=blocklisted_ids)
                    .order_by("learning_resource_id")
                    .values_list("learning_resource_id", flat=True),
                    chunk_size=settings.QDRANT_CHUNK_SIZE,
                )
            ]

            if not skip_content_files:
                for course in (
                    LearningResource.objects.filter(
                        resource_type=COURSE_TYPE,
                    )
                    .filter(Q(published=True) | Q(test_mode=True))
                    .exclude(readable_id__in=blocklisted_ids)
                    .order_by("id")
                ):
                    # Embed published content files across all runs of the course
                    # (Qdrant retains all runs, not just best_run).
                    contentfiles = (
                        ContentFile.objects.filter(published=True)
                        .filter(
                            Q(run__learning_resource=course)
                            | Q(learning_resource=course)
                        )
                        .order_by("id")
                        .values_list("id", flat=True)
                    )
                    index_tasks = index_tasks + [
                        generate_embeddings.si(ids, CONTENT_FILE_TYPE, overwrite)
                        for ids in chunks(
                            contentfiles,
                            chunk_size=settings.QDRANT_CHUNK_SIZE,
                        )
                    ]
        for resource_type in set(LEARNING_RESOURCE_TYPES) - {COURSE_TYPE}:
            if resource_type in indexes:
                resource_filter = Q(published=True)
                if resource_type == PROGRAM_TYPE:
                    resource_filter = Q(published=True) | Q(test_mode=True)

                resource_ids = (
                    LearningResource.objects.filter(
                        resource_filter,
                        resource_type=resource_type,
                    )
                    .order_by("id")
                    .values_list("id", flat=True)
                )
                for ids in chunks(
                    resource_ids,
                    chunk_size=settings.QDRANT_CHUNK_SIZE,
                ):
                    index_tasks.append(
                        generate_embeddings.si(ids, resource_type, overwrite)
                    )
            if not skip_content_files and resource_type == PROGRAM_TYPE:
                # Programs have marketing_page and metadata content files
                # that also need to be embedded.
                program_ids = list(
                    LearningResource.objects.filter(
                        Q(published=True) | Q(test_mode=True),
                        resource_type=PROGRAM_TYPE,
                    )
                    .order_by("id")
                    .values_list("id", flat=True)
                )
                _queue_program_content_file_embedding_tasks(
                    index_tasks,
                    program_ids,
                    overwrite,
                )
    except:  # noqa: E722
        error = "start_embed_resources threw an error"
        log.exception(error)
        return error

    # Use self.replace so that code waiting on this task will also wait on the embedding
    #  and finish tasks
    return _replace_with_chain(self, index_tasks)


@app.task(bind=True)
def embed_learning_resources_by_id(self, ids, skip_content_files, overwrite):
    """
    Celery task to embed specific resources

    Args:
        ids (list of int): list of resource ids to embed
        skip_content_files (bool): whether to skip embedding content files
    """
    index_tasks = []
    if not all([settings.QDRANT_HOST, settings.QDRANT_BASE_COLLECTION_NAME]):
        log.warning(
            "skipping. start_embed_resources called without setting "
            "QDRANT_HOST and QDRANT_BASE_COLLECTION_NAME"
        )
        return None
    resources = LearningResource.objects.filter(
        id__in=ids,
    ).filter(Q(published=True) | Q(test_mode=True))
    try:
        for resource_type in LEARNING_RESOURCE_TYPES:
            embed_resources = resources.filter(resource_type=resource_type)
            [
                index_tasks.append(
                    generate_embeddings.si(chunk_ids, resource_type, overwrite)
                )
                for chunk_ids in chunks(
                    embed_resources.order_by("id").values_list("id", flat=True),
                    chunk_size=settings.QDRANT_CHUNK_SIZE,
                )
            ]
            if not skip_content_files and resource_type == PROGRAM_TYPE:
                _queue_program_content_file_embedding_tasks(
                    index_tasks,
                    list(embed_resources.order_by("id").values_list("id", flat=True)),
                    overwrite,
                )
            elif not skip_content_files and resource_type == COURSE_TYPE:
                for course in embed_resources.order_by("id"):
                    # Embed published content files across all runs of the course
                    # (Qdrant retains all runs, not just best_run).
                    content_ids = (
                        ContentFile.objects.filter(published=True)
                        .filter(
                            Q(run__learning_resource=course)
                            | Q(learning_resource=course)
                        )
                        .order_by("id")
                        .values_list("id", flat=True)
                    )

                    index_tasks = index_tasks + [
                        generate_embeddings.si(ids, CONTENT_FILE_TYPE, overwrite)
                        for ids in chunks(
                            content_ids,
                            chunk_size=settings.QDRANT_CHUNK_SIZE,
                        )
                    ]

    except:  # noqa: E722
        error = "start_embed_resources threw an error"
        log.exception(error)
        return error

    # Use self.replace so that code waiting on this task will also wait on the embedding
    #  and finish tasks

    return _replace_with_chain(self, index_tasks)


@app.task(bind=True)
def embed_new_learning_resources(self):
    """
    Embed new resources from QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW minutes ago
    """
    log.info("Running new resource embedding task")
    delta = datetime.timedelta(minutes=settings.QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW)
    since = now_in_utc() - delta
    new_learning_resources = LearningResource.objects.filter(
        published=True,
        created_on__gt=since,
    ).exclude(resource_type=CONTENT_FILE_TYPE)

    resource_types = list(
        new_learning_resources.order_by("resource_type")
        .values_list("resource_type", flat=True)
        .distinct()
    )
    tasks = []
    for resource_type in resource_types:
        tasks.extend(
            [
                generate_embeddings.si(ids, resource_type, overwrite=False)
                for ids in chunks(
                    new_learning_resources.filter(
                        resource_type=resource_type
                    ).values_list("id", flat=True),
                    chunk_size=settings.QDRANT_CHUNK_SIZE,
                )
            ]
        )
    # Dispatch chunks sequentially instead of materializing the whole lookback
    # window as one group. This bounds broker queue depth and prevents KEDA from
    # scaling the embeddings worker fleet for a short-lived fan-out burst.
    return _replace_with_chain(self, tasks)


@app.task(bind=True)
def embed_new_content_files(self):
    """
    Embed new content files from QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW minutes ago
    """
    log.info("Running content file embedding task")
    delta = datetime.timedelta(minutes=settings.QDRANT_EMBEDDINGS_TASK_LOOKBACK_WINDOW)
    since = now_in_utc() - delta
    new_content_files = (
        ContentFile.objects.filter(
            published=True,
            created_on__gt=since,
        )
        .exclude(run__published=False)
        .exclude(learning_resource__published=False, learning_resource__test_mode=False)
    )

    return _replace_with_finalized_chain(
        self,
        list(new_content_files.values_list("id", flat=True)),
        overwrite=False,
    )


@app.task(bind=True, max_retries=3)
def embed_run_content_files(self, run_id):
    """
    Embed the run's published content files whose Qdrant points are missing or
    stale (checksum or a payload metadata field differs).

    A run-level pre-pass batch-compares each file's DB checksum and payload
    metadata columns against the stored Qdrant payload, so a fully-unchanged
    run costs one DB query plus a few batched retrieves instead of serializing
    every file. A checksum-matching file with drifted metadata (edited title,
    newly generated summary, ...) is dispatched but exits via the payload-only
    update path downstream — no re-embedding. Failed or purged embeds show up
    as missing/stale points, so they self-heal on the next load.

    Content-less files are excluded: they never produce Qdrant points, so they
    would otherwise be re-flagged on every load. Any point left over from when
    such a file still had content is removed. Transient Qdrant errors during
    the pre-pass retry with backoff so a blip doesn't defer the run's embedding
    to the next load.
    """
    run = (
        LearningResourceRun.objects.select_related("learning_resource__platform")
        .filter(id=run_id)
        .first()
    )
    if run is None:
        return None
    resource = run.learning_resource
    platform_code = resource.platform.code if resource.platform else ""

    def first_chunk_point_id(key):
        # Returns the qdrant point id for the first chunk of the contentfile,
        # mirroring the doc fields ContentFileSerializer emits for run files
        return vector_point_id(
            vector_point_key(
                {
                    "platform": {"code": platform_code},
                    "resource_readable_id": resource.readable_id,
                    "run_readable_id": run.run_id,
                    "key": key,
                },
                chunk_number=0,
                document_type="content_file",
            )
        )

    contentless = Q(content__isnull=True) | Q(content="")
    pid_rows = [
        (cf_id, first_chunk_point_id(key), checksum, meta)
        for cf_id, key, checksum, *meta in ContentFile.objects.filter(
            run=run, published=True
        )
        .exclude(contentless)
        .values_list("id", "key", "checksum", *CONTENT_FILE_PREPASS_PAYLOAD_FIELDS)
    ]
    contentless_rows = [
        (cf_id, first_chunk_point_id(key))
        for cf_id, key in ContentFile.objects.filter(
            contentless, run=run, published=True
        ).values_list("id", "key")
    ]
    try:
        stored = _stored_content_payloads(
            [pid for _, pid, _, _ in pid_rows] + [pid for _, pid in contentless_rows],
            fields=("checksum", *CONTENT_FILE_PREPASS_PAYLOAD_FIELDS),
        )
    except grpc.RpcError as err:
        if err.code() in (
            grpc.StatusCode.DEADLINE_EXCEEDED,
            grpc.StatusCode.UNAVAILABLE,
        ):
            raise self.retry(exc=err, countdown=_retry_countdown(self.request.retries))  # noqa: B904
        raise

    def is_stale(pid, checksum, meta):
        payload = stored.get(pid)
        if payload is None or payload.get("checksum") != checksum:
            return True
        return any(
            payload.get(field) != value
            for field, value in zip(CONTENT_FILE_PREPASS_PAYLOAD_FIELDS, meta)
        )

    ids = [
        cf_id
        for cf_id, pid, checksum, meta in pid_rows
        if is_stale(pid, checksum, meta)
    ]
    # A stored point for a now-contentless file is a leftover from when the
    # file had content — remove it. Inline rather than a chained task: leftovers
    # are rare and few, and a failed delete self-heals on the next load.
    leftover_ids = [cf_id for cf_id, pid in contentless_rows if pid in stored]
    log.info(
        "embed_run_content_files run %s: %d of %d files need embedding, "
        "%d leftover contentless points to remove",
        run_id,
        len(ids),
        len(pid_rows),
        len(leftover_ids),
    )
    if leftover_ids:
        remove_qdrant_records(leftover_ids, CONTENT_FILE_TYPE)
    if not ids:
        return None
    return _replace_with_finalized_chain(self, ids, overwrite=True)


@app.task(bind=True)
def remove_run_content_files(self, run_id):
    """
    Remove content files associated with a run from Qdrant
    """
    content_file_ids = list(
        ContentFile.objects.filter(run__id=run_id).values_list("id", flat=True)
    )
    tasks = [
        remove_embeddings.si(ids, CONTENT_FILE_TYPE)
        for ids in chunks(content_file_ids, chunk_size=settings.QDRANT_CHUNK_SIZE)
    ]
    return _replace_with_chain(self, tasks)


@app.task(bind=True)
def remove_unpublished_run_content_files(self, run_id):
    """
    Remove unpublished content files associated with a run from Qdrant
    """
    content_file_ids = list(
        ContentFile.objects.filter(run__id=run_id, published=False).values_list(
            "id", flat=True
        )
    )
    tasks = [
        remove_embeddings.si(ids, CONTENT_FILE_TYPE)
        for ids in chunks(content_file_ids, chunk_size=settings.QDRANT_CHUNK_SIZE)
    ]
    return _replace_with_chain(self, tasks)


@app.task(bind=True, acks_late=True, reject_on_worker_lost=True)
def embeddings_healthcheck(self):
    """
    Dispatch the embeddings healthcheck as a group of independent, self-reporting
    tasks: batches of resources, batches of content files, and the summaries check.

    Both checks are dispatched over their own rows, so nothing is queued for a
    resource with no content files, and neither list is built from the other.
    """
    resources = LearningResource.objects.filter(Q(published=True) | Q(test_mode=True))
    resource_ids = list(resources.order_by("id").values_list("id", flat=True))

    # streamed with iterator(): there are far more content files than resources, and
    # only one batch of ids needs to be in memory at a time to build the signatures
    content_file_ids = (
        ContentFile.objects.filter(published=True)
        .exclude(Q(content="") | Q(content__isnull=True))
        .filter(
            Q(run__learning_resource__in=resources) | Q(learning_resource__in=resources)
        )
        .order_by("id")
        .values_list("id", flat=True)
        .iterator(chunk_size=HEALTHCHECK_CONTENT_FILE_BATCH_SIZE)
    )

    # scopes the per-run Sentry alert cap: every task dispatched here shares one
    # budget. Redelivery reuses the same task id, so a culled and re-dispatched run
    # keeps its already-spent budget rather than paying for the same alerts twice.
    # A direct call (a shell invocation rather than delay()) has no task id, and
    # falling back to a generated key keeps the cap on: without one, this would hand
    # every dispatched task run_key=None and uncap the entire run.
    run_key = self.request.id or str(uuid4())

    content_file_tasks = [
        embeddings_healthcheck_content_files.si(batch, run_key=run_key)
        for batch in chunks(
            content_file_ids, chunk_size=HEALTHCHECK_CONTENT_FILE_BATCH_SIZE
        )
    ]
    resource_tasks = [
        embeddings_healthcheck_resource_embeddings.si(batch, run_key=run_key)
        for batch in chunks(resource_ids, chunk_size=HEALTHCHECK_RESOURCE_BATCH_SIZE)
    ]
    log.info(
        "Embeddings healthcheck dispatching %d resource batches for %d resources "
        "and %d content file batches",
        len(resource_tasks),
        len(resource_ids),
        len(content_file_tasks),
    )

    return self.replace(
        celery.group(
            [
                summaries_healthcheck.si(run_key=run_key),
                *resource_tasks,
                *content_file_tasks,
            ]
        )
    )


@app.task(acks_late=True, reject_on_worker_lost=True)
def embeddings_healthcheck_resource_embeddings(resource_ids, run_key=None):
    """
    Check a batch of learning resources for their own missing embeddings in Qdrant
    and report the findings to Sentry.

    Batched: each resource contributes one point and no payload, so the cost here is
    Qdrant round trips rather than memory.

    Read-only, so re-running after a worker is culled mid-check is safe.
    """
    # Build the point ids from the same bulk serialization the embedding pipeline
    # uses, so the healthcheck can't disagree with it about a resource's point key.
    resource_point_ids = {
        vector_point_id(vector_point_key(serialized)): serialized["_id"]
        for serialized in serialize_bulk_learning_resources(resource_ids)
    }

    missing_resource_ids = []
    for batch in chunks(
        resource_point_ids.keys(), chunk_size=HEALTHCHECK_POINT_BATCH_SIZE
    ):
        missing_resource_ids.extend(
            resource_point_ids[p]
            for p in filter_existing_qdrant_points_by_ids(
                batch, collection_name=RESOURCES_COLLECTION_NAME
            )
            if p in resource_point_ids
        )

    log.info(
        "Embeddings healthcheck: %d of %d resources missing their embedding",
        len(missing_resource_ids),
        len(resource_ids),
    )

    # one alert per batch rather than per resource: the ids identify the resources
    # without spending an alert (and a slice of the per-run cap) on each one
    if missing_resource_ids:
        _sentry_healthcheck_log(
            "embeddings",
            "missing_learning_resource_embeddings",
            {
                "count": len(missing_resource_ids),
                "ids": missing_resource_ids,
                "readable_ids": list(
                    LearningResource.objects.filter(
                        id__in=missing_resource_ids
                    ).values_list("readable_id", flat=True)[:100]
                ),
            },
            "Warning: learning resources are missing their embeddings",
            run_key=run_key,
        )


@app.task(acks_late=True, reject_on_worker_lost=True)
def embeddings_healthcheck_content_files(content_file_ids, run_key=None):
    """
    Check a batch of content files for missing embeddings in Qdrant and report the
    findings to Sentry.

    Batched over content files rather than over the resources that own them: the
    batch size then bounds how much serialized text a worker holds at once,
    regardless of how many content files any one resource has.

    Read-only, so re-running after a worker is culled mid-check is safe.
    """
    missing_content_file_ids = []

    content_file_point_ids = {}
    # All runs are embedded in Qdrant, not just best_run, so this batch is drawn from
    # content files directly rather than from any one run.
    for cf in ContentFile.objects.for_serialization().filter(id__in=content_file_ids):
        if cf and cf.content:
            serialized_cf = ContentFileSerializer(cf).data
            point_id = vector_point_id(
                vector_point_key(
                    serialized_cf, chunk_number=0, document_type="content_file"
                )
            )
            content_file_point_ids[point_id] = cf.id
    for batch in chunks(
        content_file_point_ids.keys(), chunk_size=HEALTHCHECK_POINT_BATCH_SIZE
    ):
        missing_content_file_ids.extend(
            content_file_point_ids[p]
            for p in filter_existing_qdrant_points_by_ids(
                batch, collection_name=CONTENT_FILES_COLLECTION_NAME
            )
            if p in content_file_point_ids
        )

    log.info(
        "Embeddings healthcheck: %d of %d content files missing embeddings",
        len(missing_content_file_ids),
        len(content_file_ids),
    )

    if missing_content_file_ids:
        _sentry_healthcheck_log(
            "embeddings",
            "missing_content_file_embeddings",
            {
                "count": len(missing_content_file_ids),
                "ids": missing_content_file_ids,
                "run_ids": set(
                    ContentFile.objects.filter(
                        id__in=missing_content_file_ids
                    ).values_list("run__run_id", flat=True)[:100]
                ),
            },
            "Warning: content files are missing embeddings",
            run_key=run_key,
        )


@app.task(acks_late=True, reject_on_worker_lost=True)
def summaries_healthcheck(run_key=None):
    """
    Check for content files missing summaries/flashcards and report to Sentry.

    Read-only, so re-running after a worker is culled is safe.
    """
    missing_summaries = _missing_summaries()
    log.info(
        "Embeddings healthcheck found %d missing summaries and flashcards",
        len(missing_summaries),
    )
    if len(missing_summaries) > 0:
        _sentry_healthcheck_log(
            "embeddings",
            "missing_content_file_summaries",
            {
                "count": len(missing_summaries),
                "ids": missing_summaries,
                "run_ids": set(
                    ContentFile.objects.filter(id__in=missing_summaries).values_list(
                        "run__run_id", flat=True
                    )[:100]
                ),
            },
            "Warning: missing content file summaries detected",
            run_key=run_key,
        )


def _missing_summaries():
    resource_ids = list(
        LearningResource.objects.filter(require_summaries=True)
        .filter(Q(published=True) | Q(test_mode=True))
        .values_list("id", flat=True)
    )
    if not resource_ids:
        # get_unprocessed_content_file_ids treats an empty learning_resource_ids
        # list the same as None (no restriction), so short-circuit here instead
        # of letting it scan every learning resource.
        return []

    from learning_resources.content_summarizer import ContentSummarizer

    summarizer = ContentSummarizer()
    return summarizer.get_unprocessed_content_file_ids(
        overwrite=False,
        learning_resource_ids=resource_ids,
    )


def _capture_healthcheck_message(healthcheck, alert_type, context, message):
    """Send one healthcheck message to Sentry, uncapped."""
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("healthcheck", healthcheck)
        scope.set_tag("alert_type", alert_type)
        # key the context off the alert so resource/summary alerts don't file their
        # payload under a content-file key
        scope.set_context(alert_type, context)
        sentry_sdk.capture_message(message)


def _healthcheck_alert_count(run_key, alert_type):
    """
    Atomically count this run's alerts of one type, so the per-run cap holds across
    every worker running the healthcheck's tasks.
    """
    cache = caches["redis"]
    key = f"healthcheck_alerts:{run_key}:{alert_type}"
    try:
        return cache.incr(key)
    except ValueError:  # key absent
        # add() is atomic, so exactly one of the workers racing to create the counter
        # wins it; the losers fall through to incr instead of each resetting it to 1
        # and handing every racer the same count of 1
        if cache.add(key, 1, HEALTHCHECK_ALERT_TTL):
            return 1
        try:
            return cache.incr(key)
        except ValueError:
            # expired between add() and incr(): only reachable if this run outlives
            # HEALTHCHECK_ALERT_TTL, in which case counting from 1 again is right
            return 1


def _sentry_healthcheck_log(healthcheck, alert_type, context, message, run_key=None):
    """
    Report a healthcheck finding to Sentry, capped per run per alert type.

    The healthcheck reports per resource, so an environment that is merely behind on
    embedding produces one alert per affected resource. Without a cap that is
    thousands of events for a single expected condition. run_key scopes the counter
    to one healthcheck run; callers without one (direct calls, tests) are uncapped.

    Each alert type gets its own budget: the checks are independent signals, and a
    run works through resources for hours, so a shared budget would be spent by
    whichever check happens to find something first.
    """
    cap = settings.EMBEDDINGS_HEALTHCHECK_ALERT_CAP
    if run_key and cap > 0:
        count = _healthcheck_alert_count(run_key, alert_type)
        if count > cap:
            # the count is atomic, so exactly one worker sees cap + 1 and the notice
            # is sent once: a capped run must never look like a run that only found
            # `cap` problems
            if count == cap + 1:
                log.warning(
                    "Embeddings healthcheck reached the Sentry alert cap (%d) for %s; "
                    "further alerts of this type are suppressed for this run",
                    cap,
                    alert_type,
                )
                _capture_healthcheck_message(
                    healthcheck,
                    f"{alert_type}_suppressed",
                    {"suppressed_alert_type": alert_type, "cap": cap},
                    "Warning: healthcheck alerts suppressed after reaching the "
                    "per-run cap",
                )
            return
    _capture_healthcheck_message(healthcheck, alert_type, context, message)


@app.task(acks_late=True, reject_on_worker_lost=True)
def sync_topics():
    """
    Sync topics to the Qdrant collection
    """
    embed_topics()
