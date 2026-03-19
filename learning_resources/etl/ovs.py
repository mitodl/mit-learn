"""ODL Video Service (OVS) ETL"""

import logging
from collections import defaultdict
from collections.abc import Generator
from urllib.parse import urlencode, urlparse, urlunparse

import requests
from django.conf import settings
from django.db.models import QuerySet

from learning_resources.constants import (
    Availability,
    LearningResourceType,
    PlatformType,
)
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.loaders import update_index
from learning_resources.etl.utils import extract_text_from_url
from learning_resources.models import LearningResource

log = logging.getLogger(__name__)

OVS_API_PATH = "/api/v0/public/videos/"


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


def _get_resource_url(video_data: dict) -> str:
    """
    Get the user-facing URL for a video resource.

    Uses cta_link if available, otherwise builds a URL from OVS_API_BASE_URL.

    Args:
        video_data: OVS video API response dict

    Returns:
        URL string for the resource
    """
    cta_link = video_data.get("cta_link")
    if cta_link:
        return cta_link
    base_url = settings.OVS_API_BASE_URL.rstrip("/")
    return f"{base_url}/videos/{video_data['key']}"


def extract(*, url=None) -> Generator[dict, None, None]:
    """
    Extract public non-YouTube videos from the OVS API.

    Handles pagination via the `next` field in the response.

    Args:
        url: optional override for the full API URL

    Yields:
        dict: individual video data dicts from the API
    """
    if not url and not settings.OVS_API_BASE_URL:
        log.warning("OVS_API_BASE_URL is not configured; skipping OVS ETL")
        return
    api_url = url or f"{settings.OVS_API_BASE_URL.rstrip('/')}{OVS_API_PATH}"

    next_url = api_url
    while next_url:
        # Ensure include_in_learn=true is on every paginated URL
        parsed = urlparse(next_url)
        if "include_in_learn" not in parsed.query:
            separator = "&" if parsed.query else ""
            new_query = (
                f"{parsed.query}{separator}{urlencode({'include_in_learn': 'true'})}"
            )
            next_url = urlunparse(parsed._replace(query=new_query))

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
        "url": _get_resource_url(video_data),
        "image": image_data,
        "last_modified": video_data.get("created_at"),
        "availability": Availability.anytime.name,
        "published": True,
        "video": {
            "duration": _duration_to_iso8601(video_data.get("duration", 0)),
            "caption_urls": _build_caption_urls(video_data),
            "cover_image_url": cover_image_url or "",
        },
    }


def _transform_collection(collection_data: dict) -> dict:
    """
    Transform an OVS collection into a playlist dict.

    Args:
        collection_data: the collection dict from an OVS video response

    Returns:
        dict with playlist metadata (without videos, which are added later)
    """
    base_url = settings.OVS_API_BASE_URL.rstrip("/")
    return {
        "playlist_id": collection_data["key"],
        "platform": PlatformType.ovs.name,
        "title": collection_data.get("title", ""),
        "description": collection_data.get("description", ""),
        "url": f"{base_url}/collections/{collection_data['key']}",
        "published": True,
    }


def transform(extracted_videos) -> Generator[dict, None, None]:
    """
    Transform extracted OVS videos, grouped by collection into playlists.

    Args:
        extracted_videos: iterable of video dicts from extract()

    Yields:
        dict: playlist data with nested videos list
    """
    collections = {}
    collection_videos = defaultdict(list)

    for video_data in extracted_videos:
        collection = video_data.get("collection")
        if not collection or not collection.get("key"):
            continue
        collection_key = collection["key"]
        if collection_key not in collections:
            collections[collection_key] = _transform_collection(collection)
        collection_videos[collection_key].append(_transform_video(video_data))

    for collection_key, playlist_data in collections.items():
        playlist_data["videos"] = collection_videos[collection_key]
        yield playlist_data


def _fetch_transcript(caption_urls: list[dict]) -> str:
    """
    Fetch English transcript text from a list of caption URLs using Tika.

    Args:
        caption_urls: list of dicts with language and url keys

    Returns:
        Extracted transcript text, or empty string if unavailable
    """
    for caption in caption_urls:
        if caption.get("language") == "en":
            try:
                result = extract_text_from_url(caption["url"], mime_type="text/vtt")
                if result and result.get("content"):
                    return result["content"].strip()
            except requests.RequestException:
                log.exception("Failed to fetch transcript from %s", caption["url"])
            break
    return ""


def get_ovs_videos_for_transcripts_job(
    *, overwrite: bool = False
) -> QuerySet[LearningResource]:
    """
    Get OVS video resources that need transcripts.

    Args:
        overwrite: if True, include videos that already have transcripts

    Returns:
        QuerySet of LearningResource objects
    """
    video_resources = LearningResource.objects.select_related("video").filter(
        published=True,
        resource_type=LearningResourceType.video.name,
        platform__code=PlatformType.ovs.name,
        video__caption_urls__contains=[{"language": "en"}],
    )

    if not overwrite:
        video_resources = video_resources.filter(video__transcript="")

    return video_resources


def get_ovs_transcripts(video_resources: QuerySet[LearningResource]) -> None:
    """
    Fetch transcripts for OVS video resources from their caption URLs.

    Args:
        video_resources: iterable of LearningResource objects with related video
    """
    for resource in video_resources:
        caption_urls = resource.video.caption_urls
        if not caption_urls:
            continue
        transcript = _fetch_transcript(caption_urls)
        if transcript:
            video = resource.video
            video.transcript = transcript
            video.save()
            update_index(resource, newly_created=False)
