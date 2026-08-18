"""Indexing tasks"""

import datetime
import itertools
import logging
from collections import OrderedDict
from contextlib import contextmanager
from http import HTTPStatus
from itertools import groupby
from random import random
from urllib.parse import urlencode

import celery
import requests
from celery.exceptions import Ignore
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.template.defaultfilters import pluralize
from opensearchpy.exceptions import NotFoundError, RequestError
from requests.models import PreparedRequest

from learning_resources.constants import LearningResourceType
from learning_resources.etl.constants import RESOURCE_FILE_ETL_SOURCES
from learning_resources.models import (
    ContentFile,
    Course,
    LearningResource,
    LearningResourceDepartment,
    LearningResourceOfferor,
)
from learning_resources.utils import load_course_blocklist
from learning_resources.views import FeaturedViewSet
from learning_resources_search import indexing_api as api
from learning_resources_search.api import (
    gen_content_file_id,
    percolate_matches_for_document,
)
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
    COURSE_TYPE,
    HYBRID_COMBINED_INDEX,
    LEARNING_RESOURCE_TYPES,
    PERCOLATE_INDEX_TYPE,
    PROGRAM_TYPE,
    REINDEX_TASK_NAME,
    SEARCH_CONN_EXCEPTIONS,
    IndexestoUpdate,
    ReindexBatchKind,
)
from learning_resources_search.exceptions import ReindexError, RetryError
from learning_resources_search.models import PercolateQuery
from learning_resources_search.serializers import (
    serialize_bulk_percolators,
    serialize_content_file_for_update,
    serialize_learning_resource_for_update,
    serialize_percolate_query_for_update,
)
from main.celery import app
from main.models import TaskBatch, TaskJob
from main.tasks import maybe_finish_task_job
from main.utils import (
    chunks,
    clear_views_cache,
    frontend_absolute_url,
    now_in_utc,
)
from profiles.utils import send_template_email

User = get_user_model()
log = logging.getLogger(__name__)

# Timeout for the digest email's image liveness check
IMAGE_CHECK_TIMEOUT_SECONDS = 5


# For our tasks that attempt to partially update a document, there's a chance that
# the document has not yet been created. When we get an error that indicates that the
# document doesn't exist for the given ID, we will retry a few times in case there is
# a waiting task to create the document.
PARTIAL_UPDATE_TASK_SETTINGS = {
    "autoretry_for": (NotFoundError,),
    "retry_kwargs": {"max_retries": 5},
    "default_retry_delay": 2,
    "rate_limit": settings.CELERY_SEARCH_RATE_LIMIT,
}


@app.task(**PARTIAL_UPDATE_TASK_SETTINGS)
def update_featured_rank():
    """Update featured ranks for resources in the search index."""
    featured_view_set = FeaturedViewSet()
    featured_resources = featured_view_set.get_queryset()
    for position, resources_with_position in groupby(
        featured_resources, key=lambda x: x.position
    ):
        api.clear_featured_rank(position, clear_all_greater_than=False)
        for resource in resources_with_position:
            api.update_document_with_partial(
                resource.id,
                {"featured_rank": position + random()},  # noqa: S311
                resource.resource_type,
            )

    api.clear_featured_rank(
        featured_resources.values_list("position", flat=True).distinct().count(),
        clear_all_greater_than=True,
    )


@app.task(**PARTIAL_UPDATE_TASK_SETTINGS)
def upsert_content_file(file_id):
    """Upsert content file based on stored database information"""

    content_file_obj = ContentFile.objects.for_serialization().get(id=file_id)
    content_file_data = serialize_content_file_for_update(content_file_obj)
    parent_resource = (
        content_file_obj.run.learning_resource
        if content_file_obj.run_id
        else content_file_obj.learning_resource
    )
    if parent_resource is None:
        msg = f"ContentFile {content_file_obj.id} has no parent learning resource"
        log.error(msg)
        raise ValueError(msg)
    learning_resource_id = parent_resource.id
    resource_type = parent_resource.resource_type
    api.upsert_document(
        gen_content_file_id(content_file_obj.id),
        content_file_data,
        resource_type,
        retry_on_conflict=settings.INDEXING_ERROR_RETRIES,
        routing=learning_resource_id,
    )


@app.task(rate_limit=settings.CELERY_SEARCH_RATE_LIMIT)
def upsert_percolate_query(percolate_id):
    """Task that makes a request to add an ES document"""
    percolate_query = PercolateQuery.objects.get(id=percolate_id)
    serialized = serialize_percolate_query_for_update(percolate_query)
    api.upsert_document(
        percolate_id,
        serialized,
        PERCOLATE_INDEX_TYPE,
        retry_on_conflict=settings.INDEXING_ERROR_RETRIES,
    )


@app.task(rate_limit=settings.CELERY_SEARCH_RATE_LIMIT)
def deindex_document(doc_id, object_type, **kwargs):
    """Task that makes a request to remove an ES document"""
    return api.deindex_document(doc_id, object_type, **kwargs)


@app.task(**PARTIAL_UPDATE_TASK_SETTINGS)
def upsert_learning_resource(learning_resource_id):
    """Upsert learning resource based on stored database information"""
    resource_obj = LearningResource.objects.for_search_serialization().get(
        id=learning_resource_id
    )

    resource_data = serialize_learning_resource_for_update(resource_obj)
    api.upsert_document(
        learning_resource_id,
        resource_data,
        resource_obj.resource_type,
        retry_on_conflict=settings.INDEXING_ERROR_RETRIES,
    )


