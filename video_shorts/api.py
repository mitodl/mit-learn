"""Functions for processing video shorts on S3"""

import json
import logging
from collections.abc import Generator

import boto3
from django.conf import settings

from video_shorts.models import VideoShort
from video_shorts.serializers import VideoShortSerializer, YouTubeMetadataSerializer

log = logging.getLogger(__name__)


def walk_video_shorts_from_s3(
    limit: int | None = None,
) -> Generator[VideoShort, None, None]:
    """Walk through video shorts stored in S3 and yield their metadata"""

    if limit is None:
        limit = settings.VIDEO_SHORTS_COUNT

    s3 = boto3.resource("s3")
    bucket = s3.Bucket(settings.AWS_STORAGE_BUCKET_NAME)
    prefix = settings.VIDEO_SHORTS_S3_PREFIX.rstrip("/") + "/"

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
            metadata = bucket.Object(short.key).get()
            serializer = YouTubeMetadataSerializer(
                data=json.loads(metadata["Body"].read().decode("utf-8"))
            )
            serializer.is_valid(raise_exception=True)
            video_short = upsert_video_short(serializer.validated_data)
            yield video_short
        except Exception:
            log.exception("Error processing %s", short.key)
            continue


def upsert_video_short(youtube_data: dict) -> VideoShort:
    """Process a video short based on Youtube metadata"""
    youtube_id = youtube_data.get("id")
    existing_video_short = VideoShort.objects.filter(youtube_id=youtube_id).first()
    video_short_serializer = VideoShortSerializer.transform_youtube_data(
        youtube_data,
        video_short=existing_video_short,
    )
    video_short_serializer.is_valid(raise_exception=True)
    return video_short_serializer.save()
