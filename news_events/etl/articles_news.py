"""ETL functions for Articles News data."""

import logging

from articles.models import Article
from news_events.constants import FeedType
from news_events.etl import loaders

log = logging.getLogger(__name__)


def extract_single_article(article: Article) -> dict:
    """
    Extract a single published article from the database.
    Returns a dict in the same format as extract().
    """
    return {
        "id": article.id,
        "title": article.title,
        "slug": article.slug,
        "content": article.content,
        "user": article.user,
        "created_on": article.created_on,
        "updated_on": article.updated_on,
        "publish_date": article.publish_date,
    }


def transform_single_article(article_data: dict) -> dict:
    """
    Transform a single article into feed item format.
    Returns a dict suitable for loaders.load_feed_item.
    """
    items = transform_items([article_data])
    return items[0] if items else None


def sync_single_article_to_news(article: Article):
    """
    Sync a single published article to the news feed (create or update FeedItem).
    """
    # Only sync if published
    if not article.is_published:
        return
    article_data = extract_single_article(article)
    item_data = transform_single_article(article_data)
    if not item_data:
        return
    # Find or create the FeedSource for MIT Learn Articles
    from news_events.models import FeedSource

    source, _ = FeedSource.objects.get_or_create(
        title="MIT Learn Articles",
        defaults={
            "url": "/news",
            "feed_type": FeedType.news.name,
            "description": "Articles created by MIT Learn staff",
        },
    )
    loaders.load_feed_item(source, item_data)


def extract() -> list[dict]:
    """
    Extract published articles from the database.

    Returns:
        list[dict]: List of article data dictionaries.
    """
    # Get only published articles
    articles = Article.objects.filter(is_published=True).select_related("user")

    return [
        {
            "id": article.id,
            "title": article.title,
            "slug": article.slug,
            "content": article.content,
            "user": article.user,
            "created_on": article.created_on,
            "updated_on": article.updated_on,
            "publish_date": article.publish_date,
        }
        for article in articles
    ]


def transform_items(articles_data: list[dict]) -> list[dict]:
    """
    Transform articles into feed item format.

    Args:
        articles_data (list[dict]): List of article data dictionaries

    Returns:
        list[dict]: List of transformed feed items
    """
    entries = []

    for article in articles_data:
        # Extract content from JSON field
        content_json = article.get("content", {})

        # Extract summary from banner paragraph node
        summary_text = extract_summary_from_banner(content_json)

        # Convert JSON content to plain text for full content
        content_text = extract_text_from_content(content_json)

        # Extract first image from content
        image_data = extract_image_from_content(content_json)

        # Debug logging
        log.info(
            "Article %s: Extracted image: %s",
            article.get("id"),
            image_data,
        )

        # Get author information
        user = article.get("user")
        author_name = ""
        if user:
            author_name = f"{user.first_name} {user.last_name}".strip()
            if not author_name:
                author_name = user.username

        # Build the article URL using slug
        slug = article.get("slug")
        article_url = f"/news/{slug}" if slug else f"/news/{article.get('id')}"

        # Use publish_date if available, otherwise fall back to created_on
        publish_date = article.get("publish_date") or article.get("created_on")

        entry = {
            "guid": f"article-{article.get('id')}",
            "title": article.get("title", ""),
            "url": article_url,
            "summary": summary_text,
            "content": content_text,
            "image": image_data,
            "detail": {
                "authors": [author_name] if author_name else [],
                "topics": [],  # Add topics if you have them in your Article model
                "publish_date": publish_date.isoformat() if publish_date else None,
            },
        }
        entries.append(entry)

    return entries


def _extract_text_from_paragraph(paragraph_node: dict) -> str:
    """
    Extract text content from a paragraph node, preserving links as HTML anchor tags.

    Args:
        paragraph_node (dict): Paragraph node containing text nodes

    Returns:
        str: Extracted text content with links as HTML anchor tags
    """
    paragraph_content = paragraph_node.get("content", [])
    text_parts = []

    for text_node in paragraph_content:
        if isinstance(text_node, dict) and text_node.get("type") == "text":
            text = text_node.get("text", "")
            if text:
                # Check if this text has link marks
                marks = text_node.get("marks", [])
                link_mark = None

                # Find link mark if it exists
                for mark in marks:
                    if isinstance(mark, dict) and mark.get("type") == "link":
                        link_mark = mark
                        break

                # If there's a link, wrap in anchor tag
                if link_mark:
                    attrs = link_mark.get("attrs", {})
                    href = attrs.get("href", "")
                    target = attrs.get("target", "_blank")
                    rel = attrs.get("rel", "noopener noreferrer nofollow")

                    if href:
                        text = (
                            f'<a href="{href}" target="{target}" rel="{rel}">{text}</a>'
                        )

                text_parts.append(text)

    return "".join(text_parts)


