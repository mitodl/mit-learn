"""Tests for the warehouse-pull youtube and podcast loading"""

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from learning_resources.constants import (
    LearningResourceRelationTypes,
    LearningResourceType,
    PlatformType,
)
from learning_resources.etl import warehouse_media
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.exceptions import ExtractException
from learning_resources.etl.ownership import Pipeline, writing_as
from learning_resources.factories import (
    ETLSourceOwnershipFactory,
    LearningResourceOfferorFactory,
    LearningResourcePlatformFactory,
    VideoChannelFactory,
    VideoPlaylistFactory,
)
from learning_resources.models import LearningResource, VideoChannel

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def platforms():
    """Create the platforms the loaders look up"""
    return [
        LearningResourcePlatformFactory.create(code=code)
        for code in (PlatformType.youtube.name, PlatformType.podcast.name)
    ]


@pytest.fixture(autouse=True)
def mock_search(mocker):
    """Mock out the search index tasks and the topic lookup"""
    mocker.patch("learning_resources_search.plugins.get_similar_topics_qdrant")
    return SimpleNamespace(
        upsert=mocker.patch("learning_resources_search.tasks.upsert_learning_resource"),
        deindex=mocker.patch("learning_resources_search.tasks.deindex_document"),
        bulk_deindex=mocker.patch(
            "learning_resources_search.tasks.bulk_deindex_learning_resources"
        ),
    )


@pytest.fixture
def warehouse_owns_youtube():
    """Name the warehouse as the owner of the youtube pairs"""
    for resource_type in (
        LearningResourceType.video_playlist.name,
        LearningResourceType.video.name,
    ):
        ETLSourceOwnershipFactory.create(
            etl_source=ETLSource.youtube.name,
            resource_type=resource_type,
            owner=Pipeline.WAREHOUSE,
        )


@pytest.fixture
def warehouse_owns_podcasts():
    """Name the warehouse as the owner of the podcast pairs"""
    for resource_type in (
        LearningResourceType.podcast.name,
        LearningResourceType.podcast_episode.name,
    ):
        ETLSourceOwnershipFactory.create(
            etl_source=ETLSource.podcast.name,
            resource_type=resource_type,
            owner=Pipeline.WAREHOUSE,
        )


def channel_row(channel_id="UC-mitx"):
    """Row of integrations__learn__youtube_channels"""
    return {
        "channel_id": channel_id,
        "title": f"Channel {channel_id}",
        "offered_by": "mitx",
        "etl_source": "youtube",
        "published": 1,
        "dlt_load_id": "1759300000.1",
    }


def playlist_row(readable_id="PL-one", channel_id="UC-mitx", **overrides):
    """Row of integrations__learn__youtube_playlists"""
    return {
        "readable_id": readable_id,
        "channel_id": channel_id,
        "title": f"Playlist {readable_id}",
        "url": f"https://www.youtube.com/playlist?list={readable_id}",
        "image_url": "https://i.ytimg.com/vi/abc/hqdefault.jpg",
        "image_alt": f"Playlist {readable_id}",
        "offered_by": "mitx",
        "create_videos": 1,
        "etl_source": "youtube",
        "platform": "youtube",
        "resource_type": "video_playlist",
        "availability": "anytime",
        "published": 1,
        "dlt_load_id": "1759300000.1",
        **overrides,
    }


def video_row(readable_id="vid-1", **overrides):
    """Row of integrations__learn__youtube_videos"""
    return {
        "readable_id": readable_id,
        "youtube_id": readable_id,
        "title": f"Video {readable_id}",
        "description_raw": (
            "About <b>the</b> video.<script>x()</script>\n"
            "License: Creative Commons BY-NC-SA\n"
            "More at https://ocw.mit.edu"
        ),
        "url": f"https://www.youtube.com/watch?v={readable_id}",
        "image_url": f"https://i.ytimg.com/vi/{readable_id}/hqdefault.jpg",
        "last_modified": "2024-05-01T12:00:00Z",
        "duration": "PT1H2M3S",
        "etl_source": "youtube",
        "platform": "youtube",
        "resource_type": "video",
        "availability": "anytime",
        "published": 1,
        **overrides,
    }


def membership_row(playlist, video, position):
    """Row of integrations__learn__youtube_playlist_videos"""
    return {
        "playlist_readable_id": playlist,
        "video_readable_id": video,
        "position": position,
    }


