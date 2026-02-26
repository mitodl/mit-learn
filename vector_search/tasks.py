import datetime
import logging

import celery
import sentry_sdk
from celery.exceptions import Ignore
from django.conf import settings
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

log = logging.getLogger(__name__)


@app.task(
    acks_late=True,
    reject_on_worker_lost=True,
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit="300/m",
)
def generate_embeddings(ids, resource_type, overwrite):
    """
    Generate learning resource embeddings and index in Qdrant

    Args:
        ids(list of int): List of resource id's
        resource_type (string): resource_type value for the learning resource objects

    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            embed_learning_resources(ids, resource_type, overwrite)
    except (RetryError, Ignore):
        raise
    except SystemExit as err:
        raise RetryError(SystemExit.__name__) from err
    except:  # noqa: E722
        error = "generate_embeddings threw an error"
        log.exception(error)
        return error


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
    except:  # noqa: E722
        error = "generate_embeddings threw an error"
        log.exception(error)
        return error


@app.task(bind=True)
def start_embed_resources(self, indexes, skip_content_files, overwrite):
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
                    run = (
                        course.best_run
                        if course.best_run
                        else course.runs.filter(published=True)
                        .order_by("-start_date")
                        .first()
                    )
                    contentfiles = (
                        ContentFile.objects.filter(
                            Q(run=run, published=True, run__published=True)
                            | Q(
                                learning_resource=course,
                                published=True,
                                learning_resource__published=True,
                            )
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
                for ids in chunks(
                    LearningResource.objects.filter(
                        published=True, resource_type=resource_type
                    )
                    .order_by("id")
                    .values_list("id", flat=True),
                    chunk_size=settings.QDRANT_CHUNK_SIZE,
                ):
                    index_tasks.append(
                        generate_embeddings.si(ids, resource_type, overwrite)
                    )
    except:  # noqa: E722
        error = "start_embed_resources threw an error"
        log.exception(error)
        return error

    # Use self.replace so that code waiting on this task will also wait on the embedding
    #  and finish tasks
    return self.replace(celery.chain(*index_tasks))


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

            if not skip_content_files and resource_type == COURSE_TYPE:
                for course in embed_resources.order_by("id"):
                    run = (
                        course.best_run
                        if course.best_run
                        else course.runs.filter(published=True)
                        .order_by("-start_date")
                        .first()
                    )
                    content_ids = (
                        ContentFile.objects.filter(
                            Q(run=run, published=True, run__published=True)
                            | Q(
                                learning_resource=course,
                                published=True,
                                learning_resource__published=True,
                            )
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

    return self.replace(celery.chain(*index_tasks))


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
        new_learning_resources.values_list("resource_type", flat=True)
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

    tasks = [
        generate_embeddings.si(ids, CONTENT_FILE_TYPE, overwrite=False)
        for ids in chunks(
            new_content_files.values_list("id", flat=True),
            chunk_size=settings.QDRANT_CHUNK_SIZE,
        )
    ]
    embed_tasks = celery.group(tasks)
    return self.replace(embed_tasks)


@app.task(bind=True)
def embed_run_content_files(self, run_id):
    """
    Embed contentfiles associated with a run
    """
    content_file_ids = list(
        ContentFile.objects.filter(run__id=run_id).values_list("id", flat=True)
    )

    return self.replace(
        celery.group(
            [
                generate_embeddings.si(ids, CONTENT_FILE_TYPE, overwrite=True)
                for ids in chunks(
                    content_file_ids, chunk_size=settings.QDRANT_CHUNK_SIZE
                )
            ]
        )
    )


@app.task
def remove_run_content_files(run_id):
    """
    Remove content files associated with a run from Qdrant
    """
    content_file_ids = list(
        ContentFile.objects.filter(run__id=run_id).values_list("id", flat=True)
    )
    return celery.group(
        [
            remove_embeddings.si(ids, CONTENT_FILE_TYPE)
            for ids in chunks(content_file_ids, chunk_size=settings.QDRANT_CHUNK_SIZE)
        ]
    )


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
        run = (
            lr.best_run
            if lr.best_run
            else lr.runs.filter(published=True).order_by("-start_date").first()
        )
        serialized = LearningResourceSerializer(lr).data
        point_id = vector_point_id(vector_point_key(serialized))
        resource_point_ids[point_id] = {"resource_id": lr.readable_id, "id": lr.id}
        content_file_point_ids = {}
        if run:
            for cf in run.content_files.filter(published=True):
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
                    vector_point_id(serialized_resource)
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
