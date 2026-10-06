"""Warehouse-pull loading of YouTube and podcast resources.

The OL Data Platform does the extraction: its ``integrations__learn__youtube_*``
and ``integrations__learn__podcast*`` views hold what the YouTube API and the
podcast RSS feeds returned, one flat row per channel, playlist, video, podcast
or episode. The functions here turn those rows into what
``learning_resources.etl.youtube`` and ``learning_resources.etl.podcast``
produce, and hand them to the same loaders the Celery ETL uses.

Each sync is a full sync: the views are the complete current set, and whatever
is absent from them is unpublished. A view that comes back empty is therefore
refused, since the views are built separately and an empty one is a failed
build, not an empty catalog. So is a sync that would unpublish more than
MAX_UNPUBLISH_SHARE of what is published, which is what a partly built view
looks like; a real removal of that size has to be run with the limit lifted.
"""

import logging
from collections import defaultdict

from dateutil.parser import ParserError, parse

from learning_resources.constants import LearningResourceType
from learning_resources.etl import loaders
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.exceptions import ExtractException
from learning_resources.etl.ownership import may_write
from learning_resources.etl.utils import iso8601_duration
from learning_resources.etl.warehouse_guards import (
    refuse_empty,
    refuse_mass_unpublish,
    utc_timestamp,
)
from learning_resources.etl.youtube import clean_youtube_description, parse_offered_by
from main.constants import (
    ALLOWED_HTML_ATTRIBUTES_WITH_LINKS,
    ALLOWED_HTML_TAGS_WITH_LINKS,
)
from main.utils import clean_data

log = logging.getLogger(__name__)


YOUTUBE_TYPES = [
    LearningResourceType.video_playlist.name,
    LearningResourceType.video.name,
]
PODCAST_TYPES = [
    LearningResourceType.podcast.name,
    LearningResourceType.podcast_episode.name,
]


def may_write_youtube() -> bool:
    """Whether the current pipeline owns the youtube playlists and videos"""
    return may_write(ETLSource.youtube.name, YOUTUBE_TYPES)


def may_write_podcasts() -> bool:
    """Whether the current pipeline owns the podcasts and their episodes"""
    return may_write(ETLSource.podcast.name, PODCAST_TYPES)


def transform_youtube_video(row: dict, offered_by_code: str | None) -> dict:
    """
    Map an integrations__learn__youtube_videos row to the dict
    youtube.transform_video returns

    Args:
        row (dict): the warehouse row
        offered_by_code (str): the offered_by code of the playlist being loaded

    Returns:
        dict: normalized video data
    """
    return {
        "readable_id": row["readable_id"],
        "platform": row["platform"],
        "etl_source": row["etl_source"],
        "resource_type": row["resource_type"],
        "title": row["title"],
        "description": clean_youtube_description(clean_data(row["description_raw"])),
        "image": {"url": row["image_url"]},
        "last_modified": utc_timestamp(row["last_modified"]).isoformat(),
        "url": row["url"],
        "offered_by": parse_offered_by(offered_by_code),
        "published": True,
        "video": {"duration": row["duration"]},
        "availability": row["availability"],
        "youtube_id": row["youtube_id"],
    }


def transform_youtube_playlist(row: dict, video_rows: list[dict]) -> dict:
    """
    Map an integrations__learn__youtube_playlists row and its videos to the
    dict youtube.transform_playlist returns

    Args:
        row (dict): the warehouse row
        video_rows (list of dict): the playlist's video rows, in playlist order

    Returns:
        dict: normalized playlist data
    """
    if row["create_videos"] is None:
        # load_playlist reads a missing flag as True, and False sends the
        # playlist down the OCW content file path; neither is a safe guess
        msg = f"Playlist {row['readable_id']} has no create_videos value"
        raise ExtractException(msg)
    return {
        "playlist_id": row["readable_id"],
        "title": row["title"],
        "published": True,
        "platform": row["platform"],
        "etl_source": row["etl_source"],
        "offered_by": parse_offered_by(row["offered_by"]),
        "videos": [
            transform_youtube_video(video_row, row["offered_by"])
            for video_row in video_rows
        ],
        "url": row["url"],
        "image": {"url": row["image_url"], "alt": row["image_alt"]},
        "availability": row["availability"],
        # StarRocks returns a boolean column as 0 or 1
        "create_videos": bool(row["create_videos"]),
    }


