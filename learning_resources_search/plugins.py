"""Pluggy plugins for learning_resources_search"""

import logging

from celery import chain
from django.apps import apps

from learning_resources_search import tasks
from learning_resources_search.api import get_similar_topics
from learning_resources_search.constants import (
    COURSE_TYPE,
    PERCOLATE_INDEX_TYPE,
)
from main import settings
from main.utils import chunks

log = logging.getLogger()


def try_with_retry_as_task(function, *args):
    """
    Try running the task, if it errors, run it as a celery task.
    """
    try:
        function(*args)
    except Exception:  # noqa: BLE001
        function.delay(*args)


class SearchIndexPlugin:
    """Perform search index updates on learning resources"""

    hookimpl = apps.get_app_config("learning_resources").hookimpl

    @hookimpl
    def percolate_query_delete(self, percolate_query):
        try_with_retry_as_task(
            tasks.deindex_document,
            percolate_query.id,
            PERCOLATE_INDEX_TYPE,
        )

    @hookimpl
    def percolate_query_upserted(self, percolate_query):
        """
        Upsert a created/modified percolate_query to the search index

        Args:
            percolate_query(PercolateQuery): The Learning Resource that was upserted
        """
        try_with_retry_as_task(tasks.upsert_percolate_query, percolate_query.id)

    @hookimpl
    def document_percolated(self, resource, percolated_queries):
        """
        Call to signal when a document is percolated
        Args:
            resource(LearningResource): The Learning Resource that was percolated
            percolated_queries(PercolateQuery): list of percolated queries
        """
        log.debug("document %i percolated - %s", resource.id, list(percolated_queries))

    @hookimpl
    def resource_upserted(self, resource, percolate):
        """
        Upsert a created/modified resource to the search index

        Args:
            resource(LearningResource): The Learning Resource that was upserted
        """
        upsert_task = tasks.upsert_learning_resource
        if percolate:
            upsert_task = chain(
                tasks.upsert_learning_resource.si(resource.id),
                tasks.percolate_learning_resource.si(resource.id),
            )

        try_with_retry_as_task(upsert_task, resource.id)

    @hookimpl
    def resource_unpublished(self, resource):
        """
        Remove an unpublished resource from the search index

        Args:
            resource(LearningResource): The Learning Resource that was removed
        """
        try_with_retry_as_task(
            tasks.deindex_document,
            resource.id,
            resource.resource_type,
        )

        if resource.resource_type == COURSE_TYPE:
            for run in resource.runs.all():
                self.resource_run_unpublished(run)

    @hookimpl
    def resource_similar_topics(self, resource) -> list[dict]:
        """
        Get similar topics for a resource

        Args:
            resource(LearningResource): The Learning Resource to get similar topics for

        Returns:
            list: The similar topics
        """
        text_doc = {
            "title": resource.title,
            "description": resource.description,
            "full_description": resource.full_description,
        }

        topic_names = get_similar_topics(
            text_doc,
            settings.OPEN_VIDEO_MAX_TOPICS,
            settings.OPEN_VIDEO_MIN_TERM_FREQ,
            settings.OPEN_VIDEO_MIN_DOC_FREQ,
        )
        return [{"name": topic_name} for topic_name in topic_names]

    @hookimpl
    def bulk_resources_unpublished(self, resource_ids, resource_type):
        """
        Remove multiple resources from the search index

        Args:
            resource_ids(list): The Learning Resource ids that were removed
            resource_type(str): The Learning Resource type that was removed
        """
        for ids in chunks(
            resource_ids,
            chunk_size=settings.OPENSEARCH_INDEXING_CHUNK_SIZE,
        ):
            try_with_retry_as_task(
                tasks.bulk_deindex_learning_resources,
                ids,
                resource_type,
            )

    @hookimpl
    def resource_before_delete(self, resource):
        """
        Remove a resource from the search index and then delete the object
        """
        self.resource_unpublished(resource)

    @hookimpl
    def resource_run_unpublished(self, run):
        """
        Remove a learning resource run's content files from the search index

        Args:
            run(LearningResourceRun): The Learning Resource run that was removed
        """
        try_with_retry_as_task(tasks.deindex_run_content_files, run.id, False)  # noqa: FBT003

    @hookimpl
    def resource_run_delete(self, run):
        """
        Remove a learning resource run's content files from the search index
        and then delete the object
        """
        self.resource_run_unpublished(run)
        run.delete()

    @hookimpl
    def content_files_loaded(self, run, deindex_only):
        """
        Upsert a created/modified run's content files

         Args:
             run(LearningResourceRun): The LearningResourceRun that was upserted
             deindex_only(bool): Only deindex the other runs' content files
        """
        course_runs_to_deindex = run.learning_resource.runs.all()
        if run.published:
            # Only one run per course should have contentfiles at any given time
            course_runs_to_deindex = course_runs_to_deindex.exclude(id=run.id)
            if not deindex_only:
                try_with_retry_as_task(tasks.index_run_content_files, run.id)
        for course_run in course_runs_to_deindex:
            try_with_retry_as_task(
                tasks.deindex_run_content_files,
                course_run.id,
                False,  # noqa: FBT003
            )
