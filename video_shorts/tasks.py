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
    if not prefix or "shorts" not in prefix.split("/"):
        log.warning("No shorts prefix provided for S3 deletion, skipping.")
        return
    s3 = boto3.resource(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    bucket = s3.Bucket(settings.AWS_STORAGE_BUCKET_NAME)
    objects = list(bucket.objects.filter(Prefix=prefix))
    if objects:
        bucket.delete_objects(Delete={"Objects": [{"Key": obj.key} for obj in objects]})
        log.info(
            "Deleted %d objects from s3://%s/%s",
            len(objects),
            settings.AWS_STORAGE_BUCKET_NAME,
            prefix,
        )
    else:
        log.info(
            "No objects found in s3://%s/%s",
            settings.AWS_STORAGE_BUCKET_NAME,
            prefix,
        )