def _videos_by_playlist(
    playlist_videos: list[dict], videos: list[dict]
) -> dict[str, list[dict]]:
    """
    Group the video rows by playlist id, in playlist order

    Raises:
        ExtractException: if a playlist lists a video the videos view lacks,
            which is the two views built at different times
    """
    videos_by_id = {video["readable_id"]: video for video in videos}
    videos_by_playlist = defaultdict(list)
    for membership in sorted(
        playlist_videos, key=lambda m: (m["playlist_readable_id"], m["position"])
    ):
        video = videos_by_id.get(membership["video_readable_id"])
        if video is None:
            msg = (
                f"Playlist {membership['playlist_readable_id']} lists video "
                f"{membership['video_readable_id']}, which is not in the videos view"
            )
            raise ExtractException(msg)
        videos_by_playlist[membership["playlist_readable_id"]].append(video)
    return videos_by_playlist


def sync_youtube_channels(
    channels: list[dict],
    playlists: list[dict],
    playlist_videos: list[dict],
    videos: list[dict],
    *,
    allow_mass_unpublish: bool = False,
) -> list[tuple[str, dict]]:
    """
    Upsert the youtube channels of the warehouse views, unpublish the channels
    and playlists the views no longer list, and return the playlists to load.

    The playlists are returned, not loaded, so the caller can load each in a
    task of its own, as get_youtube_channel_data does.

    Args:
        channels (list of dict): rows of integrations__learn__youtube_channels
        playlists (list of dict): rows of integrations__learn__youtube_playlists
        playlist_videos (list of dict):
            rows of integrations__learn__youtube_playlist_videos
        videos (list of dict): rows of integrations__learn__youtube_videos
        allow_mass_unpublish (bool): skip the MAX_UNPUBLISH_SHARE check

    Returns:
        list of (str, dict): the channel id and the load_playlist data of every
            playlist, or an empty list if this pipeline does not own youtube
    """
    if not may_write_youtube():
        return []

    refuse_empty(
        channels=channels,
        playlists=playlists,
        playlist_videos=playlist_videos,
        videos=videos,
    )
    if not allow_mass_unpublish:
        for resource_type, rows in (
            (LearningResourceType.video_playlist.name, playlists),
            (LearningResourceType.video.name, videos),
        ):
            refuse_mass_unpublish(
                ETLSource.youtube.name,
                resource_type,
                {row["readable_id"] for row in rows},
            )

    # transformed before anything is written, so a bad row changes nothing
    videos_by_playlist = _videos_by_playlist(playlist_videos, videos)
    playlists_by_channel = defaultdict(list)
    for playlist in playlists:
        playlists_by_channel[playlist["channel_id"]].append(
            transform_youtube_playlist(
                playlist, videos_by_playlist[playlist["readable_id"]]
            )
        )

    loaders.unpublish_removed_youtube_channels(
        [channel["channel_id"] for channel in channels]
    )

    to_load = []
    for channel in channels:
        channel_id = channel["channel_id"]
        video_channel = loaders.upsert_video_channel(
            {"channel_id": channel_id, "title": channel["title"], "published": True}
        )
        channel_playlists = playlists_by_channel[channel_id]
        loaders.unpublish_removed_playlists(
            video_channel, [playlist["playlist_id"] for playlist in channel_playlists]
        )
        to_load.extend((channel_id, playlist) for playlist in channel_playlists)
    return to_load


def _podcast_topics(raw: str | None) -> list[dict]:
    """Split the comma-separated topics column into topic dicts."""
    if not raw:
        return []
    return [{"name": topic.strip()} for topic in raw.split(",") if topic.strip()]


def _clean_with_links(value: str | None) -> str | None:
    """
    Sanitize an RSS description as the podcast ETL does. A missing description
    stays None: clean_data would make it "", which differs from what the
    Celery ETL stored only by this pipeline having run.
    """
    if not value:
        return value
    return clean_data(
        value,
        tags=ALLOWED_HTML_TAGS_WITH_LINKS,
        attributes=ALLOWED_HTML_ATTRIBUTES_WITH_LINKS,
    )


def _parse_pub_date(raw: str | None):
    """Parse an RSS pubDate, or return None when it is missing or malformed."""
    if not raw:
        return None
    try:
        return parse(raw)
    except (ParserError, OverflowError):
        log.warning("Could not parse podcast episode pubDate %s", raw)
        return None