def podcast_row(readable_id="feeds.example.com/mit/", **overrides):
    """Row of integrations__learn__podcasts"""
    return {
        "readable_id": readable_id,
        "title": "MIT Podcast",
        "description": 'About <a href="https://example.com">MIT</a><script>x()</script>',
        "url": "https://example.com/mit-podcast",
        "image_url": "https://example.com/cover.png",
        "topics": "Science, Engineering",
        "offered_by": "MIT Open Learning",
        "rss_url": f"https://{readable_id}",
        "apple_podcasts_url": "https://podcasts.apple.com/mit",
        "google_podcasts_url": None,
        "last_modified": "2026-10-01T06:00:00Z",
        "etl_source": "podcast",
        "platform": "podcast",
        "resource_type": "podcast",
        "availability": "anytime",
        "published": 1,
        **overrides,
    }


def episode_row(readable_id="guid-1", podcast="feeds.example.com/mit/", **overrides):
    """Row of integrations__learn__podcast_episodes"""
    return {
        "readable_id": readable_id,
        "podcast_readable_id": podcast,
        "title": f"Episode {readable_id}",
        "description": "The <i>first</i> episode.",
        "url": f"https://example.com/{readable_id}",
        "audio_url": f"https://example.com/{readable_id}.mp3",
        "episode_link": f"https://example.com/{readable_id}",
        "image_url": None,
        "duration_raw": "72:59",
        "published_on_raw": "Wed, 01 May 2024 12:00:00 +0000",
        "rss": "<item><guid>guid-1</guid></item>",
        "topics": "Science, Engineering",
        "offered_by": "MIT Open Learning",
        "etl_source": "podcast",
        "platform": "podcast",
        "resource_type": "podcast_episode",
        "availability": "anytime",
        "published": 1,
        **overrides,
    }


def test_transform_youtube_video_matches_transform_video():
    """The dict has transform_video's keys, with the description cleaned as it is there"""
    LearningResourceOfferorFactory.create(is_mitx=True)

    assert warehouse_media.transform_youtube_video(video_row(), "mitx") == {
        "readable_id": "vid-1",
        "platform": "youtube",
        "etl_source": "youtube",
        "resource_type": "video",
        "title": "Video vid-1",
        "description": "About <b>the</b> video.",
        "image": {"url": "https://i.ytimg.com/vi/vid-1/hqdefault.jpg"},
        "last_modified": "2024-05-01T12:00:00+00:00",
        "url": "https://www.youtube.com/watch?v=vid-1",
        "offered_by": {"code": "mitx"},
        "published": True,
        "video": {"duration": "PT1H2M3S"},
        "availability": "anytime",
        "youtube_id": "vid-1",
    }


@pytest.mark.parametrize(
    "stored",
    [
        "2024-05-01T12:00:00Z",
        "2024-05-01T12:00:00.000",
        "2024-05-01T08:00:00-04:00",
        datetime(2024, 5, 1, 12, 0),  # noqa: DTZ001
    ],
)
def test_transform_youtube_video_reads_last_modified_as_utc(stored):
    """A warehouse timestamp with no zone is UTC"""
    video = warehouse_media.transform_youtube_video(
        video_row(last_modified=stored), "mitx"
    )
    assert datetime.fromisoformat(video["last_modified"]) == datetime(
        2024, 5, 1, 12, 0, tzinfo=UTC
    )
    assert datetime.fromisoformat(video["last_modified"]).tzinfo is not None


@pytest.mark.parametrize(
    ("offered_by", "expected"), [("not-an-offeror", None), (None, None)]
)
def test_transform_youtube_video_drops_an_unknown_offered_by(offered_by, expected):
    """parse_offered_by returns None for a code outside OfferedBy"""
    video = warehouse_media.transform_youtube_video(video_row(), offered_by)
    assert video["offered_by"] is expected


