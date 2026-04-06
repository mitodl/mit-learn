"""Tasks for video shorts"""

import logging

import boto3
from django.conf import settings

from main.celery import app

log = logging.getLogger(__name__)


@app.task
def delete_video_short_from_s3(video_url: str) -> None:
    """Delete all objects from the S3 storage bucket for a video short."""
    prefix = video_url.rsplit("/", 1)[0].lstrip("/") if video_url else ""
    parts = prefix.split("/") if prefix else []
    if len(parts) < 2 or "shorts" not in parts:  # noqa: PLR2004
        log.warning("No shorts prefix provided for S3 deletion, skipping.")
        return
    s3 = boto3.resource(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    bucket = s3.Bucket(settings.AWS_STORAGE_BUCKET_NAME)
    batch_size = 1000
    batch = []
    deleted_count = 0
    for obj in bucket.objects.filter(Prefix=prefix):
        batch.append({"Key": obj.key})
        if len(batch) == batch_size:
            bucket.delete_objects(Delete={"Objects": batch})
            deleted_count += len(batch)
            batch = []
    if batch:
        bucket.delete_objects(Delete={"Objects": batch})
        deleted_count += len(batch)
    if deleted_count:
        log.info(
            "Deleted %d objects from s3://%s/%s",
            deleted_count,
            settings.AWS_STORAGE_BUCKET_NAME,
            prefix,
        )
    else:
        log.info(
            "No objects found in s3://%s/%s",
            settings.AWS_STORAGE_BUCKET_NAME,
            prefix,
        )
