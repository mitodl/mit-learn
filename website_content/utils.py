"""website_content utilities"""

import json
import logging
import re
from urllib.parse import urlparse

import requests
from django.conf import settings

from main.utils import generate_filepath

log = logging.getLogger(__name__)


def website_content_image_upload_uri(_, filename):
    """
    upload_to handler for WebsiteContentImageUpload.image_file
    """
    return generate_filepath(filename, "", "", "website_content")


def fetch_odl_video_thumbnail(embed_src: str) -> str | None:
    """
    Fetch the thumbnail URL for an ODL video by scraping its embed page.

    The embed page renders a `var SETTINGS = {...}` JS object that contains
    `video.videothumbnail_set[].cloudfront_url`. No public REST API exists.

    Args:
        embed_src: ODL video embed URL,
            e.g. "https://video.odl.mit.edu/videos/{key}/embed/"

    Returns:
        CloudFront thumbnail URL string, or None on any failure.
    """
    parsed = urlparse(embed_src)
    if parsed.scheme != "https" or parsed.hostname != "video.odl.mit.edu":
        log.warning("Refusing to fetch non-ODL embed URL: %s", embed_src)
        return None

    try:
        response = requests.get(embed_src, timeout=settings.REQUESTS_TIMEOUT)
        response.raise_for_status()
    except requests.RequestException:
        log.warning("Failed to fetch ODL video embed page: %s", embed_src)
        return None

    match = re.search(r"var SETTINGS = ({.*?});", response.text, re.DOTALL)
    if not match:
        return None

    try:
        odl_settings = json.loads(match.group(1))
    except json.JSONDecodeError:
        log.warning("Failed to parse SETTINGS JSON from ODL embed page: %s", embed_src)
        return None

    thumbnails = odl_settings.get("video", {}).get("videothumbnail_set", [])
    if thumbnails:
        return thumbnails[0].get("cloudfront_url")

    return None


def extract_image_from_content(content_json: dict) -> dict | None:  # noqa: C901
    """
    Extract the first image from JSON content structure.

    Args:
        content_json (dict): The JSON content from Article

    Returns:
        dict | None: Image data dict with url, alt, description or None
    """
    if not content_json:
        return None

    def traverse_for_image(node):  # noqa: C901, PLR0911, PLR0912
        """Recursively traverse JSON structure to find first image"""
        if not node:
            return None

        # Handle dict nodes
        if isinstance(node, dict):
            # Check if this node is an image node (common patterns)

            # ProseMirror imageWithCaption (your format)
            if node.get("type") == "imageWithCaption":
                attrs = node.get("attrs", {})
                if attrs.get("src"):
                    return {
                        "url": attrs["src"],
                        "alt": attrs.get("alt", attrs.get("title", "")),
                        "description": attrs.get(
                            "caption", attrs.get("alt", attrs.get("title", ""))
                        ),
                    }

            # ProseMirror image node
            if node.get("type") == "image":
                attrs = node.get("attrs", {})
                if attrs.get("src"):
                    return {
                        "url": attrs["src"],
                        "alt": attrs.get("alt", attrs.get("title", "")),
                        "description": attrs.get("alt", attrs.get("title", "")),
                    }
                # EditorJS image block
                data = node.get("data", {})
                if data.get("file", {}).get("url"):
                    return {
                        "url": data["file"]["url"],
                        "alt": data.get("caption", ""),
                        "description": data.get("caption", ""),
                    }

            # Direct image node with url
            if "image" in node or "img" in node:
                img_data = node.get("image") or node.get("img")
                if isinstance(img_data, dict) and img_data.get("url"):
                    return {
                        "url": img_data["url"],
                        "alt": img_data.get("alt", ""),
                        "description": img_data.get(
                            "description", img_data.get("alt", "")
                        ),
                    }
                elif isinstance(img_data, str):
                    return {
                        "url": img_data,
                        "alt": "",
                        "description": "",
                    }

            # Check for url field that might be an image
            if node.get("url") and any(
                ext in str(node.get("url", "")).lower()
                for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]
            ):
                return {
                    "url": node["url"],
                    "alt": node.get("alt", ""),
                    "description": node.get("description", node.get("caption", "")),
                }

            # Traverse nested dict values
            for value in node.values():
                result = traverse_for_image(value)
                if result:
                    return result
        # Handle list nodes
        elif isinstance(node, list):
            for item in node:
                result = traverse_for_image(item)
                if result:
                    return result

        return None

    image = traverse_for_image(content_json)
    if image:
        return image

    def _image_from_media_embed(attrs: dict) -> dict | None:
        cover = attrs.get("coverImageUrl")
        if cover:
            return {"url": cover, "alt": "", "description": ""}
        src = attrs.get("src", "")
        if src:
            parsed = urlparse(src)
            if (
                parsed.scheme in {"http", "https"}
                and parsed.hostname == "video.odl.mit.edu"
            ):
                thumbnail_url = fetch_odl_video_thumbnail(src)
                if thumbnail_url:
                    return {"url": thumbnail_url, "alt": "", "description": ""}
        return None

    def traverse_for_embed_cover(node) -> dict | None:
        """Fallback: find coverImageUrl on any mediaEmbed node.

        First checks the stored coverImageUrl attr. If absent and the src is
        an ODL video embed URL, fetches the embed page to retrieve the
        thumbnail from the server-rendered SETTINGS object.
        """
        if not node:
            return None
        if isinstance(node, dict):
            if node.get("type") == "mediaEmbed":
                result = _image_from_media_embed(node.get("attrs", {}))
                if result:
                    return result
            for value in node.values():
                result = traverse_for_embed_cover(value)
                if result:
                    return result
        elif isinstance(node, list):
            for item in node:
                result = traverse_for_embed_cover(item)
                if result:
                    return result
        return None

    return traverse_for_embed_cover(content_json)
