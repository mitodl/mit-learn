"""News and events pipelines"""

from toolz import compose

from news_events.etl import (
    loaders,
    medium_mit_news,
    mitpe_events,
    mitpe_news,
    ol_events,
    sloan_news_events,
)

load_sources = loaders.load_feed_sources

# Pipeline for Medium MIT News
medium_mit_news_etl = compose(
    load_sources,
    medium_mit_news.transform,
    medium_mit_news.extract,
)

# Pipeline for Sloan blog
sloan_news_events_etl = compose(
    load_sources,
    sloan_news_events.transform,
    sloan_news_events.extract,
)


# Pipeline for Open Learning Events
ol_events_etl = compose(
    load_sources,
    ol_events.transform,
    ol_events.extract,
)

# Pipeline for MITPE News
mitpe_news_etl = compose(
    load_sources,
    mitpe_news.transform,
    mitpe_news.extract,
)

# Pipeline for MITPE Events
mitpe_events_etl = compose(
    load_sources,
    mitpe_events.transform,
    mitpe_events.extract,
)
