import logging

from django.conf import settings

from learning_resources.etl.constants import ETLSource
from learning_resources.etl.utils import (
    get_learning_course_bucket,
)
from learning_resources.tasks import ingest_canvas_course

log = logging.getLogger(__name__)


def sync_canvas_courses(
    *,
    overwrite: bool = False,
):
    """
    Sync all canvas course files

    Args:
        overwrite (bool): Whether to overwrite existing content files
    """

    bucket = get_learning_course_bucket(ETLSource.canvas.name)
    s3_prefix = f"{settings.CANVAS_COURSE_BUCKET_PREFIX}"
    exports = bucket.objects.filter(Prefix=s3_prefix)
    log.info("syncing all canvas courses")
    for archive in exports:
        key = archive.key
        ingest_canvas_course(
            key,
            overwrite=overwrite,
        )