def _find_paragraph_in_banner(content_array: list) -> str:
    """
    Find and extract text from paragraph inside banner node.

    Args:
        content_array (list): Array of content nodes

    Returns:
        str: Text from banner paragraph or empty string
    """
    for node in content_array:
        if isinstance(node, dict) and node.get("type") == "banner":
            banner_content = node.get("content", [])

            for child in banner_content:
                if isinstance(child, dict) and child.get("type") == "paragraph":
                    summary = _extract_text_from_paragraph(child)
                    if summary.strip():
                        return summary

    return ""


def _find_first_paragraph(content_array: list) -> str:
    """
    Find and extract text from first non-empty paragraph in content.

    Args:
        content_array (list): Array of content nodes

    Returns:
        str: Text from first paragraph or empty string
    """
    for node in content_array:
        if isinstance(node, dict) and node.get("type") == "paragraph":
            summary = _extract_text_from_paragraph(node)
            if summary.strip():
                return summary

    return ""


def extract_summary_from_banner(content_json: dict) -> str:
    """
    Extract summary text from the paragraph node inside the banner node.
    Falls back to first paragraph in content if banner paragraph is empty.

    Args:
        content_json (dict): The JSON content from Article

    Returns:
        str: Summary text from banner paragraph or first available paragraph
    """
    if not content_json:
        return ""

    content_array = content_json.get("content", [])

    # Try to get summary from banner paragraph first
    summary = _find_paragraph_in_banner(content_array)
    if summary:
        return summary

    # Fallback to first non-empty paragraph
    return _find_first_paragraph(content_array)


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

    return traverse_for_image(content_json)


def extract_text_from_content(content_json: dict) -> str:  # noqa: C901
    """
    Extract plain text from JSON content structure.

    Args:
        content_json (dict): The JSON content from Article

    Returns:
        str: Plain text extracted from content
    """
    if not content_json:
        return ""

    def extract_text_from_node(node):  # noqa: C901
        """Recursively extract text from ProseMirror nodes"""
        if not node:
            return []

        texts = []

        # Handle dict nodes
        if isinstance(node, dict):
            # Direct text node
            if node.get("type") == "text":
                text = node.get("text", "")
                if text:
                    texts.append(text)
            # Node with content array (ProseMirror structure)
            elif "content" in node:
                content = node["content"]
                if isinstance(content, list):
                    for child in content:
                        texts.extend(extract_text_from_node(child))
                else:
                    texts.extend(extract_text_from_node(content))
            # Simple text field (fallback)
            elif "text" in node:
                texts.append(node["text"])

        # Handle list nodes
        elif isinstance(node, list):
            for item in node:
                texts.extend(extract_text_from_node(item))

        return texts

    # Extract text from ProseMirror structure
    text_parts = extract_text_from_node(content_json)

    # Fallback: EditorJS structure
    if not text_parts:
        blocks = content_json.get("blocks", [])
        for block in blocks:
            if isinstance(block, dict):
                text = block.get("text", "") or block.get("data", {}).get("text", "")
                if text:
                    text_parts.append(text)

    return " ".join(text_parts)


def transform(articles_data: list[dict]) -> list[dict]:
    """
    Transform the articles data into feed source format.

    Args:
        articles_data (list[dict]): List of article data

    Returns:
        list[dict]: List of transformed source data
    """
    if not articles_data:
        return []

    # Transform items first
    items = transform_items(articles_data)

    # Extract the first article's image to use as feed source image
    source_image = None
    for item in items:
        if item.get("image"):
            source_image = item["image"]
            break

    # Fallback: use a static logo if no articles have images
    if not source_image:
        # Example: {"url": "/static/images/mit-learn-logo.png", ...}
        source_image = None
    return [
        {
            "title": "MIT Learn Articles",
            "url": "/news",
            "feed_type": FeedType.news.name,
            "description": "Articles created by MIT Learn staff",
            "items": items,
            "image": source_image,
        }
    ]
