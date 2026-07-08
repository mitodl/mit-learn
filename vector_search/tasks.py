import datetime
import logging

import celery
import grpc
import sentry_sdk
from celery.exceptions import Ignore
from celery.utils.time import get_exponential_backoff_interval
from django.conf import settings
from django.core.cache import caches
from django.db.models import Q

from learning_resources.content_summarizer import ContentSummarizer
from learning_resources.models import (
    ContentFile,
    Course,
    LearningResource,
)
from learning_resources.serializers import (
    ContentFileSerializer,
    LearningResourceSerializer,
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
    CONTENT_FILES_COLLECTION_NAME,
    RESOURCES_COLLECTION_NAME,
)
from vector_search.utils import (
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
    """Full-jitter exponential backoff (mirrors retry_backoff=True), capped at 10m."""
    return get_exponential_backoff_interval(
        factor=1, retries=retries, maximum=600, full_jitter=True
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
        is_deadline = (
            isinstance(err, grpc.RpcError)
            and err.code() == grpc.StatusCode.DEADLINE_EXCEEDED
        )
        if (isinstance(err, RetryError) or is_deadline) and (
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
                    .exclude(learning_resource__readable_id=blocklisted_ids)
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
                    .exclude(readable_id=blocklisted_ids)
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
    embed_tasks = celery.group(tasks)

    return self.replace(embed_tasks)


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


@app.task(bind=True)
def embed_run_content_files(self, run_id):
    """
    Embed contentfiles associated with a run
    """
    content_file_ids = list(
        ContentFile.objects.filter(run__id=run_id).values_list("id", flat=True)
    )

    return _replace_with_finalized_chain(self, content_file_ids, overwrite=False)


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


@app.task
def embeddings_healthcheck():
    """
    Check for missing embeddings and summaries in Qdrant and log warnings to Sentry
    """

    remaining_content_file_ids = []
    remaining_resources = []
    resource_point_ids = {}
    all_resources = LearningResource.objects.filter(
        Q(published=True) | Q(test_mode=True)
    )

    for lr in all_resources:
        serialized = LearningResourceSerializer(lr).data
        point_id = vector_point_id(vector_point_key(serialized))
        resource_point_ids[point_id] = {"resource_id": lr.readable_id, "id": lr.id}
        content_file_point_ids = {}
        # All runs are embedded in Qdrant, not just best_run.
        content_files = ContentFile.objects.for_serialization().filter(
            Q(run__learning_resource=lr) | Q(learning_resource=lr),
            published=True,
        )
        for cf in content_files:
            if cf and cf.content:
                serialized_cf = ContentFileSerializer(cf).data
                point_id = vector_point_id(
                    vector_point_key(
                        serialized_cf, chunk_number=0, document_type="content_file"
                    )
                )
                content_file_point_ids[point_id] = {"key": cf.key, "id": cf.id}
        for batch in chunks(content_file_point_ids.keys(), chunk_size=200):
            remaining_content_files = filter_existing_qdrant_points_by_ids(
                batch, collection_name=CONTENT_FILES_COLLECTION_NAME
            )
            remaining_content_file_ids.extend(
                [
                    content_file_point_ids.get(p, {}).get("id")
                    for p in remaining_content_files
                ]
            )

    for batch in chunks(
        all_resources.values_list("id", flat=True),
        chunk_size=200,
    ):
        remaining_resources.extend(
            filter_existing_qdrant_points_by_ids(
                [
                    vector_point_id(vector_point_key(serialized_resource))
                    for serialized_resource in serialize_bulk_learning_resources(batch)
                ],
                collection_name=RESOURCES_COLLECTION_NAME,
            )
        )

    remaining_resource_ids = [
        resource_point_ids.get(p, {}).get("id") for p in remaining_resources
    ]
    missing_summaries = _missing_summaries()
    log.info(
        "Embeddings healthcheck found %d missing content file embeddings",
        len(remaining_content_file_ids),
    )
    log.info(
        "Embeddings healthcheck found %d missing resource embeddings",
        len(remaining_resources),
    )
    log.info(
        "Embeddings healthcheck found %d missing summaries and flashcards",
        len(missing_summaries),
    )

    if len(remaining_content_file_ids) > 0:
        _sentry_healthcheck_log(
            "embeddings",
            "missing_content_file_embeddings",
            {
                "count": len(remaining_content_file_ids),
                "ids": remaining_content_file_ids,
                "run_ids": set(
                    ContentFile.objects.filter(
                        id__in=remaining_content_file_ids
                    ).values_list("run__run_id", flat=True)[:100]
                ),
            },
            f"Warning: {len(remaining_content_file_ids)} missing content file "
            "embeddings detected",
        )

    if len(remaining_resources) > 0:
        _sentry_healthcheck_log(
            "embeddings",
            "missing_learning_resource_embeddings",
            {
                "count": len(remaining_resource_ids),
                "ids": remaining_resource_ids,
                "titles": list(
                    LearningResource.objects.filter(
                        id__in=remaining_resource_ids
                    ).values_list("title", flat=True)
                ),
            },
            f"Warning: {len(remaining_resource_ids)} missing learning resource "
            "embeddings detected",
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
            f"Warning: {len(missing_summaries)} missing content file summaries "
            "detected",
        )


def _missing_summaries():
    summarizer = ContentSummarizer()
    return summarizer.get_unprocessed_content_file_ids(
        LearningResource.objects.filter(require_summaries=True)
        .filter(Q(published=True) | Q(test_mode=True))
        .values_list("id", flat=True)
    )


def _sentry_healthcheck_log(healthcheck, alert_type, context, message):
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("healthcheck", healthcheck)
        scope.set_tag("alert_type", alert_type)
        scope.set_context("missing_content_file_embeddings", context)
        sentry_sdk.capture_message(message)


@app.task
def sync_topics():
    """
    Sync topics to the Qdrant collection
    """
    embed_topics()
