"""website_content utilities"""

import logging
from typing import Any, NotRequired, TypedDict

from main.utils import generate_filepath

log = logging.getLogger(__name__)


class ProseMirrorNode(TypedDict):
    """Minimal structural type for a ProseMirror/Tiptap JSON node.

    `attrs` and `content` are both optional: leaf nodes (text, image, mediaEmbed)
    typically have attrs but no content; container nodes (doc, paragraph, banner)
    have content but may have no attrs.
    """

    type: str
    attrs: NotRequired[dict[str, Any]]
    content: NotRequired[list["ProseMirrorNode"]]


def website_content_image_upload_uri(_, filename):
    """
    upload_to handler for WebsiteContentImageUpload.image_file
    """
    return generate_filepath(filename, "", "", "website_content")


def _traverse_for_image(node: ProseMirrorNode) -> dict | None:
    node_type = node.get("type")
    attrs = node.get("attrs", {})

    if node_type == "imageWithCaption" and attrs.get("src"):
        return {
            "url": attrs["src"],
            "alt": attrs.get("alt", attrs.get("title", "")),
            "description": attrs.get(
                "caption", attrs.get("alt", attrs.get("title", ""))
            ),
        }

    if node_type == "image" and attrs.get("src"):
        return {
            "url": attrs["src"],
            "alt": attrs.get("alt", attrs.get("title", "")),
            "description": attrs.get("alt", attrs.get("title", "")),
        }

    for child in node.get("content", []):
        result = _traverse_for_image(child)
        if result:
            return result

    return None


def _image_from_media_embed(attrs: dict) -> dict | None:
    mit_learn_id = attrs.get("mitLearnVideoId")
    if not mit_learn_id:
        return None

    from learning_resources.models import LearningResource

    try:
        resource = LearningResource.objects.get(id=mit_learn_id)
        url = resource.video and resource.video.cover_image_url
        if url:
            return {"url": url, "alt": "", "description": ""}
    except LearningResource.DoesNotExist:
        pass

    return None


def _traverse_for_embed_cover(node: ProseMirrorNode) -> dict | None:
    if node.get("type") == "mediaEmbed":
        result = _image_from_media_embed(node.get("attrs", {}))
        if result:
            return result
    for child in node.get("content", []):
        result = _traverse_for_embed_cover(child)
        if result:
            return result
    return None


def extract_image_from_content(content_json: dict) -> dict | None:
    """
    Extract the first image from a ProseMirror/Tiptap JSON document.

    Checks inline image nodes first (imageWithCaption, image). If none are
    found, falls back to mediaEmbed nodes: for MIT Learn videos, looks up
    the resource's cover_image_url via the DB using the stored mitLearnVideoId.

    Args:
        content_json: The JSON content from a WebsiteContent record.

    Returns:
        dict | None: Image data dict with url, alt, description or None
    """
    if not content_json:
        return None

    image = _traverse_for_image(content_json)
    if image:
        return image

    return _traverse_for_embed_cover(content_json)