def _infer_percolate_group(percolate_query):
    """
    Infer the heading name for the percolate query to be
    grouped under in the email
    """
    if percolate_query.source_label() != "saved_search":
        return percolate_query.source_description()
    group_keys = ["department", "topic", "offered_by"]
    original_query = OrderedDict(percolate_query.original_query)
    for key, val in original_query.items():
        if key in group_keys and val:
            if key == "department":
                return LearningResourceDepartment.objects.get(department_id=val[0]).name
            elif key == "offered_by":
                return LearningResourceOfferor.objects.get(code=val[0]).name
            return val[0]
    return percolate_query.original_url_params()


def _infer_percolate_group_url(percolate_query):
    """
    Infer the search URL for the percolate query
    """
    source_channel = percolate_query.source_channel()
    if source_channel:
        return frontend_absolute_url(source_channel.channel_url)
    original_query = OrderedDict(percolate_query.original_query)
    query_string_params = {k: v for k, v in original_query.items() if v}
    if "endpoint" in query_string_params:
        query_string_params.pop("endpoint")
    if "sortby" not in query_string_params:
        query_string_params["sortby"] = "new"
    query_string = urlencode(query_string_params, doseq=True)
    return frontend_absolute_url(f"/search?{query_string}")


def _group_percolated_rows(rows):
    def key_func(x):
        return (x["user_id"], x["group"])

    grouped_data = {}
    for key, group in itertools.groupby(rows, key_func):
        context = list(group)
        user_id = key[0]
        group_name = key[1]
        if key[0] not in grouped_data:
            grouped_data[user_id] = {group_name: []}
        if group_name not in grouped_data[user_id]:
            grouped_data[user_id][group_name] = []
        for ctx in context:
            if ctx["user_id"] == user_id:
                grouped_data[user_id][group_name].append(ctx)
    return grouped_data


def _image_url_is_reachable(url):
    """
    Check whether an image URL responds successfully.

    Uses a short timeout: this runs while building a digest email, so a slow
    or hanging image host should not hold up the send.
    """
    try:
        response = requests.head(
            url, timeout=IMAGE_CHECK_TIMEOUT_SECONDS, allow_redirects=True
        )
        if response.status_code in (
            HTTPStatus.METHOD_NOT_ALLOWED,
            HTTPStatus.NOT_IMPLEMENTED,
        ):
            # some servers reject HEAD; retry without downloading the body
            response = requests.get(
                url, timeout=IMAGE_CHECK_TIMEOUT_SECONDS, stream=True
            )
            response.close()
    except requests.RequestException:
        return False
    return HTTPStatus.OK <= response.status_code < HTTPStatus.MULTIPLE_CHOICES


def _validated_resource_image_url(resource):
    """
    Return the resource's image URL if it is reachable, otherwise the default
    resource image. Email clients can't fall back on their own, so a dead URL
    would render as a broken image icon.
    """
    if (
        resource.image
        and resource.image.url
        and _image_url_is_reachable(resource.image.url)
    ):
        return resource.image.url
    return frontend_absolute_url("/images/default_resource.jpg")


def _get_percolated_rows(resources, subscription_type):
    """
    Get percolated rows for a list of learning resources and subscription type
    """
    rows = []
    all_users = set()
    # percolate each new learning resource to get matching queries
    for resource in resources:
        percolated = percolate_matches_for_document(resource.id).filter(
            source_type=subscription_type
        )
        if percolated.count() > 0:
            resource_image_url = _validated_resource_image_url(resource)
            percolated_users = set(percolated.values_list("users", flat=True))
            all_users.update(percolated_users)
            for user in percolated_users:
                if not user:
                    continue
                user_instance = User.objects.get(id=user)
                user_queries = user_instance.percolate_queries.values_list(
                    "id", flat=True
                )
                query = percolated.filter(id__in=user_queries).order_by("?").first()
                search_url = _infer_percolate_group_url(query)
                req = PreparedRequest()
                req.prepare_url(search_url, {"resource": resource.id})
                resource_url = req.url
                source_channel = query.source_channel()
                rows.append(
                    {
                        "resource_url": resource_url,
                        "resource_title": resource.title,
                        "resource_image_url": resource_image_url,
                        "resource_type": LearningResourceType[
                            resource.resource_type
                        ].value,
                        "user_id": user,
                        "source_label": query.source_label(),
                        "source_channel_type": source_channel.channel_type
                        if source_channel
                        else "saved_search",
                        "group": _infer_percolate_group(query),
                        "search_url": search_url,
                    }
                )
    return rows


@app.task(bind=True)
def send_subscription_emails(self, subscription_type, period="daily"):
    """
    Send subscription emails by percolating matched documents
    """
    log.info("Sending %s subscription emails for %s", period, subscription_type)
    delta = datetime.timedelta(days=1)
    if period == "weekly":
        delta = datetime.timedelta(days=7)
    since = now_in_utc() - delta
    new_learning_resources = LearningResource.objects.filter(
        published=True, created_on__gt=since
    )
    rows = _get_percolated_rows(new_learning_resources, subscription_type)
    template_data = _group_percolated_rows(rows)
    email_tasks = celery.group(
        [
            attempt_send_digest_email_batch.si(user_template_items)
            for user_template_items in chunks(
                template_data.items(),
                chunk_size=settings.NOTIFICATION_ATTEMPT_CHUNK_SIZE,
            )
        ]
    )
    return self.replace(email_tasks)


