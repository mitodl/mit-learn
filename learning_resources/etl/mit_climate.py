"""MIT Climate Article ETL"""

import logging
from datetime import UTC
from zoneinfo import ZoneInfo

import dateutil
import requests
from django.conf import settings

log = logging.getLogger()


def retrieve_feed(feed_url):
    return requests.get(feed_url, timeout=settings.REQUESTS_TIMEOUT).json()


def transform_article(source_url, article_data: dict):
    article_url = f"{source_url}{article_data.get('url')}"
    summary = article_data.get("summary")
    full_description = "\n".join(
        [
            summary,
            article_data.get("footnotes", ""),
            article_data.get("byline", ""),
        ]
    )

    created_on = (
        dateutil.parser.parse(article_data["created"])
        .replace(tzinfo=ZoneInfo("US/Eastern"))
        .astimezone(UTC)
        if article_data.get("created")
        else None
    )
    return {
        "title": article_data.get("title"),
        "readable_id": article_data.get("uuid"),
        "url": article_url,
        "description": summary,
        "full_description": full_description,
        "published": True,
        "created_on": created_on,
    }


def extract_articles():
    feed_urls = [
        settings.MIT_CLIMATE_EXPLAINERS_API_URL,
        settings.ASK_MIT_CLIMATE_API_URL,
    ]
    articles = []
    for source_url in feed_urls:
        results = retrieve_feed(source_url)
        articles.extend([transform_article(source_url, article) for article in results])
    return articles
