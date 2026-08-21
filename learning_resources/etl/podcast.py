"""podcast ETL"""

import logging

import github
import requests
import yaml
from bs4 import BeautifulSoup as bs  # noqa: N813
from dateutil.parser import parse
from django.conf import settings
from django.db.models import Q, QuerySet
from requests.exceptions import HTTPError

from learning_resources.constants import Availability, LearningResourceType
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.loaders import update_index
from learning_resources.etl.podcast_transcript import (
    BROWSER_UA_HEADERS,
    fetch_transcript,
    transcript_tags_from_rss,
)
from learning_resources.etl.utils import iso8601_duration
from learning_resources.models import LearningResource, PodcastEpisode
from main.constants import (
    ALLOWED_HTML_ATTRIBUTES_WITH_LINKS,
    ALLOWED_HTML_TAGS_WITH_LINKS,
)
from main.utils import clean_data, frontend_absolute_url, now_in_utc

CONFIG_FILE_REPO = "mitodl/open-podcast-data"
CONFIG_FILE_FOLDER = "podcasts"
TIMESTAMP_FORMAT = "%a, %d %b %Y  %H:%M:%S %z"
log = logging.getLogger()


def github_podcast_config_files():
    """
    Function that returns a list of pyGithub files with podcast config channel data

    Returns:
        A list of pyGithub contentFile objects
    """  # noqa: D401

    github_client = github.Github()

    repo = github_client.get_repo(CONFIG_FILE_REPO)

    return repo.get_contents(CONFIG_FILE_FOLDER, ref=settings.OPEN_PODCAST_DATA_BRANCH)


def validate_podcast_config(podcast_config):
    """
    Validates a playlist config

    Args:
        podcast_config (dict): the podcast config object

    Returns:
        list of str:
            list of errors or an empty list if no errors
    """  # noqa: D401
    errors = []

    if not podcast_config:
        errors.append("podcast config data is empty")
        return errors

    if not isinstance(podcast_config, dict):
        errors.append("Podcast data should be a dict")
        return errors

    if "rss_url" not in podcast_config:
        errors.append("Required key 'rss_url' is not present")

    return errors


def get_podcast_configs():
    """
    Fetch podcast configs from github

    Returns:
        list of dict:
            a list of configuration objects
    """
    podcast_configs = []

    for file in github_podcast_config_files():
        try:
            podcast_config = yaml.safe_load(file.decoded_content)

            errors = validate_podcast_config(podcast_config)

            if errors:
                log.error(
                    "Invalid podcast config for path=%s errors=%s", file.path, errors
                )
            else:
                podcast_configs.append(podcast_config)
        except yaml.scanner.ScannerError:
            log.exception("Error parsing podcast config for path=%s", file.path)
            continue

    return podcast_configs


def parse_readable_id_from_url(url):
    """
    Parse readable id from podcast/episode url

    Args:
        url (str): the podcast/episode url

    Returns:
        str: the readable id
    """
    return url.split("//")[-1]


def extract():
    """
    Function for extracting podcast data

    Returns:
        A generator that returns tupes ((BeautifulSoup object, dict)) with the rss and config data for the podcast
    """  # noqa: D401, E501
    configs = get_podcast_configs()

    if not configs:
        return

    for playlist_config in configs:
        rss_url = playlist_config["rss_url"]
        try:
            response = requests.get(rss_url, headers=BROWSER_UA_HEADERS)  # noqa: S113
            response.raise_for_status()

            feed = bs(response.content, "xml")
            yield (feed, playlist_config)
        except ConnectionResetError:
            log.warning("Connection reset error for rss url %s", rss_url)
        except (ConnectionError, HTTPError):
            log.exception("Invalid rss url %s", rss_url)


