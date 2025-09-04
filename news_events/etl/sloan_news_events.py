"""ETL for blog/news from Sloan School of Management Executive Education"""

import hashlib
import logging
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from main.utils import clean_data
from news_events.constants import ALL_AUDIENCES, FeedType
from news_events.etl.utils import parse_date

log = logging.getLogger(__name__)

SLOAN_EXEC_TITLE = "MIT Sloan Executive Education"
SLOAN_BASE_URL = "https://executive.mit.edu/"
SLOAN_EXEC_NEWS_URL = urljoin(SLOAN_BASE_URL, "/insights")
SLOAN_EXEC_WEBINARS_URL = urljoin(SLOAN_BASE_URL, "/webinars.html")
SLOAN_EXEC_SEARCH_URL = urljoin(
    SLOAN_BASE_URL,
    "/on/demandware.store/Sites-MSEE-Site/default/Search-Content?fdid=insights&csortb1=publicationDate&csortd1=2&page=0&selectedUrl=%2Fon%2Fdemandware.store%2FSites-MSEE-Site%2Fdefault%2FSearch-Content%3Ffdid%3Dinsights%26csortb1%3DpublicationDate%26csortd1%3D2",
)


def extract() -> list:
    """
    Extract content tiles from Sloan School of Management

    Returns:
        list: BeautifulSoup elements from content tiles
    """
    response = requests.get(SLOAN_EXEC_SEARCH_URL, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.content, "html.parser")

    # Find the content-tiles-wrapper
    content_wrapper = soup.find(
        "div", class_="content-tiles-wrapper row blog-page-wrapper"
    )
    if not content_wrapper:
        log.error("Could not find content section")
        return []

    # Extract all content-tile elements
    content_tiles = content_wrapper.find_all(
        "div", class_="content-tile col-12 col-md-4"
    )

    log.info("Found %d content tiles", len(content_tiles))
    return content_tiles


def transform_item(item_data: BeautifulSoup) -> dict:
    """
    Transform item from Sloan School of Management blog

    Args:
        item_data: BeautifulSoup element representing a content tile

    Returns:
        dict: Transformed data for a single blog post

    """
    # Get the url from the content-tile-link
    link_elem = item_data.find("a", class_="content-tile-link")
    href = link_elem.get("href", "") if link_elem else ""
    if not href:
        log.error("No url found for Sloan news_event content")
        return None
    url = urljoin("https://executive.mit.edu", href)

    # Get summary/content from p tag
    summary_elem = item_data.find(
        "p", class_="ellipsis-3-lines mb-3 menu-card-underline"
    )
    summary_text = summary_elem.get_text(strip=True) if summary_elem else ""

    # Get image info
    img_elem = item_data.find(
        "img", class_="img-fluid object-fit-cover dis-image menu-card-underline"
    )
    image_url = img_elem.get("src", "") if img_elem else ""
    image_alt = img_elem.get("alt", "") if img_elem else ""

    # Get topics from disclaimer div
    topics_elem = item_data.find(
        "div", class_="menu-card__disclaimer type-info menu-card-underline"
    )
    topics_text = topics_elem.get_text(strip=True) if topics_elem else ""
    topics = [topic.strip() for topic in topics_text.split(",") if topic.strip()]

    # Get type and publish date from info div
    info_div = item_data.find(
        "div",
        class_=(
            "menu-card__info type-info d-flex menu-card__infocustom menu-card-underline"
        ),
    )
    item_type = FeedType.news.name  # default
    publish_date = None

    if info_div:
        spans = info_div.find_all("span")
        if len(spans) >= 1:
            first_span_text = spans[0].get_text(strip=True)
            if "webinar" in first_span_text.lower():
                item_type = FeedType.events.name
        MIN_SPANS_FOR_DATE = 2
        if len(spans) >= MIN_SPANS_FOR_DATE:
            publish_date = parse_date(spans[1].get_text(strip=True))

    if item_type == FeedType.news.name:
        detail = {"publish_date": publish_date, "topics": topics, "authors": []}
    else:
        detail = {
            "location": ["Online"],
            "audience": ALL_AUDIENCES,
            "event_type": ["Webinar"],
            "event_datetime": publish_date,
            "event_end_datetime": None,
        }

    # Get title text safely
    title_elem = item_data.find("h3", class_="menu-card-underline")
    title_text = title_elem.get_text(strip=True) if title_elem else ""

    return {
        "guid": hashlib.md5(href.encode()).hexdigest(),  # noqa: S324
        "title": title_text,
        "summary": clean_data(summary_text),
        "content": clean_data(summary_text),
        "url": url,
        "image": {
            "url": image_url,
            "alt": image_alt,
            "description": image_alt,
        },
        "detail": detail,
        "type": item_type,
    }


def transform_items(source_data: dict) -> list[dict]:
    """
    Transform items from Sloan School of Management blog

    Args:
        source_data (dict): raw JSON data for Sloan blog posts

    Returns:
        list of dict: List of transformed blog posts

    """
    news_items = []
    webinar_items = []
    for item in source_data:
        transformed_item = transform_item(item)
        if transformed_item is None:
            continue
        if transformed_item.pop("type") == FeedType.news.name:
            news_items.append(transformed_item)
        else:
            webinar_items.append(transformed_item)

    return news_items, webinar_items


def transform(source_data: dict) -> list[dict]:
    """
    Transform the data from Sloan School of Management's blog.

    Args:
        source_data (Soup): BeautifulSoup representation of Sloan index page
        news_data (dict): JSON data from Sloan blog API request

    Returns:
        list of dict: List of transformed source data

    """
    news_items, webinar_items = transform_items(source_data)
    return [
        {
            "title": f"{SLOAN_EXEC_TITLE} - Blog & Stories",
            "url": SLOAN_EXEC_NEWS_URL,
            "feed_type": FeedType.news.name,
            "description": f"{SLOAN_EXEC_TITLE} - Blog & Stories",
            "items": news_items,
        },
        {
            "title": f"{SLOAN_EXEC_TITLE} - Webinars",
            "url": SLOAN_EXEC_WEBINARS_URL,
            "feed_type": FeedType.events.name,
            "description": f"{SLOAN_EXEC_TITLE} - Blog & Stories",
            "items": webinar_items,
        },
    ]
