"""Task shims for the retired video_shorts app."""

import logging

from main.celery import app

log = logging.getLogger(__name__)


@app.task
def delete_video_short_from_s3(video_url: str) -> None:
    """No-op compatibility shim for queued tasks from the retired app."""
    log.info("Skipping video short S3 deletion for retired app: %s", video_url)