@app.task(
    acks_late=True,
    reject_on_worker_lost=True,
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def index_learning_resources(ids, index_name, index_types):
    """
    Index courses

    Args:
        ids(list of int): List of course id's
        index_name (string): resource_type value or HYBRID_COMBINED_INDEX
        index_types (string): one of the values IndexestoUpdate. Whether the default
            index, the reindexing index or both need to be updated

    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            api.index_learning_resources(ids, index_name, index_types)
    except (RetryError, Ignore):
        raise
    except SystemExit as err:
        raise RetryError(SystemExit.__name__) from err
    except:  # noqa: E722
        error = "index_courses threw an error"
        log.exception(error)
        return error


@app.task(
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def percolate_learning_resource(resource_id):
    """
    Task that percolates a document following an index operation
    """
    log.info("percolating document %s", resource_id)
    percolate_matches_for_document(resource_id)


@app.task(
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def bulk_deindex_learning_resources(ids, resource_type):
    """
    Deindex learning resourse by a list of ids

    Args:
        ids(list of int): List of learning resource ids
        resource_type: the resource type

    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            api.deindex_learning_resources(ids, resource_type)
    except (RetryError, Ignore):
        raise
    except:  # noqa: E722
        error = "bulk_deindex_learning_resources threw an error"
        log.exception(error)
        return error


@app.task(
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def bulk_deindex_percolators(ids):
    """
    Deindex percolators by a list of ids

    Args:
        ids(list of int): List of percolator ids

    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            api.deindex_percolators(ids)
    except (RetryError, Ignore):
        raise
    except:  # noqa: E722
        error = "bulk_deindex_percolators threw an error"
        log.exception(error)
        return error


@app.task(
    acks_late=True,
    reject_on_worker_lost=True,
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def bulk_index_percolate_queries(percolate_ids, index_types):
    """
    Bulk index percolate queries for provided percolate query Ids

    Args:
        percolate_ids (list of int): List of percolator ids
        index_types (string): one of the values IndexestoUpdate. Whether the default
            index, the reindexing index or both need to be updated
    """
    try:
        percolates = PercolateQuery.objects.filter(id__in=percolate_ids)
        log.info("Indexing %d percolator queries...", percolates.count())
        api.index_items(
            serialize_bulk_percolators(percolate_ids),
            PERCOLATE_INDEX_TYPE,
            index_types,
        )
    except (RetryError, Ignore):
        raise
    except SystemExit as err:
        raise RetryError(SystemExit.__name__) from err
    except:  # noqa: E722
        error = "bulk_index_percolate_queries threw an error"
        log.exception(error)
        return error


@app.task(
    acks_late=True,
    reject_on_worker_lost=True,
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def index_content_files(
    content_file_ids,
    learning_resource_id,
    index_types=IndexestoUpdate.all_indexes.value,
    resource_type=COURSE_TYPE,
):
    """
    Index a list of content files

    Args:
        content_file_ids(array of int): List of content file ids
        learning_resource_id(int): Learning resource id of the content files
        index_types (string): one of the values IndexestoUpdate. Whether the default
            index, the reindexing index or both need to be updated
        resource_type (string): The resource type of the parent learning resource

    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            api.index_content_files(
                content_file_ids,
                learning_resource_id,
                index_types=index_types,
                resource_type=resource_type,
            )
    except (RetryError, Ignore):
        raise
    except SystemExit as err:
        raise RetryError(SystemExit.__name__) from err
    except:  # noqa: E722
        error = "index_content_files threw an error"
        log.exception(error)
        return error


@app.task(
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def deindex_content_files(
    content_file_ids, learning_resource_id, resource_type=COURSE_TYPE
):
    """
    Deindex a list of content files

    Args:
        content_file_ids(array of int): List of content file ids
        learning_resource_id(int): Learning resource id of the content files
        resource_type (string): The resource type of the parent learning resource

    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            api.deindex_content_files(
                content_file_ids, learning_resource_id, resource_type=resource_type
            )
    except (RetryError, Ignore):
        raise
    except:  # noqa: E722
        error = "deindex_content_files threw an error"
        log.exception(error)
        return error


@app.task(
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def index_run_content_files(run_id, index_types=IndexestoUpdate.all_indexes.value):
    """
    Index content files for a LearningResourceRun

    Args:
        run_id(int): LearningResourceRun id
        index_types (string): one of the values IndexestoUpdate. Whether the default
            index, the reindexing index or both need to be updated

    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            api.index_run_content_files(run_id, index_types=index_types)
            api.deindex_run_content_files(run_id, unpublished_only=True)
    except (RetryError, Ignore):
        raise
    except:  # noqa: E722
        error = "index_run_content_files threw an error"
        log.exception(error)
        return error


@app.task(
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def deindex_run_content_files(run_id, unpublished_only, keep_published=False):  # noqa: FBT002
    """
    Deindex content files for a LearningResourceRun

    Args:
        run_id(int): LearningResourceRun id
        unpublished_only(bool): Whether to only deindex unpublished content files
        keep_published(bool): Whether to remove from OpenSearch without flipping
            ContentFile.published
    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            api.deindex_run_content_files(
                run_id,
                unpublished_only=unpublished_only,
                keep_published=keep_published,
            )
    except (RetryError, Ignore):
        raise
    except:  # noqa: E722
        error = "deindex_run_content_files threw an error"
        log.exception(error)
        return error


@contextmanager
def wrap_retry_exception(*exception_classes):
    """
    Wrap exceptions with RetryError so Celery can use it for autoretry

    Args:
        *exception_classes (tuple of type): Exception classes which should become
            RetryError
    """
    try:
        yield
    except Exception as ex:
        # Celery is confused by exceptions which don't take a string as an argument,
        # so we need to wrap before raising
        if isinstance(ex, exception_classes):
            raise RetryError(str(ex)) from ex
        raise


def _build_reindex_batches(job):  # noqa: C901, PLR0912
    """
    Build the TaskBatch rows for a reindex job using fast id-only queries.

    Content files are not enumerated here; dispatch batches defer the slow
    per-resource ContentFile queries to run_reindex_batch workers.

    Args:
        job (TaskJob): the reindex job

    Returns:
        list of TaskBatch: unsaved batch rows
    """
    indexes = job.params["indexes"]
    batches = []

    def add_batch(kind, batch_key, params):
        batches.append(
            TaskBatch(job=job, kind=kind.value, batch_key=batch_key, params=params)
        )

    if PERCOLATE_INDEX_TYPE in indexes:
        for chunk, ids in enumerate(
            chunks(
                PercolateQuery.objects.order_by("id").values_list("id", flat=True),
                chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
            )
        ):
            add_batch(ReindexBatchKind.percolate, f"percolate:{chunk}", {"ids": ids})

    if COURSE_TYPE in indexes or HYBRID_COMBINED_INDEX in indexes:
        blocklisted_ids = load_course_blocklist()

    if COURSE_TYPE in indexes:
        for chunk, ids in enumerate(
            chunks(
                Course.objects.filter(learning_resource__published=True)
                .exclude(learning_resource__readable_id__in=blocklisted_ids)
                .order_by("learning_resource_id")
                .values_list("learning_resource_id", flat=True),
                chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
            )
        ):
            add_batch(
                ReindexBatchKind.learning_resources,
                f"{COURSE_TYPE}:resources:{chunk}",
                {"ids": ids, "index_name": COURSE_TYPE},
            )

        for chunk, resource_ids in enumerate(
            chunks(
                Course.objects.filter(learning_resource__published=True)
                .filter(learning_resource__etl_source__in=RESOURCE_FILE_ETL_SOURCES)
                .exclude(learning_resource__readable_id__in=blocklisted_ids)
                .order_by("learning_resource_id")
                .values_list("learning_resource_id", flat=True),
                chunk_size=settings.OPENSEARCH_REINDEX_DISPATCH_CHUNK_SIZE,
            )
        ):
            add_batch(
                ReindexBatchKind.dispatch_content_files,
                f"dispatch:{COURSE_TYPE}:{chunk}",
                {
                    "learning_resource_ids": resource_ids,
                    "resource_type": COURSE_TYPE,
                },
            )

    if HYBRID_COMBINED_INDEX in indexes:
        for chunk, ids in enumerate(
            chunks(
                LearningResource.objects.filter(published=True)
                .exclude(readable_id__in=blocklisted_ids)
                .order_by("id")
                .values_list("id", flat=True),
                chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
            )
        ):
            add_batch(
                ReindexBatchKind.learning_resources,
                f"{HYBRID_COMBINED_INDEX}:resources:{chunk}",
                {"ids": ids, "index_name": HYBRID_COMBINED_INDEX},
            )

    for resource_type in set(LEARNING_RESOURCE_TYPES) - {COURSE_TYPE}:
        if resource_type in indexes:
            for chunk, ids in enumerate(
                chunks(
                    LearningResource.objects.filter(
                        published=True,
                        resource_type=resource_type,
                    )
                    .order_by("id")
                    .values_list("id", flat=True),
                    chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
                )
            ):
                add_batch(
                    ReindexBatchKind.learning_resources,
                    f"{resource_type}:resources:{chunk}",
                    {"ids": ids, "index_name": resource_type},
                )

    if PROGRAM_TYPE in indexes:
        for chunk, resource_ids in enumerate(
            chunks(
                LearningResource.objects.filter(
                    published=True, resource_type=PROGRAM_TYPE
                )
                .order_by("id")
                .values_list("id", flat=True),
                chunk_size=settings.OPENSEARCH_REINDEX_DISPATCH_CHUNK_SIZE,
            )
        ):
            add_batch(
                ReindexBatchKind.dispatch_content_files,
                f"dispatch:{PROGRAM_TYPE}:{chunk}",
                {
                    "learning_resource_ids": resource_ids,
                    "resource_type": PROGRAM_TYPE,
                },
            )

    return batches


def _dispatch_content_file_batches(batch):
    """
    Create and enqueue the content file batches for a dispatch batch.

    Child rows are created (idempotently, via the unique batch_key) before the
    dispatch batch itself is marked complete, so the job can never appear
    finished while content file fan-out is still pending.

    Args:
        batch (TaskBatch): a dispatch_content_files batch
    """
    resource_type = batch.params["resource_type"]
    children = []
    for resource_id in batch.params["learning_resource_ids"]:
        for chunk, ids in enumerate(
            chunks(
                ContentFile.objects.filter(
                    run__learning_resource_id=resource_id,
                    published=True,
                    run__published=True,
                )
                .order_by("id")
                .values_list("id", flat=True),
                chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
            )
        ):
            children.append(
                TaskBatch(
                    job=batch.job,
                    kind=ReindexBatchKind.content_files.value,
                    batch_key=f"content_files:{resource_id}:run:{chunk}",
                    params={
                        "ids": ids,
                        "learning_resource_id": resource_id,
                        "resource_type": resource_type,
                    },
                )
            )
        for chunk, ids in enumerate(
            chunks(
                ContentFile.objects.filter(
                    learning_resource_id=resource_id,
                    published=True,
                )
                .order_by("id")
                .values_list("id", flat=True),
                chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
            )
        ):
            children.append(
                TaskBatch(
                    job=batch.job,
                    kind=ReindexBatchKind.content_files.value,
                    batch_key=f"content_files:{resource_id}:direct:{chunk}",
                    params={
                        "ids": ids,
                        "learning_resource_id": resource_id,
                        "resource_type": resource_type,
                    },
                )
            )
    TaskBatch.objects.bulk_create(children, ignore_conflicts=True)
    child_ids = batch.job.batches.filter(
        batch_key__in=[child.batch_key for child in children],
        status=TaskBatch.Status.QUEUED,
    ).values_list("id", flat=True)
    for child_id in child_ids:
        run_reindex_batch.delay(child_id)


def _execute_reindex_batch(batch):
    """
    Run the indexing work for a single reindex batch

    Args:
        batch (TaskBatch): the batch to execute
    """
    params = batch.params
    if batch.kind == ReindexBatchKind.learning_resources.value:
        api.index_learning_resources(
            params["ids"],
            params["index_name"],
            IndexestoUpdate.reindexing_index.value,
        )
    elif batch.kind == ReindexBatchKind.content_files.value:
        api.index_content_files(
            params["ids"],
            params["learning_resource_id"],
            index_types=IndexestoUpdate.reindexing_index.value,
            resource_type=params["resource_type"],
        )
    elif batch.kind == ReindexBatchKind.percolate.value:
        api.index_items(
            serialize_bulk_percolators(params["ids"]),
            PERCOLATE_INDEX_TYPE,
            IndexestoUpdate.reindexing_index.value,
        )
    elif batch.kind == ReindexBatchKind.dispatch_content_files.value:
        _dispatch_content_file_batches(batch)


def _maybe_finish_reindex_job(job_id):
    """
    Claim and enqueue finish_reindex_job if every batch of the job is done

    Args:
        job_id (int): TaskJob id
    """
    maybe_finish_task_job(job_id, finish_reindex_job)


class _RunReindexBatchTask(app.Task):
    """
    Base task that fails the batch if run_reindex_batch gives up.

    When autoretries are exhausted the task raises without having marked the
    batch terminal, which would leave it RUNNING and hang the job. on_failure
    fires once, on the final give-up, so we mark the batch FAILED and nudge
    completion. (A worker killed mid-run does not trigger this — that message
    is redelivered by acks_late instead.)
    """

    def on_failure(self, exc, task_id, args, kwargs, einfo):  # noqa: ARG002
        batch_id = args[0] if args else kwargs.get("batch_id")
        batch = TaskBatch.objects.filter(id=batch_id).first()
        if batch is None:
            return
        TaskBatch.objects.filter(
            id=batch_id, status__in=TaskBatch.NON_TERMINAL_STATUSES
        ).update(
            status=TaskBatch.Status.FAILED,
            error=f"run_reindex_batch gave up: {exc}",
        )
        _maybe_finish_reindex_job(batch.job_id)


@app.task(
    base=_RunReindexBatchTask,
    acks_late=True,
    reject_on_worker_lost=True,
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def run_reindex_batch(batch_id):
    """
    Execute one reindex batch and record its completion in the database

    Args:
        batch_id (int): TaskBatch id
    """
    batch = TaskBatch.objects.select_related("job").get(id=batch_id)
    if (
        batch.status not in TaskBatch.NON_TERMINAL_STATUSES
        or batch.job.status not in TaskJob.ACTIVE_STATUSES
    ):
        log.info(
            "Skipping reindex batch %s (batch status=%s, job status=%s)",
            batch.batch_key,
            batch.status,
            batch.job.status,
        )
        # a redelivery of an already-finished batch still nudges completion, so
        # the job can't hang if the last batch's worker was culled right after
        # committing its status but before the finish step was enqueued
        _maybe_finish_reindex_job(batch.job_id)
        return
    # mark the batch running; a redelivered message may find the batch already
    # running, which is fine — execution is idempotent
    TaskBatch.objects.filter(
        id=batch_id, status__in=TaskBatch.NON_TERMINAL_STATUSES
    ).update(status=TaskBatch.Status.RUNNING)
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            _execute_reindex_batch(batch)
    except (RetryError, Ignore):
        raise
    except SystemExit as err:
        raise RetryError(SystemExit.__name__) from err
    except Exception as ex:
        error = f"run_reindex_batch threw an error: {type(ex).__name__}: {ex}"
        log.exception("Reindex batch %s failed", batch.batch_key)
        TaskBatch.objects.filter(
            id=batch_id, status__in=TaskBatch.NON_TERMINAL_STATUSES
        ).update(status=TaskBatch.Status.FAILED, error=error)
    else:
        TaskBatch.objects.filter(
            id=batch_id, status__in=TaskBatch.NON_TERMINAL_STATUSES
        ).update(status=TaskBatch.Status.SUCCEEDED)
    _maybe_finish_reindex_job(batch.job_id)


@app.task(acks_late=True, reject_on_worker_lost=True)
def start_recreate_index(job_id):
    """
    Create backing indexes for a reindex job and fan out indexing batches.

    All indexing writes go only to the new (reindexing) backing indexes;
    search keeps using the current default indexes until finish_reindex_job
    switches the aliases after every batch has succeeded.

    Args:
        job_id (int): TaskJob id
    """
    job = TaskJob.objects.get(id=job_id)
    # QUEUED: fresh job, do one-time setup. RUNNING: a redelivery (the worker
    # died partway through the enqueue loop) — skip setup and just re-enqueue
    # whatever batches are still waiting. Anything else is already done.
    if job.status not in (TaskJob.Status.QUEUED, TaskJob.Status.RUNNING):
        log.info("Reindex job %s not startable (status=%s)", job_id, job.status)
        return
    indexes = job.params["indexes"]
    restart = job.params.get("restart", False)

    if job.status == TaskJob.Status.QUEUED:
        try:
            error = None
            if not restart:
                existing_reindexing_indexes = api.get_existing_reindexing_indexes(
                    indexes
                )
                if existing_reindexing_indexes:
                    error = (
                        f"Reindexing in progress. Reindexing indexes already exist: "
                        f"{', '.join(existing_reindexing_indexes)}"
                    )
                else:
                    other_active_jobs = [
                        other_job
                        for other_job in TaskJob.objects.filter(
                            task_name=REINDEX_TASK_NAME,
                            status__in=TaskJob.ACTIVE_STATUSES,
                        ).exclude(id=job_id)
                        if set(other_job.params.get("indexes", [])) & set(indexes)
                    ]
                    if other_active_jobs:
                        error = (
                            f"Reindexing in progress. Active reindex jobs already"
                            f" exist: "
                            f"{', '.join(str(other.id) for other in other_active_jobs)}"
                        )
            if error:
                log.error(error)
                TaskJob.objects.filter(id=job_id).update(
                    status=TaskJob.Status.FAILED, error=error
                )
                return

            api.delete_orphaned_indexes(indexes, delete_reindexing_tags=restart)

            job.params["backing_indexes"] = {
                obj_type: api.create_backing_index(obj_type) for obj_type in indexes
            }
            job.save()

            log.info("starting to index %s objects...", ", ".join(indexes))

            TaskBatch.objects.bulk_create(
                _build_reindex_batches(job), ignore_conflicts=True
            )
            # flip to RUNNING before enqueuing so a redelivery after this point
            # resumes the enqueue loop rather than redoing setup
            TaskJob.objects.filter(id=job_id, status=TaskJob.Status.QUEUED).update(
                status=TaskJob.Status.RUNNING
            )
        except Exception:
            error = "start_recreate_index threw an error"
            log.exception(error)
            TaskJob.objects.filter(id=job_id).update(
                status=TaskJob.Status.FAILED, error=error
            )
            try:
                api.delete_orphaned_indexes(indexes, delete_reindexing_tags=True)
            except Exception:
                log.exception(
                    "Failed to clean up reindexing indexes for job %s", job_id
                )
            return

    # (re)enqueue every batch still waiting; idempotent under redelivery, so a
    # worker death mid-loop can't strand batches in QUEUED
    for batch_id in job.batches.filter(status=TaskBatch.Status.QUEUED).values_list(
        "id", flat=True
    ):
        run_reindex_batch.delay(batch_id)
    # handles the edge case of a job with no batches at all
    _maybe_finish_reindex_job(job_id)


@app.task(
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def finish_update_index(results):  # noqa: ARG001
    """
    Clear cached views after update index tasks complete.
    """
    log.info("update_index has finished successfully!")
    clear_views_cache()


@app.task(bind=True)
def start_update_index(self, indexes, etl_source):
    """
    Wipe and recreate index and mapping, and index all items.
    """
    try:
        log.info("starting to UPDATE index %s objects...", ", ".join(indexes))

        index_tasks = []

        if COURSE_TYPE in indexes or CONTENT_FILE_TYPE in indexes:
            blocklisted_ids = load_course_blocklist()

        if COURSE_TYPE in indexes:
            index_tasks = index_tasks + get_update_courses_tasks(
                blocklisted_ids, etl_source
            )

        if CONTENT_FILE_TYPE in indexes:
            index_tasks = index_tasks + get_update_resource_files_tasks(
                blocklisted_ids, etl_source
            )

        if PROGRAM_TYPE in indexes or CONTENT_FILE_TYPE in indexes:
            index_tasks = index_tasks + get_update_program_files_tasks(etl_source)
        if PERCOLATE_INDEX_TYPE in indexes:
            index_tasks = index_tasks + get_update_percolator_tasks()

        for resource_type in set(LEARNING_RESOURCE_TYPES) - {COURSE_TYPE}:
            if resource_type in indexes:
                index_tasks = index_tasks + get_update_learning_resource_tasks(
                    resource_type
                )

        index_tasks = celery.group(index_tasks)
    except:  # noqa: E722
        error = "start_update_index threw an error"
        log.exception(error)
        return [error]
    return self.replace(celery.chain(index_tasks, finish_update_index.s()))


def get_update_resource_files_tasks(blocklisted_ids, etl_source):
    """
    Get list of tasks to update course files.
    This task upserts content files for courses that are published and delists content
    files that are not published but are part of a published course.

    Args:
        blocklisted_ids(list of int): List of course id's to exclude
        etl_source(str): ETL source filter for the task
    """

    if etl_source is None or etl_source in RESOURCE_FILE_ETL_SOURCES:
        course_update_query = (
            LearningResource.objects.filter(published=True, resource_type=COURSE_TYPE)
            .exclude(readable_id__in=blocklisted_ids)
            .order_by("id")
        )

        if etl_source:
            course_update_query = course_update_query.filter(etl_source=etl_source)
        else:
            course_update_query = course_update_query.filter(
                etl_source__in=RESOURCE_FILE_ETL_SOURCES
            )

        index_tasks = []

        for learning_resource in course_update_query.order_by("id"):
            index_tasks = (
                index_tasks
                + [
                    index_content_files.si(
                        ids,
                        learning_resource.id,
                        index_types=IndexestoUpdate.current_index.value,
                    )
                    for ids in chunks(
                        ContentFile.objects.filter(
                            run__learning_resource_id=learning_resource.id,
                            published=True,
                            run__published=True,
                        )
                        .order_by("id")
                        .values_list("id", flat=True),
                        chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
                    )
                ]
                + [
                    index_content_files.si(
                        ids,
                        learning_resource.id,
                        index_types=IndexestoUpdate.current_index.value,
                    )
                    for ids in chunks(
                        ContentFile.objects.filter(
                            learning_resource_id=learning_resource.id,
                            published=True,
                        )
                        .order_by("id")
                        .values_list("id", flat=True),
                        chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
                    )
                ]
            )

            index_tasks = (
                index_tasks
                + [
                    deindex_content_files.si(ids, learning_resource.id)
                    for ids in chunks(
                        ContentFile.objects.filter(
                            run__learning_resource_id=learning_resource.id
                        )
                        .filter(Q(published=False) | Q(run__published=False))
                        .order_by("id")
                        .values_list("id", flat=True),
                        chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
                    )
                ]
                + [
                    deindex_content_files.si(ids, learning_resource.id)
                    for ids in chunks(
                        ContentFile.objects.filter(
                            learning_resource_id=learning_resource.id,
                            published=False,
                        )
                        .order_by("id")
                        .values_list("id", flat=True),
                        chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
                    )
                ]
            )

        return index_tasks
    else:
        return []


def get_update_program_files_tasks(etl_source):
    """
    Get list of tasks to update program content files.

    Args:
        etl_source(str): ETL source filter for the task
    """
    if etl_source is not None and etl_source not in RESOURCE_FILE_ETL_SOURCES:
        return []

    program_update_query = LearningResource.objects.filter(
        published=True, resource_type=PROGRAM_TYPE
    ).order_by("id")

    if etl_source:
        program_update_query = program_update_query.filter(etl_source=etl_source)
    else:
        program_update_query = program_update_query.filter(
            etl_source__in=RESOURCE_FILE_ETL_SOURCES
        )

    index_tasks = []

    for learning_resource in program_update_query:
        index_tasks = (
            index_tasks
            + [
                index_content_files.si(
                    ids,
                    learning_resource.id,
                    index_types=IndexestoUpdate.current_index.value,
                    resource_type=PROGRAM_TYPE,
                )
                for ids in chunks(
                    ContentFile.objects.filter(
                        run__learning_resource_id=learning_resource.id,
                        published=True,
                        run__published=True,
                    )
                    .order_by("id")
                    .values_list("id", flat=True),
                    chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
                )
            ]
            + [
                index_content_files.si(
                    ids,
                    learning_resource.id,
                    index_types=IndexestoUpdate.current_index.value,
                    resource_type=PROGRAM_TYPE,
                )
                for ids in chunks(
                    ContentFile.objects.filter(
                        learning_resource_id=learning_resource.id,
                        published=True,
                    )
                    .order_by("id")
                    .values_list("id", flat=True),
                    chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
                )
            ]
        )

        index_tasks = (
            index_tasks
            + [
                deindex_content_files.si(
                    ids, learning_resource.id, resource_type=PROGRAM_TYPE
                )
                for ids in chunks(
                    ContentFile.objects.filter(
                        run__learning_resource_id=learning_resource.id
                    )
                    .filter(Q(published=False) | Q(run__published=False))
                    .order_by("id")
                    .values_list("id", flat=True),
                    chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
                )
            ]
            + [
                deindex_content_files.si(
                    ids, learning_resource.id, resource_type=PROGRAM_TYPE
                )
                for ids in chunks(
                    ContentFile.objects.filter(
                        learning_resource_id=learning_resource.id,
                        published=False,
                    )
                    .order_by("id")
                    .values_list("id", flat=True),
                    chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
                )
            ]
        )

    return index_tasks


def get_update_courses_tasks(blocklisted_ids, etl_source):
    """
    Get list of tasks to update courses
    Args:
        blocklisted_ids(list of int): List of course id's to exclude
        etl_source(str): Etl source filter for the task
    """

    course_update_query = (
        LearningResource.objects.filter(published=True, resource_type=COURSE_TYPE)
        .exclude(readable_id__in=blocklisted_ids)
        .order_by("id")
    )

    course_deletion_query = (
        LearningResource.objects.filter(resource_type=COURSE_TYPE)
        .filter(Q(published=False) | Q(readable_id__in=blocklisted_ids))
        .order_by("id")
    )

    if etl_source:
        course_update_query = course_update_query.filter(etl_source=etl_source)
        course_deletion_query = course_deletion_query.filter(etl_source=etl_source)

    index_tasks = [
        index_learning_resources.si(
            ids, COURSE_TYPE, index_types=IndexestoUpdate.current_index.value
        )
        for ids in chunks(
            course_update_query.values_list("id", flat=True),
            chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
        )
    ]

    return index_tasks + [
        bulk_deindex_learning_resources.si(ids, COURSE_TYPE)
        for ids in chunks(
            course_deletion_query.values_list("id", flat=True),
            chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
        )
    ]


def get_update_percolator_tasks():
    """
    Get list of tasks to update percolators
    """
    index_tasks = [
        bulk_index_percolate_queries.si(
            percolate_ids, index_types=IndexestoUpdate.current_index.value
        )
        for percolate_ids in chunks(
            PercolateQuery.objects.order_by("id").values_list("id", flat=True),
            chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
        )
    ]

    return index_tasks + [
        bulk_deindex_percolators.si(ids)
        for ids in chunks(
            PercolateQuery.objects.all().order_by("id").values_list("id", flat=True),
            chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
        )
    ]


def get_update_learning_resource_tasks(resource_type):
    """
    Get list of tasks to update non-course learning resources
    """
    index_tasks = [
        index_learning_resources.si(
            ids, resource_type, index_types=IndexestoUpdate.current_index.value
        )
        for ids in chunks(
            LearningResource.objects.filter(
                published=True,
                resource_type=resource_type,
            )
            .order_by("id")
            .values_list("id", flat=True),
            chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
        )
    ]

    return index_tasks + [
        bulk_deindex_learning_resources.si(ids, resource_type)
        for ids in chunks(
            LearningResource.objects.filter(
                published=False,
                resource_type=resource_type,
            )
            .order_by("id")
            .values_list("id", flat=True),
            chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
        )
    ]


class _FinishReindexJobTask(app.Task):
    """
    Base task that fails the job if finish_reindex_job gives up.

    If the alias switch keeps erroring until autoretries are exhausted, the job
    would otherwise hang in FINISHING. on_failure marks it FAILED so it doesn't
    stay active forever; the old index keeps serving and an operator can re-run.
    """

    def on_failure(self, exc, task_id, args, kwargs, einfo):  # noqa: ARG002
        job_id = args[0] if args else kwargs.get("job_id")
        TaskJob.objects.filter(id=job_id, status=TaskJob.Status.FINISHING).update(
            status=TaskJob.Status.FAILED,
            error=f"finish_reindex_job gave up: {exc}",
        )


@app.task(
    base=_FinishReindexJobTask,
    acks_late=True,
    reject_on_worker_lost=True,
    autoretry_for=(RetryError, SystemExit),
    retry_backoff=True,
    rate_limit=settings.CELERY_SEARCH_RATE_LIMIT,
)
def finish_reindex_job(job_id):
    """
    Swap the reindex backing indexes with the default backing indexes once
    every batch of the job has succeeded, or clean up if any batch failed.

    Safe to re-run: already-switched object types are skipped, so a redelivery
    can never delete the newly promoted backing index.

    Args:
        job_id (int): TaskJob id
    """
    job = TaskJob.objects.get(id=job_id)
    if job.status != TaskJob.Status.FINISHING:
        log.info("Skipping finish for reindex job %s (status=%s)", job_id, job.status)
        return

    backing_indexes = job.params.get("backing_indexes", {})
    errors = [
        f"{batch_key}: {error}"
        for batch_key, error in job.batches.filter(
            status=TaskBatch.Status.FAILED
        ).values_list("batch_key", "error")
    ]
    if errors:
        try:
            api.delete_orphaned_indexes(
                list(backing_indexes.keys()), delete_reindexing_tags=True
            )
        except RequestError as ex:
            raise RetryError(str(ex)) from ex
        msg = f"Errors occurred during recreate_index: {errors}"
        TaskJob.objects.filter(id=job_id, status=TaskJob.Status.FINISHING).update(
            status=TaskJob.Status.FAILED, error=msg
        )
        raise ReindexError(msg)

    log.info(
        "Done with temporary index. Pointing default aliases to newly created backing indexes..."  # noqa: E501
    )
    for obj_type, backing_index in backing_indexes.items():
        try:
            if api.is_default_backing_index(backing_index, obj_type):
                # already switched by a previous delivery of this task
                continue
            api.switch_indices(backing_index, obj_type)
        except RequestError as ex:
            raise RetryError(str(ex)) from ex
    TaskJob.objects.filter(id=job_id, status=TaskJob.Status.FINISHING).update(
        status=TaskJob.Status.SUCCEEDED
    )
    log.info("recreate_index has finished successfully!")
    clear_views_cache()


def _generate_subscription_digest_subject(
    sample_course, source_name, unique_resource_types, total_count, shortform
):
    """
    Generate the subject line and/or content header for subscription emails
    Args:
        sample_course (a learning resource): A sample resource to reference
        source_name (string): the subscription type (saved_search etc)
        unique_resource_types (list): set of unique resource types in the email
        total_count (int): total number of resources in the email
        shortform (bool): if False return the (longer) email subject
                          otherwise short content header

    """
    prefix = "" if shortform else "MIT Learn: "
    if len(unique_resource_types) == 1:
        resource_type = unique_resource_types.pop()
    else:
        resource_type = "Learning Resource"

    if sample_course["source_channel_type"] == "saved_search":
        if shortform:
            return f"New {resource_type}{pluralize(total_count)} from MIT Learn"
        return (
            f"{prefix}New"
            f" {resource_type}{pluralize(total_count)}: "
            f"{sample_course['resource_title']}"
        )
    preposition = "from"
    if sample_course["source_channel_type"] == "topic":
        preposition = "in"

    suffix = "" if shortform else f": {sample_course['resource_title']}"
    return (
        f"{prefix}New"
        f" {resource_type}{pluralize(total_count)} "
        f"{preposition} {source_name}{suffix}"
    )


@app.task(
    acks_late=True,
    reject_on_worker_lost=True,
    rate_limit=settings.NOTIFICATION_ATTEMPT_RATE_LIMIT,
)
def attempt_send_digest_email_batch(user_template_items):
    """Send a batch of digest emails for grouped per-user template payloads."""
    for user_id, template_data in user_template_items:
        log.info("Sending email to user %s", user_id)
        if not user_id:
            continue
        user = User.objects.get(id=user_id)

        for group in template_data:
            unique_resource_types = set()
            total_count = len(template_data[group])
            unique_resource_types.update(
                [resource["resource_type"] for resource in template_data[group]]
            )
            subject = _generate_subscription_digest_subject(
                template_data[group][0],
                group,
                list(unique_resource_types),
                total_count,
                shortform=False,
            )
            # generate a shorter subject for use in the template
            short_subject = _generate_subscription_digest_subject(
                template_data[group][0],
                group,
                list(unique_resource_types),
                total_count,
                shortform=True,
            )
            send_template_email(
                user,
                subject,
                "email/subscribed_channel_digest.html",
                context={
                    "documents": template_data[group],
                    "total_count": total_count,
                    "subject": subject,
                    "resource_group": group,
                    "short_subject": short_subject,
                },
                is_transactional=False,
            )
