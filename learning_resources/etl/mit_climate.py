"""MIT Climate Article ETL"""

import html
import logging
import urllib
from datetime import UTC
from zoneinfo import ZoneInfo

import dateutil
import requests
from django.conf import settings

from learning_resources.constants import OfferedBy
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.utils import transform_topics

log = logging.getLogger()


def retrieve_feed(feed_url):
    return requests.get(feed_url, timeout=settings.REQUESTS_TIMEOUT).json()


def transform_article(article_data: dict):
    article_url = f"{settings.MIT_CLIMATE_BASE_URL}{article_data.get('url')}"
    image_url = f"{settings.MIT_CLIMATE_BASE_URL}{article_data.get('image_src')}"
    summary = article_data.get("summary")
    full_description = "\n".join(
        [
            summary,
            article_data.get("footnotes", ""),
            article_data.get("byline", ""),
        ]
    )
    article_topics = article_data.get("topics", "").split("|")
    topics = transform_topics(
        [{"name": urllib.parse.unquote(topic_name)} for topic_name in article_topics],
        offeror_code=OfferedBy.climate.name,
    )
    created_on = (
        dateutil.parser.parse(article_data["created"])
        .replace(tzinfo=ZoneInfo("US/Eastern"))
        .astimezone(UTC)
        if article_data.get("created")
        else None
    )
    return {
        "title": html.unescape(article_data.get("title")),
        "readable_id": article_data.get("uuid"),
        "url": article_url,
        "image": {
            "url": image_url,
            "alt": article_data.get("image_alt", ""),
        },
        "description": summary,
        "topics": topics,
        "full_description": full_description,
        "published": True,
        "created_on": created_on,
        "etl_source": ETLSource.mit_climate.name,
        "offered_by": {
            "code": OfferedBy.climate.name,
        },
    }


def extract_articles():
    feed_urls = [
        settings.MIT_CLIMATE_EXPLAINERS_API_URL,
        settings.ASK_MIT_CLIMATE_API_URL,
    ]
    articles = []
    for source_url in feed_urls:
        results = retrieve_feed(source_url)
        articles.extend([transform_article(article) for article in results])
    return articles
