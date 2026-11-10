"""
As described in
http://celery.readthedocs.org/en/latest/django/first-steps-with-django.html
"""

import os
import sys

from celery import Celery
from celery.signals import setup_logging, worker_process_shutdown
from mitol.observability.celery import setup_celery_logging

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "main.settings")

from django.conf import settings

app = Celery("main")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.conf.task_default_queue = "default"
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)  # pragma: no cover

app.conf.task_routes = {
    "vector_search.tasks.generate_embeddings": {"queue": "embeddings"},
    "vector_search.tasks.embed_run_content_files": {"queue": "embeddings"},
    "vector_search.tasks.remove_run_content_files": {"queue": "embeddings"},
    "vector_search.tasks.remove_unpublished_run_content_files": {"queue": "embeddings"},
    "vector_search.tasks.remove_embeddings": {"queue": "embeddings"},
    "vector_search.tasks.embed_learning_resources_by_id": {"queue": "embeddings"},
    "vector_search.tasks.embed_new_learning_resources": {"queue": "embeddings"},
    "vector_search.tasks.embed_new_content_files": {"queue": "embeddings"},
    "learning_resources.tasks.get_content_tasks": {"queue": "edx_content"},
    "learning_resources.tasks.get_content_files": {"queue": "edx_content"},
    "learning_resources.tasks.import_all_xpro_files": {"queue": "edx_content"},
    "learning_resources.tasks.import_all_mitxonline_files": {"queue": "edx_content"},
    "learning_resources.tasks.unpublish_excluded_files": {"queue": "edx_content"},
    "learning_resources.tasks.unpublish_all_excluded_files": {"queue": "edx_content"},
    "learning_resources_search.tasks.index_run_content_files": {"queue": "edx_content"},
    "learning_resources_search.tasks.deindex_run_content_files": {
        "queue": "edx_content"
    },
    "learning_resources.tasks.import_content_files": {"queue": "edx_content"},
    "learning_resources.tasks.load_warehouse_content_files": {"queue": "edx_content"},
    "learning_resources.tasks.ingest_edx_run_archive": {"queue": "edx_content"},
    "learning_resources.tasks.ingest_canvas_course": {"queue": "edx_content"},
    "learning_resources.tasks.sync_canvas_courses": {"queue": "edx_content"},
}


# Without a receiver Celery swaps the root logger's handler for a plain-text
# one, so pool children log in a format `| json` can't parse, and it redirects
# stdout through the `celery` logger, which drops task results and prints.
# The worker's `-l` flag is ignored from here on; LOG_LEVEL sets the level.
setup_logging.connect(setup_celery_logging)


# How long a recycled pool child waits for ol-llm's span exporters to send.
LLM_TRACE_FLUSH_TIMEOUT_MILLIS = 10_000


@worker_process_shutdown.connect
def flush_llm_traces(**_kwargs):
    """
    Send the LLM traces this pool child has queued before it exits.

    ol-llm and the Opik SDK send traces from background threads and flush them
    at exit, but billiard ends a pool child with os._exit, which skips atexit,
    so a child recycled after a task (CELERY_WORKER_MAX_MEMORY_PER_CHILD) would
    drop them. A child that never imported ol_llm has nothing queued.
    """
    ol_llm = sys.modules.get("ol_llm")
    if ol_llm is not None and ol_llm.tracing.enabled():
        ol_llm.tracing.flush(timeout_millis=LLM_TRACE_FLUSH_TIMEOUT_MILLIS)
