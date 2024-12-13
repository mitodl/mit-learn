import datetime
import logging

import celery
from celery.exceptions import Ignore
from django.conf import settings

from learning_resources.etl.constants import RESOURCE_FILE_ETL_SOURCES
from learning_resources.models import (
    ContentFile,
    Course,
    LearningResource,
)
from learning_resources.utils import load_course_blocklist
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
    COURSE_TYPE,
    LEARNING_PATH_TYPE,
    PODCAST_EPISODE_TYPE,
    PODCAST_TYPE,
    PROGRAM_TYPE,
    SEARCH_CONN_EXCEPTIONS,
    VIDEO_PLAYLIST_TYPE,
    VIDEO_TYPE,
)
from learning_resources_search.exceptions import RetryError
from learning_resources_search.tasks import wrap_retry_exception
from main.celery import app
from main.utils import (
    chunks,
    now_in_utc,
)
from vector_search.utils import embed_learning_resources, filter_existing_qdrant_points

log = logging.getLogger(__name__)


@app.task(
    acks_late=True,
    reject_on_worker_lost=True,
    autoretry_for=(RetryError,),
    retry_backoff=True,
    rate_limit="600/m",
)
def generate_embeddings(ids, resource_type):
    """
    Generate learning resource embeddings and index in Qdrant

    Args:
        ids(list of int): List of resource id's
        resource_type (string): resource_type value for the learning resource objects

    """
    try:
        with wrap_retry_exception(*SEARCH_CONN_EXCEPTIONS):
            embed_learning_resources(ids, resource_type)
    except (RetryError, Ignore):
        raise
    except SystemExit as err:
        raise RetryError(SystemExit.__name__) from err
    except:  # noqa: E722
        error = "generate_embeddings threw an error"
        log.exception(error)
        return error


@app.task(bind=True)
def start_embed_resources(self, indexes, skip_content_files):
    """
    Celery task to embed learning resources

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
                generate_embeddings.si(ids, COURSE_TYPE)
                for ids in chunks(
                    Course.objects.filter(learning_resource__published=True)
                    .exclude(learning_resource__readable_id=blocklisted_ids)
                    .order_by("learning_resource_id")
                    .values_list("learning_resource_id", flat=True),
                    chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
                )
            ]
            if not skip_content_files:
                for course in (
                    LearningResource.objects.filter(
                        resource_type=COURSE_TYPE, published=True
                    )
                    .filter(etl_source__in=RESOURCE_FILE_ETL_SOURCES)
                    .exclude(readable_id=blocklisted_ids)
                    .order_by("id")
                ):
                    index_tasks = index_tasks + [
                        generate_embeddings.si(
                            ids,
                            CONTENT_FILE_TYPE,
                        )
                        for ids in chunks(
                            ContentFile.objects.filter(
                                run__learning_resource_id=course.id,
                                published=True,
                                run__published=True,
                            )
                            .order_by("id")
                            .values_list("id", flat=True),
                            chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
                        )
                    ]
        for resource_type in [
            PROGRAM_TYPE,
            PODCAST_TYPE,
            PODCAST_EPISODE_TYPE,
            LEARNING_PATH_TYPE,
            VIDEO_TYPE,
            VIDEO_PLAYLIST_TYPE,
        ]:
            if resource_type in indexes:
                for ids in chunks(
                    LearningResource.objects.filter(
                        published=True, resource_type=resource_type
                    )
                    .order_by("id")
                    .values_list("id", flat=True),
                    chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
                ):
                    index_tasks.append(
                        generate_embeddings.si(
                            ids,
                            resource_type,
                        )
                    )
    except:  # noqa: E722
        error = "start_embed_resources threw an error"
        log.exception(error)
        return error

    # Use self.replace so that code waiting on this task will also wait on the embedding
    #  and finish tasks
    return self.replace(celery.chain(*index_tasks))


@app.task(bind=True)
def embed_learning_resources_by_id(self, ids, skip_content_files):
    """
    Celery task to embed learning resources

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
    resources = LearningResource.objects.filter(
        id__in=ids,
        published=True,
    )
    try:
        for resource_type in [
            COURSE_TYPE,
            PROGRAM_TYPE,
            PODCAST_TYPE,
            PODCAST_EPISODE_TYPE,
            LEARNING_PATH_TYPE,
            VIDEO_TYPE,
            VIDEO_PLAYLIST_TYPE,
        ]:
            resources = resources.filter(resource_type=resource_type)

            [
                index_tasks.append(
                    generate_embeddings.si(
                        chunk_ids,
                        resource_type,
                    )
                )
                for chunk_ids in chunks(
                    resources.order_by("id").values_list("id", flat=True),
                    chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
                )
            ]
            if not skip_content_files and resource_type == COURSE_TYPE:
                for course in resources.filter(
                    etl_source__in=RESOURCE_FILE_ETL_SOURCES
                ).order_by("id"):
                    index_tasks = index_tasks + [
                        generate_embeddings.si(
                            content_ids,
                            CONTENT_FILE_TYPE,
                        )
                        for content_ids in chunks(
                            ContentFile.objects.filter(
                                run__learning_resource_id=course.id,
                                published=True,
                                run__published=True,
                            )
                            .order_by("id")
                            .values_list("id", flat=True),
                            chunk_size=settings.OPENSEARCH_DOCUMENT_INDEXING_CHUNK_SIZE,
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
    Embed new resources from the last day
    """
    log.info("Running new resource embedding task")
    delta = datetime.timedelta(days=1)
    since = now_in_utc() - delta
    new_learning_resources = LearningResource.objects.filter(
        published=True,
        created_on__gt=since,
    ).exclude(resource_type=CONTENT_FILE_TYPE)
    filtered_resources = filter_existing_qdrant_points(new_learning_resources)
    embed_tasks = celery.group(
        [
            generate_embeddings.si(ids, COURSE_TYPE)
            for ids in chunks(
                filtered_resources.order_by("id").values_list("id", flat=True),
                chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
            )
        ]
    )
    return self.replace(embed_tasks)
