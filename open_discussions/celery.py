"""
As described in
http://celery.readthedocs.org/en/latest/django/first-steps-with-django.html
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "open_discussions.settings")

from django.conf import settings  # noqa pylint: disable=wrong-import-position

app = Celery("open_discussions")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.conf.task_default_queue = "default"
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)  # pragma: no cover

app.conf.task_routes = {
    "course_catalog.tasks.get_content_tasks": {"queue": "edx_content"},
    "course_catalog.tasks.get_content_files": {"queue": "edx_content"},
    "course_catalog.tasks.import_all_xpro_files": {"queue": "edx_content"},
    "course_catalog.tasks.import_all_mitx_files": {"queue": "edx_content"},
    "course_catalog.tasks.import_all_mitxonline_files": {"queue": "edx_content"},
    "search.tasks.index_course_content_files": {"queue": "edx_content"},
    "search.tasks.index_run_content_files": {"queue": "edx_content"},
    "search.tasks.deindex_run_content_files": {"queue": "edx_content"},
}
