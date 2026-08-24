"""Tests for Podcast ETL functions"""

import datetime
from unittest.mock import Mock

import pytest
import yaml
from bs4 import BeautifulSoup as bs  # noqa: N813
from dateutil.tz import tzutc
from django.conf import settings
from freezegun import freeze_time
from requests.exceptions import HTTPError

from learning_resources.constants import Availability, LearningResourceType, OfferedBy
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.podcast import (
    extract,
    generate_aggregate_podcast_rss,
    get_podcast_episodes_for_transcripts_job,
    get_podcast_transcripts,
    github_podcast_config_files,
    transform,
    transform_episode,
    validate_podcast_config,
)
from learning_resources.factories import (
    PodcastEpisodeFactory,
)
from learning_resources.models import LearningResource
from main.utils import frontend_absolute_url

pytestmark = pytest.mark.django_db


@pytest.fixture
def mock_github_client(mocker):
    """Return a mock github client"""
    return mocker.patch("github.Github")


def rss_content():
    """Test rss data"""

    with open("./test_html/test_podcast.rss") as f:  # noqa: PTH123
        return f.read()


def mock_podcast_file(  # pylint: disable=too-many-arguments  # noqa: PLR0913
    podcast_title=None,
    topics=None,
    website_url="http://website.url/podcast",
    offered_by=None,
    google_podcasts_url="google_podcasts_url",
    apple_podcasts_url="apple_podcasts_url",
    rss_url="http://website.url/podcast/rss.xml",
):
    """Mock podcast github file"""

    content = f"""---
rss_url: {rss_url}
{"podcast_title: " + podcast_title if podcast_title else ""}
{"topics: " + topics if topics else ""}
{"offered_by: " + offered_by if offered_by else ""}
website:  {website_url}
google_podcasts_url: {google_podcasts_url}
apple_podcasts_url: {apple_podcasts_url}
"""
    return Mock(decoded_content=content)


@pytest.fixture
def mock_rss_request(mocker):
    """
    Mock request data
    """

    mocker.patch(
        "learning_resources.etl.podcast.requests.get",
        side_effect=[mocker.Mock(content=rss_content())],
    )


@pytest.fixture
def mock_rss_request_with_bad_rss_file(mocker):
    """
    Mock request data
    """

    mocker.patch(
        "learning_resources.etl.podcast.requests.get",
        side_effect=[mocker.Mock(content=""), mocker.Mock(content=rss_content())],
    )


@pytest.mark.usefixtures("mock_rss_request")
def test_extract(mock_github_client):
    """Test extract function"""

    podcast_list = [mock_podcast_file()]
    mock_github_client.return_value.get_repo.return_value.get_contents.return_value = (
        podcast_list
    )

    results = list(extract())

    expected_content = bs(rss_content(), "xml")
    mock_config = mock_podcast_file()

    assert len(results) == 1

    assert results == [(expected_content, yaml.safe_load(mock_config.decoded_content))]