def transform_episode(rss_data, offered_by, topics, parent_image):
    """
    Transform a podcast episode into our normalized data

    Args:
        rss_data (beautiful soup object): the extracted episode data
        offered_by (atr): the offered_by value for this episode
        topics (list of dict): the topics for the podcast
        parent_image (str): url for podcast image
        podcast_id (str): unique id for podcast
    Returns:
        dict:
            normalized podcast episode data
    """

    episode_link = rss_data.link.text if rss_data.link else None
    audio_url = rss_data.enclosure["url"]
    return {
        "readable_id": rss_data.guid.text
        or parse_readable_id_from_url(
            rss_data.link.text if rss_data.link else rss_data.enclosure["url"]
        ),
        "etl_source": ETLSource.podcast.name,
        "resource_type": LearningResourceType.podcast_episode.name,
        "title": rss_data.title.text,
        "offered_by": offered_by,
        "description": clean_data(
            rss_data.description.text,
            tags=ALLOWED_HTML_TAGS_WITH_LINKS,
            attributes=ALLOWED_HTML_ATTRIBUTES_WITH_LINKS,
        ),
        "url": episode_link or audio_url,
        "image": {
            "url": (rss_data.find("image")["href"]),
        }
        if rss_data.find("image")
        else parent_image,
        "last_modified": parse(rss_data.pubDate.text),
        "published": True,
        "topics": topics,
        "podcast_episode": {
            "audio_url": rss_data.enclosure["url"],
            "episode_link": rss_data.link.text if rss_data.link else None,
            "duration": (
                iso8601_duration(rss_data.find("itunes:duration").text)
                if rss_data.find("itunes:duration")
                else None
            ),
            # `rss` carries the <podcast:transcript> tags too, so the
            # transcript job needs no reference field of its own. Do not add
            # `transcript` here: load_podcast_episode passes this dict to
            # update_or_create(defaults=...), which would blank it every run.
            "rss": rss_data.prettify(),
        },
        "availability": Availability.anytime.name,
    }


def transform(extracted_podcasts):
    """
    Transforms raw podcast data into normalized data structure

    Args:
        extracted_podcast (iterable of tuple): the rss data and config data for the podcast

    Returns:
        generator that yields normalized podcast data
    """  # noqa: D401, E501

    for rss_data, config_data in extracted_podcasts:
        try:
            image = (
                {"url": rss_data.channel.find("itunes:image")["href"]}
                if rss_data.channel.find("itunes:image")
                else None
            )
            topics = (
                [{"name": topic.strip()} for topic in config_data["topics"].split(",")]
                if "topics" in config_data
                else []
            )
            offered_by = (
                {"name": config_data["offered_by"]}
                if "offered_by" in config_data
                else None
            )
            apple_podcasts_url = config_data.get("apple_podcasts_url")
            google_podcasts_url = config_data.get("google_podcasts_url")
            title = config_data.get("podcast_title", rss_data.channel.title.text)

            yield {
                "readable_id": parse_readable_id_from_url(config_data["rss_url"]),
                "title": title,
                "etl_source": ETLSource.podcast.name,
                "resource_type": LearningResourceType.podcast.name,
                "offered_by": offered_by,
                "description": clean_data(
                    rss_data.channel.description.text,
                    tags=ALLOWED_HTML_TAGS_WITH_LINKS,
                    attributes=ALLOWED_HTML_ATTRIBUTES_WITH_LINKS,
                ),
                "image": image,
                "published": True,
                "url": config_data.get("website", None),
                "topics": topics,
                "episodes": (
                    transform_episode(episode_rss, offered_by, topics, image)
                    for episode_rss in rss_data.find_all("item")
                ),
                "podcast": {
                    "apple_podcasts_url": apple_podcasts_url,
                    "google_podcasts_url": google_podcasts_url,
                    "rss_url": config_data["rss_url"],
                },
                "availability": Availability.anytime.name,
            }
        except AttributeError:
            log.exception("Error parsing podcast data from %s", config_data["rss_url"])
            continue