@pytest.mark.parametrize(("stored", "expected"), [(1, True), (0, False)])
def test_transform_youtube_playlist(stored, expected):
    """The dict has transform_playlist's keys, and create_videos is a bool"""
    playlist = warehouse_media.transform_youtube_playlist(
        playlist_row(create_videos=stored), [video_row("vid-a"), video_row("vid-b")]
    )

    assert set(playlist) == {
        "playlist_id",
        "title",
        "published",
        "platform",
        "etl_source",
        "offered_by",
        "videos",
        "url",
        "image",
        "availability",
        "create_videos",
    }
    assert playlist["playlist_id"] == "PL-one"
    assert playlist["create_videos"] is expected
    assert playlist["image"] == {
        "url": "https://i.ytimg.com/vi/abc/hqdefault.jpg",
        "alt": "Playlist PL-one",
    }
    assert [video["readable_id"] for video in playlist["videos"]] == ["vid-a", "vid-b"]
    assert playlist["videos"][0]["offered_by"] == playlist["offered_by"]


def sync_and_load_youtube(*views):
    """
    Run the channel sync and load each playlist it returns, as the task does.
    Returns the (channel id, playlist id) pairs that were loaded.
    """
    with writing_as(Pipeline.WAREHOUSE):
        to_load = warehouse_media.sync_youtube_channels(*views)
        # load_playlist pops the keys it reads
        loaded = [(channel_id, data["playlist_id"]) for channel_id, data in to_load]
        for channel_id, playlist_data in to_load:
            warehouse_media.loaders.load_playlist(
                VideoChannel.objects.get(channel_id=channel_id), playlist_data
            )
    return loaded


def test_sync_youtube_loads_playlists_and_videos_in_order(warehouse_owns_youtube):
    """Channels, playlists and videos are created, with the videos in position order"""
    to_load = sync_and_load_youtube(
        [channel_row()],
        [playlist_row("PL-one"), playlist_row("PL-two")],
        [
            membership_row("PL-one", "vid-b", 1),
            membership_row("PL-one", "vid-a", 0),
            membership_row("PL-two", "vid-a", 0),
        ],
        [video_row("vid-a"), video_row("vid-b")],
    )

    assert to_load == [("UC-mitx", "PL-one"), ("UC-mitx", "PL-two")]
    channel = VideoChannel.objects.get(channel_id="UC-mitx")
    assert channel.title == "Channel UC-mitx"
    assert channel.published is True

    playlist = LearningResource.objects.get(
        readable_id="PL-one", resource_type=LearningResourceType.video_playlist.name
    )
    assert playlist.published is True
    assert playlist.video_playlist.channel == channel
    assert list(
        playlist.children.filter(
            relation_type=LearningResourceRelationTypes.PLAYLIST_VIDEOS.value
        )
        .order_by("position")
        .values_list("child__readable_id", flat=True)
    ) == ["vid-a", "vid-b"]

    video = LearningResource.objects.get(
        readable_id="vid-a", resource_type=LearningResourceType.video.name
    )
    assert video.description == "About <b>the</b> video."
    assert video.video.duration == "PT1H2M3S"
    assert video.last_modified == datetime(2024, 5, 1, 12, 0, tzinfo=UTC)


def test_sync_youtube_unpublishes_what_the_views_no_longer_list(
    warehouse_owns_youtube,
):
    """A playlist gone from its channel and a channel gone from the view are unpublished"""
    kept_channel = VideoChannelFactory.create(
        channel_id="UC-mitx", etl_source=ETLSource.youtube.name, published=True
    )
    removed_playlist = VideoPlaylistFactory.create(
        channel=kept_channel
    ).learning_resource
    removed_channel = VideoChannelFactory.create(
        etl_source=ETLSource.youtube.name, published=True
    )
    orphaned_playlist = VideoPlaylistFactory.create(
        channel=removed_channel
    ).learning_resource

    sync_and_load_youtube(
        [channel_row()],
        [playlist_row("PL-one")],
        [membership_row("PL-one", "vid-a", 0)],
        [video_row("vid-a")],
    )

    removed_playlist.refresh_from_db()
    orphaned_playlist.refresh_from_db()
    removed_channel.refresh_from_db()
    assert removed_playlist.published is False
    assert orphaned_playlist.published is False
    assert removed_channel.published is False


def test_sync_youtube_keeps_a_channel_with_no_playlists(warehouse_owns_youtube):
    """A channel the view lists stays published when no playlist is under it"""
    to_load = sync_and_load_youtube(
        [channel_row(), channel_row("UC-empty")],
        [playlist_row("PL-one")],
        [membership_row("PL-one", "vid-a", 0)],
        [video_row("vid-a")],
    )

    assert len(to_load) == 1
    assert VideoChannel.objects.get(channel_id="UC-empty").published is True