@pytest.mark.usefixtures("mock_rss_request")
@pytest.mark.parametrize("title", [None, "Custom Title"])
@pytest.mark.parametrize("topics", [None, "Science,  Technology"])
@pytest.mark.parametrize("offered_by", [None, OfferedBy.ocw.value, "fake"])
def test_transform(mock_github_client, title, topics, offered_by):
    """Test transform function"""
    podcast_list = [mock_podcast_file(title, topics, "website_url", offered_by)]
    mock_github_client.return_value.get_repo.return_value.get_contents.return_value = (
        podcast_list
    )

    expected_topics = (
        [{"name": topic.strip()} for topic in topics.split(",")] if topics else []
    )

    expected_title = title if title else "A Podcast"

    expected_offered_by = {"name": offered_by} if offered_by else None

    episodes_rss = list(bs(rss_content(), "xml").find_all("item"))

    expected_results = [
        {
            "readable_id": "website.url/podcast/rss.xml",
            "etl_source": ETLSource.podcast.name,
            "title": expected_title,
            "offered_by": expected_offered_by,
            "description": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            "image": {"url": "apicture.jpg"},
            "published": True,
            "url": "website_url",
            "podcast": {
                "google_podcasts_url": "google_podcasts_url",
                "apple_podcasts_url": "apple_podcasts_url",
                "rss_url": "http://website.url/podcast/rss.xml",
            },
            "resource_type": LearningResourceType.podcast.name,
            "topics": expected_topics,
            "availability": Availability.anytime.name,
            "episodes": [
                {
                    "readable_id": "tag:soundcloud,2010:tracks/numbers1",
                    "etl_source": ETLSource.podcast.name,
                    "title": "Episode1",
                    "availability": Availability.anytime.name,
                    "offered_by": expected_offered_by,
                    "description": (
                        "SMorbi id consequat nisl. Morbi leo elit, vulputate nec"
                        " aliquam molestie, ullamcorper sit amet tortor"
                    ),
                    "url": "https://soundcloud.com/podcast/episode1",
                    "image": {"url": "apicture.jpg"},
                    "last_modified": datetime.datetime(
                        2020, 4, 1, 18, 20, 31, tzinfo=tzutc()
                    ),
                    "published": True,
                    "podcast_episode": {
                        "audio_url": "http://feeds.soundcloud.com/stream/episode1.mp3",
                        "episode_link": "https://soundcloud.com/podcast/episode1",
                        "duration": "PT17M16S",
                        "rss": episodes_rss[0].prettify(),
                    },
                    "resource_type": LearningResourceType.podcast_episode.name,
                    "topics": expected_topics,
                },
                {
                    "readable_id": "tag:soundcloud,2010:tracks/numbers2",
                    "etl_source": ETLSource.podcast.name,
                    "title": "Episode2",
                    "availability": Availability.anytime.name,
                    "offered_by": expected_offered_by,
                    "description": (
                        "Praesent fermentum suscipit metus nec aliquam. Proin hendrerit"
                        " felis ut varius facilisis."
                    ),
                    "url": "https://soundcloud.com/podcast/episode2",
                    "image": {"url": "image1.jpg"},
                    "last_modified": datetime.datetime(
                        2020, 4, 1, 18, 20, 31, tzinfo=tzutc()
                    ),
                    "published": True,
                    "podcast_episode": {
                        "audio_url": "http://feeds.soundcloud.com/stream/episode2.mp3",
                        "episode_link": "https://soundcloud.com/podcast/episode2",
                        "duration": "PT17M16S",
                        "rss": episodes_rss[1].prettify(),
                    },
                    "resource_type": LearningResourceType.podcast_episode.name,
                    "topics": expected_topics,
                },
            ],
        }
    ]

    extract_results = extract()

    results = list(transform(extract_results))

    assert [
        {**podcast, "episodes": list(podcast["episodes"])} for podcast in results
    ] == expected_results


@pytest.mark.usefixtures("mock_rss_request_with_bad_rss_file")
def test_transform_with_error(mocker, mock_github_client):
    """Test transform function with bad rss file"""

    mock_exception_log = mocker.patch("learning_resources.etl.podcast.log.exception")

    podcast_list = [mock_podcast_file(None, None, "website_url2"), mock_podcast_file()]
    mock_github_client.return_value.get_repo.return_value.get_contents.return_value = (
        podcast_list
    )

    extract_results = extract()

    results = list(transform(extract_results))

    mock_exception_log.assert_called_once_with(
        "Error parsing podcast data from %s", "http://website.url/podcast/rss.xml"
    )

    assert len(results) == 1
    assert results[0]["url"] == "http://website.url/podcast"


def test_extract_connection_reset_error(mocker, mock_github_client):
    """Test extract handles ConnectionResetError gracefully"""
    mock_warning_log = mocker.patch("learning_resources.etl.podcast.log.warning")
    mocker.patch(
        "learning_resources.etl.podcast.requests.get",
        side_effect=ConnectionResetError,
    )
    podcast_list = [mock_podcast_file()]
    mock_github_client.return_value.get_repo.return_value.get_contents.return_value = (
        podcast_list
    )

    results = list(extract())

    assert results == []
    mock_warning_log.assert_called_once_with(
        "Connection reset error for rss url %s", "http://website.url/podcast/rss.xml"
    )


