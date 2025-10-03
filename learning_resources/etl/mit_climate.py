"""MIT Climate Article ETL"""

import logging

import requests
from django.conf import settings

log = logging.getLogger()


def retrieve_feed(feed_url):
    return requests.get(feed_url, timeout=settings.REQUESTS_TIMEOUT).json()


def transform_article(source_url, article_data: dict):
    article_url = f"{source_url}{article_data.get('url')}"
    full_description = f"""{article_data.get("summary")}
	{article_data.get("footnotes")}
	{article_data.get("byline")}
	"""
    article_data["url"] = article_url
    article_data["full_description"] = full_description
    article_data["description"] = article_data.get("summary")
    return article_data


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
