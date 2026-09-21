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

    from learning_resources.models import Video

    video = Video.objects.filter(learning_resource_id=mit_learn_id).first()
    if video is None:
        log.warning(
            "mediaEmbed references mitLearnVideoId=%s but no Video was found",
            mit_learn_id,
        )
        return None

    if video.cover_image_url:
        return {"url": video.cover_image_url, "alt": "", "description": ""}

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


def _traverse_for_text(node: ProseMirrorNode, parts: list[str]) -> None:
    """Collect the text of every text node, depth first."""
    if node.get("type") == "text":
        text = node.get("text")
        if text:
            parts.append(text)

    children = node.get("content", [])
    for child in children:
        _traverse_for_text(child, parts)

    if children:
        # A block boundary. Text nodes are joined with nothing between them --
        # they are contiguous characters that differ only by their marks, so a
        # separator would break words apart -- which leaves the end of one
        # block otherwise running into the start of the next.
        parts.append(" ")


def extract_text_from_content(content_json: dict | None) -> str:
    """
    Flatten a ProseMirror/Tiptap document to plain text.

    Block structure is not preserved -- this exists so the content is reachable
    by keyword search alongside its topics, not to reconstruct the document.
    Whitespace is collapsed to single spaces.

    Args:
        content_json: The JSON content from a WebsiteContent record.

    Returns:
        str: the document's text, space separated, or "" if there is none.
    """
    if not content_json:
        return ""

    parts: list[str] = []
    _traverse_for_text(content_json, parts)
    # split() on the joined text collapses the block separators above, along
    # with any newlines or runs of spaces inside the text itself.
    return " ".join("".join(parts).split())