@pytest.mark.parametrize("exception_cls", [ConnectionError, HTTPError])
def test_extract_connection_error(mocker, mock_github_client, exception_cls):
    """Test extract handles ConnectionError and HTTPError gracefully"""
    mock_exception_log = mocker.patch("learning_resources.etl.podcast.log.exception")
    mocker.patch(
        "learning_resources.etl.podcast.requests.get",
        side_effect=exception_cls,
    )
    podcast_list = [mock_podcast_file()]
    mock_github_client.return_value.get_repo.return_value.get_contents.return_value = (
        podcast_list
    )

    results = list(extract())

    assert results == []
    mock_exception_log.assert_called_once_with(
        "Invalid rss url %s", "http://website.url/podcast/rss.xml"
    )


@pytest.mark.django_db
@freeze_time("2020-07-20")
def test_generate_aggregate_podcast_rss():
    """Test generate_aggregate_podcast_rss"""
    resource_1 = PodcastEpisodeFactory.create(
        rss="<item>rss1</item>",
    ).learning_resource
    resource_2 = PodcastEpisodeFactory.create(
        rss="<item>rss2</item>",
    ).learning_resource
    resource_1.last_modified = datetime.datetime(2020, 2, 1, tzinfo=datetime.UTC)
    resource_1.save()
    resource_2.last_modified = datetime.datetime(2020, 1, 1, tzinfo=datetime.UTC)
    resource_2.save()

    podcasts_url = frontend_absolute_url("/podcasts")
    cover_image_url = frontend_absolute_url("/static/images/podcast_cover_art.png")

    expected_rss = f"""<?xml version='1.0' encoding='UTF-8'?>
    <rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">
        <channel>
            <title>MIT Learn Aggregated Podcast Feed</title>
            <link>{podcasts_url}</link>
            <language>en-us</language>
            <pubDate>Mon, 20 Jul 2020  00:00:00 +0000</pubDate>
            <lastBuildDate>Mon, 20 Jul 2020  00:00:00 +0000</lastBuildDate>
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
            <itunes:category text="Education"/>
            <item>rss1</item>
            <item>rss2</item>
        </channel>
    </rss>"""

    result = generate_aggregate_podcast_rss().prettify()

    assert result == bs(expected_rss, "xml").prettify()


def test_github_podcast_config_files(settings, mock_github_client):
    """Test the logic for retrieving podcast config files from github"""
    mock_github_client.return_value.get_repo.return_value.get_contents.return_value = [
        mock_podcast_file(),
        mock_podcast_file(),
    ]

    results = github_podcast_config_files()

    assert len(results) == 2


@pytest.mark.parametrize(
    ("config", "errors"),
    [
        ({}, ["podcast config data is empty"]),
        (
            [{"rss_url": "http://test.edu"}, {"website": "http://test.edu"}],
            ["Podcast data should be a dict"],
        ),
        (None, ["podcast config data is empty"]),
        ({"rss_url": "http://test.edu", "website": "http://test.edu"}, []),
    ],
)
def test_validate_podcast_config(config, errors):
    """Test the logic for validating podcast config files"""
    assert validate_podcast_config(config) == errors


@pytest.mark.parametrize(
    ("rss", "expected"),
    [
        # Feed declared xmlns:podcast, so prettify() kept the prefix.
        ('<item><podcast:transcript url="https://x/t.vtt"/></item>', True),
        # Feed omitted the declaration, so lxml dropped the prefix on the way in.
        ('<item><transcript url="https://x/t.vtt"/></item>', True),
        # A description that merely mentions a transcript must not be selected.
        ("<item><description>Full transcript at our site</description></item>", False),
        ("<item><title>No tags</title></item>", False),
        (None, False),
    ],
)
def test_get_podcast_episodes_for_transcripts_job_selection(rss, expected):
    """Only episodes whose stored feed XML opens a transcript tag are candidates"""
    episode = PodcastEpisodeFactory.create(rss=rss, transcript="")
    selected = get_podcast_episodes_for_transcripts_job().filter(
        id=episode.learning_resource_id
    )
    assert selected.exists() is expected


