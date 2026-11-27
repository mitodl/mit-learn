"""Tests for the populate_topic_descriptions management command"""

import csv
import io
from io import StringIO
from types import SimpleNamespace

import pytest
from django.core.management import CommandError, call_command

from channels.factories import ChannelTopicDetailFactory
from learning_resources.factories import LearningResourceTopicFactory
from learning_resources.management.commands.populate_topic_descriptions import (
    DEFAULT_SHEET_CSV_URL,
)
from learning_resources.models import LearningResourceTopic

COMMAND_MODULE = "learning_resources.management.commands.populate_topic_descriptions"

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _no_seeded_topics():
    """Remove the real topics that data migrations seed, before each test."""
    LearningResourceTopic.objects.all().delete()


@pytest.fixture(autouse=True)
def cache_clears(mocker):
    """Patch the Redis clear and the Fastly purge the command runs after saving"""
    return SimpleNamespace(
        views=mocker.patch(f"{COMMAND_MODULE}.clear_views_cache"),
        pages=mocker.patch(f"{COMMAND_MODULE}.clear_featured_caches"),
    )


def _sheet(*rows):
    """CSV text shaped like the topic copy sheet: name, Page, then extras"""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["", "Page", "Title Tag", "Published?"])
    for name, description in rows:
        writer.writerow([name, description, f"{name} | MIT Learn", "FALSE"])
    return out.getvalue()


def _run(mocked_responses, *rows, dry_run=False):
    """Serve the sheet and run the command, returning its output"""
    mocked_responses.get(DEFAULT_SHEET_CSV_URL, body=_sheet(*rows))
    stdout = StringIO()
    args = ["--dry-run"] if dry_run else []
    call_command("populate_topic_descriptions", *args, stdout=stdout)
    return stdout.getvalue()


def _topic_channel(name, description=""):
    """Create a topic with its channel, and return the channel"""
    return ChannelTopicDetailFactory.create(
        topic=LearningResourceTopicFactory.create(name=name),
        channel__public_description=description,
    ).channel


def test_sets_description_on_topic_channel(mocked_responses, cache_clears):
    """The 'Page' text becomes the matching topic channel's description"""
    channel = _topic_channel("Architecture", "old")

    output = _run(
        mocked_responses, ("Architecture", "  Explore architecture courses.  ")
    )

    channel.refresh_from_db()
    assert channel.public_description == "Explore architecture courses."
    assert "Updated 'Architecture'" in output
    cache_clears.views.assert_called_once()
    # The updated topic page is purged from Fastly.
    cache_clears.pages.assert_called_once_with([channel.channel_url])


@pytest.mark.parametrize(
    ("sheet_name", "topic_name"),
    [
        ("Main Engineering", "Engineering"),
        ("Main Health and Medicine", "Health & Medicine"),
        (
            "Main Data Science, Analytics, & Computer Technology",
            "Data Science, Analytics & Computer Technology",
        ),
        ("Cybersecurity", "CyberSecurity"),
    ],
)
def test_matches_names_loosely(mocked_responses, sheet_name, topic_name):
    """'Main ' prefixes, case, punctuation and '&' vs 'and' don't block a match"""
    channel = _topic_channel(topic_name)

    _run(mocked_responses, (sheet_name, "A description."))

    channel.refresh_from_db()
    assert channel.public_description == "A description."


def test_logs_unknown_topic_and_continues(mocked_responses):
    """A row matching no topic is logged, and later rows still apply"""
    channel = _topic_channel("Physics")

    output = _run(
        mocked_responses, ("Startps/New Enterprises", "Typo."), ("Physics", "Physics.")
    )

    assert "Topic not found: 'Startps/New Enterprises'" in output
    channel.refresh_from_db()
    assert channel.public_description == "Physics."
    assert "1 updated, 0 already up to date, 1 skipped" in output


def test_blank_description_keeps_existing(mocked_responses):
    """A row with no 'Page' text doesn't clear the current description"""
    channel = _topic_channel("Religion", "Current text.")

    output = _run(mocked_responses, ("Religion", "  "))

    channel.refresh_from_db()
    assert channel.public_description == "Current text."
    assert "No description in the sheet for 'Religion'" in output


def test_logs_topic_without_channel(mocked_responses):
    """A topic with no channel is logged rather than failing"""
    LearningResourceTopicFactory.create(name="Theater")

    output = _run(mocked_responses, ("Theater", "Theater."))

    assert "Topic 'Theater' has no channel" in output