def get_podcast_episodes_for_transcripts_job(
    *, overwrite: bool = False
) -> QuerySet[LearningResource]:
    """
    Get podcast episode resources that need transcripts.

    Args:
        overwrite: if True, include episodes that already have transcripts

    Returns:
        QuerySet of LearningResource objects
    """
    episode_resources = LearningResource.objects.select_related(
        "podcast_episode"
    ).filter(
        # Both spellings: a declared xmlns:podcast is stored as
        # "<podcast:transcript", an undeclared one loses the prefix and is
        # stored as "<transcript". Matching the bracket rather than the bare
        # word excludes descriptions that merely mention a transcript.
        Q(podcast_episode__rss__contains=":transcript")
        | Q(podcast_episode__rss__contains="<transcript"),
        published=True,
        resource_type=LearningResourceType.podcast_episode.name,
    )

    if not overwrite:
        episode_resources = episode_resources.filter(podcast_episode__transcript="")

    return episode_resources


def get_podcast_transcripts(episode_resources: QuerySet[LearningResource]) -> None:
    """
    Fetch transcripts for podcast episodes from their podcast:transcript urls.

    Args:
        episode_resources: LearningResource objects with a related podcast_episode
    """
    for resource in episode_resources:
        # Per-episode guard: one malformed feed fragment or unreachable host
        # must not abort the batch and skip every episode after it. extract()
        # above gets this wrong -- it lets requests' ConnectionError escape,
        # which is why a single dead feed kills the whole podcast ETL run.
        try:
            episode = resource.podcast_episode
            entries = transcript_tags_from_rss(episode.rss)
            if not entries:
                continue
            transcript = fetch_transcript(entries)
            if transcript:
                episode.transcript = transcript
                episode.save()
                update_index(resource, newly_created=False)
        except Exception:
            log.exception(
                "Error fetching transcript for podcast episode %s", resource.id
            )


def get_all_mit_podcasts_channel_rss():
    """
    Get channel information for the MIT aggregate podcast
    Returns:
        Beautiful soup object of the rss for the  MIT aggregate podcast, excluding episodes
    """  # noqa: E501
    current_timestamp = now_in_utc().strftime(TIMESTAMP_FORMAT)

    podcasts_url = frontend_absolute_url("/podcasts")
    cover_image_url = frontend_absolute_url("/static/images/podcast_cover_art.png")

    rss = f"""<?xml version='1.0' encoding='UTF-8'?>
    <rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">
        <channel>
            <title>MIT Learn Aggregated Podcast Feed</title>
            <link>{podcasts_url}</link>
            <language>en-us</language>
            <pubDate>{current_timestamp}</pubDate>
            <lastBuildDate>{current_timestamp}</lastBuildDate>
            <ttl>60</ttl>
            <itunes:subtitle>Episodes from podcasts from around MIT</itunes:subtitle>
            <itunes:author>MIT Open Learning</itunes:author>
            <itunes:summary>Episodes from podcasts from around MIT</itunes:summary>
            <description>Episodes from podcasts from around MIT</description>
            <itunes:owner>
                <itunes:name>MIT Open Learning</itunes:name>
                <itunes:email>{settings.EMAIL_SUPPORT}</itunes:email>
            </itunes:owner>
            <image>
              <url>{cover_image_url}</url>
              <title>MIT Learn Aggregated Podcast Feed</title>
              <link>{podcasts_url}</link>
            </image>
            <itunes:explicit>no</itunes:explicit>
            <itunes:category text="Education"/></itunes:category>
        </channel>
    </rss>"""
    return bs(rss, "xml")


def generate_aggregate_podcast_rss():
    """
    Creates and saves an rss file for the MIT aggregate podcast

    Returns:
        Beautiful soup object of the rss for the  MIT aggregate podcast
    """  # noqa: D401

    rss = get_all_mit_podcasts_channel_rss()
    episode_rss_list = (
        PodcastEpisode.objects.select_related("learning_resource")
        .filter(learning_resource__published=True)
        .order_by("learning_resource__last_modified")
        .reverse()
        .values_list("rss", flat=True)[: settings.RSS_FEED_EPISODE_LIMIT]
    )

    for episode in episode_rss_list:
        rss.channel.append(bs(episode, "xml"))

    return rss
