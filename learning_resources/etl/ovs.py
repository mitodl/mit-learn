"""ODL Video Service (OVS) ETL"""

import logging
from urllib.parse import urlencode, urlparse, urlunparse

import requests
from django.conf import settings

from learning_resources.constants import (
    Availability,
    LearningResourceType,
    OfferedBy,
    PlatformType,
)
from learning_resources.etl.constants import ETLSource

log = logging.getLogger(__name__)


def _get_cloudfront_domain(video_data: dict) -> str | None:
    """
    Extract the CloudFront domain from thumbnail or source URLs.

    Args:
        video_data: OVS video API response dict

    Returns:
        CloudFront domain string or None
    """
    # Try thumbnails first
    for thumbnail in video_data.get("videothumbnail_set", []):
        cf_url = thumbnail.get("cloudfront_url", "")
        if cf_url:
            parsed = urlparse(cf_url)
            return parsed.netloc
    # Fall back to sources
    for source in video_data.get("sources", []):
        src = source.get("src", "")
        if src:
            parsed = urlparse(src)
            return parsed.netloc
    return None


def _build_caption_urls(video_data: dict) -> list[dict]:
    """
    Build a list of caption URL dicts from the OVS videosubtitle_set.

    Uses the CloudFront domain from thumbnails/sources to construct URLs.

    Args:
        video_data: OVS video API response dict

    Returns:
        list of dicts with language and url keys
    """
    cf_domain = _get_cloudfront_domain(video_data)
    if not cf_domain:
        return []

    captions = []
    for subtitle in video_data.get("videosubtitle_set", []):
        s3_key = subtitle.get("s3_object_key", "")
        if s3_key:
            url = f"https://{cf_domain}/{s3_key}"
            captions.append(
                {
                    "language": subtitle.get("language", "en"),
                    "language_name": subtitle.get("language_name", ""),
                    "url": url,
                }
            )
    return captions


def _get_cover_image_url(video_data: dict) -> str | None:
    """
    Get the cover image URL from the first thumbnail in videothumbnail_set.

    Args:
        video_data: OVS video API response dict

    Returns:
        Cover image CloudFront URL or None
    """
    thumbnails = video_data.get("videothumbnail_set", [])
    if thumbnails:
        return thumbnails[0].get("cloudfront_url")
    return None


def _get_source_url(video_data: dict) -> str | None:
    """
    Get the primary streaming source URL.

    Args:
        video_data: OVS video API response dict

    Returns:
        HLS streaming URL or None
    """
    sources = video_data.get("sources", [])
    if sources:
        return sources[0].get("src")
    return None


def _duration_to_iso8601(duration_seconds: float) -> str:
    """
    Convert a duration in seconds to ISO 8601 duration string.

    Args:
        duration_seconds: duration as a float

    Returns:
        ISO 8601 duration string (e.g. "PT1H30M15S")
    """
    if not duration_seconds:
        return "PT0S"
    total_seconds = int(duration_seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    parts = ["PT"]
    if hours:
        parts.append(f"{hours}H")
    if minutes:
        parts.append(f"{minutes}M")
    if seconds or not (hours or minutes):
        parts.append(f"{seconds}S")
    return "".join(parts)


def extract(*, url=None):
    """
    Extract public non-YouTube videos from the OVS API.

    Handles pagination via the `next` field in the response.

    Args:
        url: optional override for the API URL

    Yields:
        dict: individual video data dicts from the API
    """
    api_url = url or settings.OVS_API_BASE_URL

    # Add exclude_resource=youtube param
    parsed = urlparse(api_url)
    if "exclude_resource" not in parsed.query:
        separator = "&" if parsed.query else ""
        new_query = (
            f"{parsed.query}{separator}{urlencode({'exclude_resource': 'youtube'})}"
        )
        api_url = urlunparse(parsed._replace(query=new_query))

    next_url = api_url
    while next_url:
        log.info("Fetching OVS videos from %s", next_url)
        response = requests.get(next_url, timeout=settings.REQUESTS_TIMEOUT)
        response.raise_for_status()
        data = response.json()

        for video in data.get("results", []):
            if video.get("is_public") and video.get("status") == "Complete":
                yield video

        next_url = data.get("next")


def _transform_video(video_data: dict) -> dict:
    """
    Transform a single OVS video into LearningResource format.

    Args:
        video_data: single video dict from the OVS API

    Returns:
        dict matching the load_video() expected format
    """
    cover_image_url = _get_cover_image_url(video_data)
    image_data = {"url": cover_image_url} if cover_image_url else None

    return {
        "readable_id": video_data["key"],
        "platform": PlatformType.ovs.name,
        "etl_source": ETLSource.ovs.name,
        "resource_type": LearningResourceType.video.name,
        "title": video_data.get("title", ""),
        "description": video_data.get("description", ""),
        "url": _get_source_url(video_data),
        "image": image_data,
        "last_modified": video_data.get("created_at"),
        "offered_by": {"code": OfferedBy.ovs.name},
        "availability": Availability.anytime.name,
        "published": True,
        "video": {
            "duration": _duration_to_iso8601(video_data.get("duration", 0)),
            "caption_urls": _build_caption_urls(video_data),
            "cover_image_url": cover_image_url,
        },
    }


def transform(extracted_videos):
    """
    Transform extracted OVS videos into LearningResource format.

    Args:
        extracted_videos: iterable of video dicts from extract()

    Yields:
        dict: normalized video data for load_video()
    """
    for video_data in extracted_videos:
        yield _transform_video(video_data)
