"""
News and events pipelines

Each feed checks ETLSourceOwnership before it extracts, keyed by
(feed name, feed type), e.g. ("mitpe_news", "news"). Feed items are not
LearningResources, so these keys share the table but not the catalog's
etl_source names.
"""

from toolz import compose, curry

from learning_resources.etl.ownership import when_owned
from news_events.constants import FeedType
from news_events.etl import (
    articles_news,
    loaders,
    medium_mit_news,
    mitpe_events,
    mitpe_news,
    ol_events,
    sloan_exec_news,
    sloan_webinars,
)

load_sources = curry(loaders.load_feed_sources)

# Pipeline for Medium MIT News
medium_mit_news_etl = when_owned(
    "medium_mit_news",
    FeedType.news.name,
    compose(
        load_sources(FeedType.news.name),
        medium_mit_news.transform,
        medium_mit_news.extract,
    ),
)

# Pipeline for Sloan blog
sloan_exec_news_etl = when_owned(
    "sloan_exec_news",
    FeedType.news.name,
    compose(
        load_sources(FeedType.news.name),
        sloan_exec_news.transform,
        sloan_exec_news.extract,
    ),
)
sloan_webinars_etl = when_owned(
    "sloan_webinars",
    FeedType.events.name,
    compose(
        load_sources(FeedType.events.name),
        sloan_webinars.transform,
        sloan_webinars.extract,
    ),
)


# Pipeline for Open Learning Events
ol_events_etl = when_owned(
    "ol_events",
    FeedType.events.name,
    compose(
        load_sources(FeedType.events.name),
        ol_events.transform,
        ol_events.extract,
    ),
)

# Pipeline for MITPE News
mitpe_news_etl = when_owned(
    "mitpe_news",
    FeedType.news.name,
    compose(
        load_sources(FeedType.news.name),
        mitpe_news.transform,
        mitpe_news.extract,
    ),
)

# Pipeline for MITPE Events
mitpe_events_etl = when_owned(
    "mitpe_events",
    FeedType.events.name,
    compose(
        load_sources(FeedType.events.name),
        mitpe_events.transform,
        mitpe_events.extract,
    ),
)

# Pipeline for Articles News
articles_news_etl = when_owned(
    "articles_news",
    FeedType.news.name,
    compose(
        load_sources(FeedType.news.name),
        articles_news.transform,
        articles_news.extract,
    ),
)