def test_sync_youtube_does_nothing_unless_the_warehouse_owns_youtube():
    """With no ownership row the legacy ETL owns youtube, and nothing is written"""
    to_load = sync_and_load_youtube(
        [channel_row()],
        [playlist_row()],
        [membership_row("PL-one", "vid-a", 0)],
        [video_row("vid-a")],
    )

    assert to_load == []
    assert not VideoChannel.objects.exists()
    assert not LearningResource.objects.exists()


@pytest.mark.parametrize(
    "empty", ["channels", "playlists", "playlist_videos", "videos"]
)
def test_sync_youtube_refuses_an_empty_view(warehouse_owns_youtube, empty):
    """An empty view would unpublish what it no longer lists, so nothing is loaded"""
    existing = VideoPlaylistFactory.create(
        channel=VideoChannelFactory.create(
            channel_id="UC-mitx", etl_source=ETLSource.youtube.name
        )
    ).learning_resource
    views = {
        "channels": [channel_row()],
        "playlists": [playlist_row()],
        "playlist_videos": [membership_row("PL-one", "vid-a", 0)],
        "videos": [video_row("vid-a")],
    }
    views[empty] = []

    with (
        writing_as(Pipeline.WAREHOUSE),
        pytest.raises(ExtractException, match=f"no rows in {empty}"),
    ):
        warehouse_media.sync_youtube_channels(**views)

    existing.refresh_from_db()
    assert existing.published is True


@pytest.mark.parametrize(
    ("playlists", "memberships", "message"),
    [
        (
            [playlist_row()],
            [membership_row("PL-one", "vid-gone", 0)],
            "PL-one lists video vid-gone",
        ),
        (
            [playlist_row(create_videos=None)],
            [membership_row("PL-one", "vid-a", 0)],
            "PL-one has no create_videos value",
        ),
    ],
)
def test_sync_youtube_writes_nothing_when_a_row_is_bad(
    warehouse_owns_youtube, playlists, memberships, message
):
    """A view out of step with another, or a missing flag, fails before any write"""
    existing = VideoPlaylistFactory.create(
        channel=VideoChannelFactory.create(etl_source=ETLSource.youtube.name)
    ).learning_resource

    with (
        writing_as(Pipeline.WAREHOUSE),
        pytest.raises(ExtractException, match=message),
    ):
        warehouse_media.sync_youtube_channels(
            [channel_row()], playlists, memberships, [video_row("vid-a")]
        )

    existing.refresh_from_db()
    assert existing.published is True
    assert not VideoChannel.objects.filter(channel_id="UC-mitx").exists()


def test_transform_podcast_matches_the_podcast_etl():
    """The dicts have podcast.transform's keys, cleaned and parsed as it does"""
    podcast = warehouse_media.transform_podcast(
        podcast_row(),
        [
            episode_row(),
            episode_row(
                "guid-2",
                image_url="https://example.com/ep2.png",
                duration_raw=None,
                published_on_raw="not a date",
                rss=None,
                description=None,
            ),
        ],
    )
    first, second = podcast.pop("episodes")

    assert podcast == {
        "readable_id": "feeds.example.com/mit/",
        "title": "MIT Podcast",
        "etl_source": "podcast",
        "resource_type": "podcast",
        "offered_by": {"name": "MIT Open Learning"},
        "description": 'About <a href="https://example.com" rel="noopener noreferrer">MIT</a>',
        "image": {"url": "https://example.com/cover.png"},
        "published": True,
        "url": "https://example.com/mit-podcast",
        "topics": [{"name": "Science"}, {"name": "Engineering"}],
        "podcast": {
            "apple_podcasts_url": "https://podcasts.apple.com/mit",
            "google_podcasts_url": None,
            "rss_url": "https://feeds.example.com/mit/",
        },
        "availability": "anytime",
    }
    assert first == {
        "readable_id": "guid-1",
        "etl_source": "podcast",
        "resource_type": "podcast_episode",
        "title": "Episode guid-1",
        "offered_by": {"name": "MIT Open Learning"},
        "description": "The <i>first</i> episode.",
        "url": "https://example.com/guid-1",
        "image": {"url": "https://example.com/cover.png"},
        "last_modified": datetime(2024, 5, 1, 12, 0, tzinfo=UTC),
        "published": True,
        "topics": [{"name": "Science"}, {"name": "Engineering"}],
        "podcast_episode": {
            "audio_url": "https://example.com/guid-1.mp3",
            "episode_link": "https://example.com/guid-1",
            "duration": "PT1H12M59S",
            "rss": "<item><guid>guid-1</guid></item>",
        },
        "availability": "anytime",
    }
    assert second["image"] == {"url": "https://example.com/ep2.png"}
    assert second["description"] is None
    assert second["last_modified"] is None
    assert second["podcast_episode"] == {
        "audio_url": "https://example.com/guid-2.mp3",
        "episode_link": "https://example.com/guid-2",
        "duration": None,
    }