def test_dry_run_saves_nothing(mocked_responses, cache_clears):
    """--dry-run reports the change without saving or purging anything"""
    channel = _topic_channel("Music", "old")

    output = _run(mocked_responses, ("Music", "New."), dry_run=True)

    channel.refresh_from_db()
    assert channel.public_description == "old"
    assert "Would update 'Music'" in output
    assert "[dry run] 1 updated" in output
    cache_clears.views.assert_not_called()
    cache_clears.pages.assert_not_called()


def test_dry_run_counts_a_repeated_row_as_unchanged(mocked_responses):
    """A topic listed twice counts once, as in a real run"""
    channel = _topic_channel("Music", "old")

    output = _run(mocked_responses, ("Music", "New."), ("Music", "New."), dry_run=True)

    channel.refresh_from_db()
    assert channel.public_description == "old"
    assert output.count("Would update 'Music'") == 1
    assert "[dry run] 1 updated, 1 already up to date, 0 skipped" in output


def test_updates_every_channel_of_a_topic(mocked_responses, cache_clears):
    """A topic with more than one channel has the description set on each"""
    topic = LearningResourceTopicFactory.create(name="Music")
    stale, current = (
        ChannelTopicDetailFactory.create(
            topic=topic, channel__public_description=description
        ).channel
        for description in ("old", "New.")
    )

    output = _run(mocked_responses, ("Music", "New."))

    stale.refresh_from_db()
    assert stale.public_description == "New."
    assert "1 updated, 0 already up to date, 0 skipped" in output
    # Only the channel that changed is purged.
    cache_clears.pages.assert_called_once_with([stale.channel_url])
    current.refresh_from_db()
    assert current.public_description == "New."


def test_no_changes_clears_nothing(mocked_responses, cache_clears):
    """A run that changes nothing leaves the caches alone"""
    _topic_channel("Music", "Same.")

    output = _run(mocked_responses, ("Music", "Same."))

    assert "0 updated, 1 already up to date, 0 skipped" in output
    cache_clears.views.assert_not_called()
    cache_clears.pages.assert_not_called()


def test_purges_only_published_topic_pages(mocked_responses, cache_clears):
    """An unpublished channel has no page to purge, but is still updated"""
    published = _topic_channel("Physics")
    unpublished = _topic_channel("Biology")
    unpublished.published = False
    unpublished.save()

    _run(mocked_responses, ("Physics", "Physics."), ("Biology", "Biology."))

    unpublished.refresh_from_db()
    assert unpublished.public_description == "Biology."
    cache_clears.pages.assert_called_once_with([published.channel_url])


def test_reads_the_sheet_at_url(mocked_responses):
    """--url reads another CSV export instead of the default sheet"""
    channel = _topic_channel("Music")
    url = "https://docs.google.com/spreadsheets/d/other/export?format=csv"
    mocked_responses.get(url, body=_sheet(("Music", "From the other sheet.")))

    call_command("populate_topic_descriptions", "--url", url, stdout=StringIO())

    channel.refresh_from_db()
    assert channel.public_description == "From the other sheet."


def test_empty_sheet_fails(mocked_responses):
    """An empty sheet is an error, not a successful run"""
    mocked_responses.get(DEFAULT_SHEET_CSV_URL, body="")

    with pytest.raises(CommandError, match="is empty"):
        call_command("populate_topic_descriptions", stdout=StringIO())


def test_missing_page_column_fails_and_points_at_sharing(mocked_responses):
    """
    Without a 'Page' column, as when a private sheet returns Google's sign-in
    page, the command fails, mentions sharing, and changes nothing.
    """
    channel = _topic_channel("Music", "old")
    mocked_responses.get(
        DEFAULT_SHEET_CSV_URL, body="<!doctype html><html>Sign in</html>"
    )

    with pytest.raises(CommandError, match="Anyone with the link can view"):
        call_command("populate_topic_descriptions", stdout=StringIO())

    channel.refresh_from_db()
    assert channel.public_description == "old"


def test_failed_redis_clear_still_purges_pages(mocked_responses, cache_clears):
    """
    The descriptions are saved before the caches are cleared, so a re-run
    would find nothing to update: a failed Redis clear still purges the pages,
    then fails the command so the operator knows.
    """
    channel = _topic_channel("Music", "old")
    cache_clears.views.side_effect = ConnectionError("Redis is down")

    with pytest.raises(CommandError, match="cached API responses failed"):
        _run(mocked_responses, ("Music", "New."))

    channel.refresh_from_db()
    assert channel.public_description == "New."
    cache_clears.pages.assert_called_once_with([channel.channel_url])