@pytest.mark.parametrize("overwrite", [True, False])
def test_get_podcast_episodes_for_transcripts_job_overwrite(overwrite):
    """A populated transcript is only re-fetched when overwrite is set"""
    episode = PodcastEpisodeFactory.create(
        rss='<item><podcast:transcript url="https://x/t.vtt"/></item>',
        transcript="already fetched",
    )
    selected = get_podcast_episodes_for_transcripts_job(overwrite=overwrite).filter(
        id=episode.learning_resource_id
    )
    assert selected.exists() is overwrite


def test_get_podcast_episodes_for_transcripts_job_excludes_unpublished():
    """Unpublished episodes are never candidates"""
    episode = PodcastEpisodeFactory.create(
        is_unpublished=True,
        rss='<item><podcast:transcript url="https://x/t.vtt"/></item>',
        transcript="",
    )
    assert (
        not get_podcast_episodes_for_transcripts_job()
        .filter(id=episode.learning_resource_id)
        .exists()
    )


def test_get_podcast_transcripts_saves_and_reindexes(mocker):
    """A fetched transcript is saved and the resource reindexed"""
    mocker.patch(
        "learning_resources.etl.podcast.fetch_transcript",
        return_value="Host: the transcript.",
    )
    mock_update_index = mocker.patch("learning_resources.etl.podcast.update_index")
    episode = PodcastEpisodeFactory.create(
        rss='<item><podcast:transcript url="https://x/t.vtt" type="text/vtt"/></item>',
        transcript="",
    )

    get_podcast_transcripts(
        LearningResource.objects.filter(id=episode.learning_resource_id)
    )

    episode.refresh_from_db()
    assert episode.transcript == "Host: the transcript."
    mock_update_index.assert_called_once()


def test_get_podcast_transcripts_skips_when_fetch_returns_nothing(mocker):
    """A failed fetch leaves the transcript empty and does not reindex"""
    mocker.patch("learning_resources.etl.podcast.fetch_transcript", return_value="")
    mock_update_index = mocker.patch("learning_resources.etl.podcast.update_index")
    episode = PodcastEpisodeFactory.create(
        rss='<item><podcast:transcript url="https://x/t.vtt"/></item>', transcript=""
    )

    get_podcast_transcripts(
        LearningResource.objects.filter(id=episode.learning_resource_id)
    )

    episode.refresh_from_db()
    assert episode.transcript == ""
    mock_update_index.assert_not_called()


def test_get_podcast_transcripts_survives_one_bad_episode(mocker):
    """One episode raising must not abort the batch"""
    mocker.patch(
        "learning_resources.etl.podcast.fetch_transcript",
        side_effect=[ValueError("boom"), "Host: the second one."],
    )
    mocker.patch("learning_resources.etl.podcast.update_index")
    rss = '<item><podcast:transcript url="https://x/t.vtt"/></item>'
    first = PodcastEpisodeFactory.create(rss=rss, transcript="")
    second = PodcastEpisodeFactory.create(rss=rss, transcript="")

    get_podcast_transcripts(
        LearningResource.objects.filter(
            id__in=[first.learning_resource_id, second.learning_resource_id]
        ).order_by("id")
    )

    first.refresh_from_db()
    second.refresh_from_db()
    assert first.transcript == ""
    assert second.transcript == "Host: the second one."


def test_transform_episode_omits_transcript(mock_github_client):
    """
    transform_episode must never emit a `transcript` key.

    load_podcast_episode passes the podcast_episode dict to
    update_or_create(defaults=...), so including it would blank every fetched
    transcript on the next ETL run.
    """
    podcast_list = [mock_podcast_file()]
    mock_github_client.return_value.get_repo.return_value.get_contents.return_value = (
        podcast_list
    )
    item = bs(rss_content(), "xml").find("item")
    assert (
        "transcript" not in transform_episode(item, None, [], None)["podcast_episode"]
    )
