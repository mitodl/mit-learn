"""Functions for processing video shorts on S3"""

import json
import logging
from collections.abc import Generator
from pathlib import PurePosixPath

import boto3
from django.conf import settings

from video_shorts.models import VideoShort
from video_shorts.serializers import VideoShortWebhookSerializer

log = logging.getLogger(__name__)


def walk_video_shorts_from_s3(
    limit: int | None = None,
) -> Generator[VideoShort, None, None]:
    """Walk through video shorts stored in S3 and yield their metadata"""

    if limit is None:
        limit = settings.VIDEO_SHORTS_COUNT

    s3 = boto3.resource(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    bucket = s3.Bucket(settings.AWS_STORAGE_BUCKET_NAME)
    prefix = (
        str(
            PurePosixPath(settings.AWS_S3_PREFIX or "")
            / settings.VIDEO_SHORTS_S3_PREFIX
        )
        + "/"
    )

    # Get all objects, sorted by last_modified (newest first)
    all_objects = sorted(
        bucket.objects.filter(Prefix=prefix),
        key=lambda obj: obj.last_modified,
        reverse=True,
    )

    # Filter for JSON files only, then apply limit
    json_objects = [obj for obj in all_objects if obj.key.endswith(".json")]

    for short in json_objects[:limit]:
        try:
            s3_object = bucket.Object(short.key).get()
            webhook_data = json.loads(s3_object["Body"].read().decode("utf-8"))
            video_data = webhook_data.get("video_metadata", webhook_data)
            video_short = upsert_video_short(video_data)
            yield video_short
        except Exception:
            log.exception("Error processing %s", short.key)
            continue


def upsert_video_short(data: dict) -> VideoShort:
    """Process a video short based on Youtube metadata"""
    video_id = data.get("video_id")
    existing_video_short = VideoShort.objects.filter(video_id=video_id).first()
    video_short_serializer = VideoShortWebhookSerializer(
        data=data, instance=existing_video_short
    )
    video_short_serializer.is_valid(raise_exception=True)
    return video_short_serializer.save()
