"""MIT Climate Article ETL"""

import html
import logging
import urllib.parse
from datetime import UTC
from zoneinfo import ZoneInfo

import dateutil
import requests
from django.conf import settings

from learning_resources.etl.constants import MIT_CLIMATE_TOPIC_MAP, ETLSource

log = logging.getLogger()


def transform_topics(topic_string: str):
    topics = topic_string.split("|")
    topic_list = []

    for topic in topics:
        topic_map = MIT_CLIMATE_TOPIC_MAP.get(urllib.parse.unquote(topic), {})
        if topic_map:
            primary_topic_name = topic_map.get("topic")
            subtopic_name = topic_map.get("subtopic")
            if primary_topic_name:
                topic_list.append({"name": primary_topic_name})
            if subtopic_name:
                topic_list.append({"name": subtopic_name.split(":")[-1].strip()})
    return topic_list


def retrieve_feed(feed_url):
    return requests.get(feed_url, timeout=settings.REQUESTS_TIMEOUT).json()


def transform_article(article_data: dict):
    article_url = f"{settings.MIT_CLIMATE_BASE_URL}{article_data.get('url')}"
    summary = article_data.get("summary")
    full_description = "\n".join(
        [
            summary,
            article_data.get("footnotes", ""),
            article_data.get("byline", ""),
        ]
    )
    topics = transform_topics(article_data.get("topics", ""))
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
        "description": summary,
        "topics": topics,
        "full_description": full_description,
        "published": True,
        "created_on": created_on,
        "etl_source": ETLSource.mit_climate.name,
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