def transform_podcast_episode(
    row: dict, topics: list[dict], offered_by: dict | None, parent_image: dict | None
) -> dict:
    """
    Map an integrations__learn__podcast_episodes row to the dict
    podcast.transform_episode returns

    Args:
        row (dict): the warehouse row
        topics (list of dict): the topics of the episode's podcast
        offered_by (dict): the offered_by of the episode's podcast
        parent_image (dict): the image of the episode's podcast

    Returns:
        dict: normalized podcast episode data
    """
    podcast_episode = {
        "audio_url": row["audio_url"],
        "episode_link": row["episode_link"],
        "duration": iso8601_duration(row["duration_raw"]),
    }
    # load_podcast_episode passes this dict as update_or_create defaults, so a
    # null would blank the rss the transcript job reads; an absent key leaves it
    if row["rss"]:
        podcast_episode["rss"] = row["rss"]
    return {
        "readable_id": row["readable_id"],
        "etl_source": row["etl_source"],
        "resource_type": row["resource_type"],
        "title": row["title"],
        "offered_by": offered_by,
        "description": _clean_with_links(row["description"]),
        "url": row["url"],
        "image": {"url": row["image_url"]} if row["image_url"] else parent_image,
        "last_modified": _parse_pub_date(row["published_on_raw"]),
        "published": True,
        "topics": topics,
        "podcast_episode": podcast_episode,
        "availability": row["availability"],
    }


def transform_podcast(row: dict, episode_rows: list[dict]) -> dict:
    """
    Map an integrations__learn__podcasts row and its episodes to the dict
    podcast.transform yields

    Args:
        row (dict): the warehouse row
        episode_rows (list of dict): the podcast's episode rows

    Returns:
        dict: normalized podcast data
    """
    topics = _podcast_topics(row["topics"])
    offered_by = {"name": row["offered_by"]} if row["offered_by"] else None
    image = {"url": row["image_url"]} if row["image_url"] else None
    return {
        "readable_id": row["readable_id"],
        "title": row["title"],
        "etl_source": row["etl_source"],
        "resource_type": row["resource_type"],
        "offered_by": offered_by,
        "description": _clean_with_links(row["description"]),
        "image": image,
        "published": True,
        "url": row["url"],
        "topics": topics,
        "episodes": [
            transform_podcast_episode(episode_row, topics, offered_by, image)
            for episode_row in episode_rows
        ],
        "podcast": {
            "apple_podcasts_url": row["apple_podcasts_url"],
            "google_podcasts_url": row["google_podcasts_url"],
            "rss_url": row["rss_url"],
        },
        "availability": row["availability"],
    }


def sync_podcasts(
    podcasts: list[dict], episodes: list[dict], *, allow_mass_unpublish: bool = False
) -> int:
    """
    Load the podcasts and episodes of the warehouse views, and unpublish the
    podcasts and episodes they no longer list.

    The podcasts view is the tracked set: the data platform keeps a podcast in
    it for a few loads after its feed stops answering, so one failed fetch does
    not unpublish it.

    Args:
        podcasts (list of dict): rows of integrations__learn__podcasts
        episodes (list of dict): rows of integrations__learn__podcast_episodes
        allow_mass_unpublish (bool): skip the MAX_UNPUBLISH_SHARE check

    Returns:
        int: the number of podcasts loaded
    """
    if not may_write_podcasts():
        return 0

    refuse_empty(podcasts=podcasts, episodes=episodes)
    if not allow_mass_unpublish:
        for resource_type, rows in (
            (LearningResourceType.podcast.name, podcasts),
            (LearningResourceType.podcast_episode.name, episodes),
        ):
            refuse_mass_unpublish(
                ETLSource.podcast.name,
                resource_type,
                {row["readable_id"] for row in rows},
            )

    episodes_by_podcast = defaultdict(list)
    for episode in episodes:
        episodes_by_podcast[episode["podcast_readable_id"]].append(episode)

    podcasts_data = []
    for podcast in podcasts:
        podcast_episodes = episodes_by_podcast[podcast["readable_id"]]
        untitled = [
            episode["readable_id"]
            for episode in podcast_episodes
            if not episode["title"]
        ]
        if untitled:
            # LearningResource.title is required. podcast.transform fails on such
            # a feed and skips the podcast, which stays tracked and keeps its data
            log.error(
                "Skipping podcast %s: episodes without a title: %s",
                podcast["readable_id"],
                ", ".join(untitled),
            )
            continue
        podcasts_data.append(transform_podcast(podcast, podcast_episodes))

    return len(
        loaders.load_podcasts(
            podcasts_data,
            tracked_ids=[podcast["readable_id"] for podcast in podcasts],
        )
    )