def test_sync_podcasts_loads_and_unpublishes(warehouse_owns_podcasts):
    """Podcasts and episodes are created, and one gone from the view is unpublished"""
    LearningResourceOfferorFactory.create(name="MIT Open Learning")
    with writing_as(Pipeline.WAREHOUSE):
        warehouse_media.sync_podcasts(
            [podcast_row(), podcast_row("feeds.example.com/gone/")],
            [
                episode_row("guid-1"),
                episode_row("guid-2"),
                episode_row("guid-3", podcast="feeds.example.com/gone/"),
            ],
        )
        loaded = warehouse_media.sync_podcasts([podcast_row()], [episode_row("guid-1")])

    assert loaded == 1
    podcast = LearningResource.objects.get(
        readable_id="feeds.example.com/mit/",
        resource_type=LearningResourceType.podcast.name,
    )
    assert podcast.published is True
    assert podcast.offered_by.name == "MIT Open Learning"
    published = dict(
        LearningResource.objects.filter(
            resource_type=LearningResourceType.podcast_episode.name
        ).values_list("readable_id", "published")
    )
    assert published == {"guid-1": True, "guid-2": False, "guid-3": False}
    assert (
        LearningResource.objects.get(readable_id="feeds.example.com/gone/").published
        is False
    )
    episode = LearningResource.objects.get(readable_id="guid-1")
    assert episode.podcast_episode.duration == "PT1H12M59S"
    assert episode.podcast_episode.rss == "<item><guid>guid-1</guid></item>"


def test_sync_podcasts_does_nothing_unless_the_warehouse_owns_podcasts():
    """With no ownership row the legacy ETL owns podcasts, and nothing is written"""
    with writing_as(Pipeline.WAREHOUSE):
        loaded = warehouse_media.sync_podcasts([podcast_row()], [episode_row()])

    assert loaded == 0
    assert not LearningResource.objects.exists()


@pytest.mark.parametrize("empty", ["podcasts", "episodes"])
def test_sync_podcasts_refuses_an_empty_view(warehouse_owns_podcasts, empty):
    """An empty episodes view would unpublish every podcast, so nothing is loaded"""
    views = {"podcasts": [podcast_row()], "episodes": [episode_row()]}
    with writing_as(Pipeline.WAREHOUSE):
        warehouse_media.sync_podcasts(**views)
    views[empty] = []

    with (
        writing_as(Pipeline.WAREHOUSE),
        pytest.raises(ExtractException, match=f"no rows in {empty}"),
    ):
        warehouse_media.sync_podcasts(**views)

    assert LearningResource.objects.filter(published=True).count() == 2


def test_sync_podcasts_skips_a_podcast_with_an_untitled_episode(
    warehouse_owns_podcasts,
):
    """The podcast keeps what it had, and the others are loaded"""
    views = (
        [podcast_row(), podcast_row("feeds.example.com/other/")],
        [
            episode_row("guid-1"),
            episode_row("guid-2", podcast="feeds.example.com/other/"),
        ],
    )
    with writing_as(Pipeline.WAREHOUSE):
        assert warehouse_media.sync_podcasts(*views) == 2
        views[1].append(episode_row("guid-3", title=None))
        assert warehouse_media.sync_podcasts(*views) == 1

    assert not LearningResource.objects.filter(readable_id="guid-3").exists()
    assert (
        LearningResource.objects.filter(
            readable_id__in=["feeds.example.com/mit/", "guid-1", "guid-2"],
            published=True,
        ).count()
        == 3
    )
