"""Tests for the populate_topic_descriptions management command"""

import csv
import io
from io import StringIO

import pytest
from django.core.management import call_command

from channels.factories import ChannelTopicDetailFactory
from learning_resources.factories import LearningResourceTopicFactory
from learning_resources.management.commands.populate_topic_descriptions import (
    DEFAULT_SHEET_CSV_URL,
)
from learning_resources.models import LearningResourceTopic

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _no_seeded_topics():
    """Remove the real topics that data migrations seed, before each test."""
    LearningResourceTopic.objects.all().delete()


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


def test_sets_description_on_topic_channel(mocked_responses, mocker):
    """The 'Page' text becomes the matching topic channel's description"""
    clear_cache = mocker.patch(
        "learning_resources.management.commands.populate_topic_descriptions.clear_views_cache"
    )
    channel = _topic_channel("Architecture", "old")

    output = _run(
        mocked_responses, ("Architecture", "  Explore architecture courses.  ")
    )

    channel.refresh_from_db()
    assert channel.public_description == "Explore architecture courses."
    assert "Updated 'Architecture'" in output
    clear_cache.assert_called_once()


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


def test_dry_run_saves_nothing(mocked_responses, mocker):
    """--dry-run reports the change without saving it"""
    clear_cache = mocker.patch(
        "learning_resources.management.commands.populate_topic_descriptions.clear_views_cache"
    )
    channel = _topic_channel("Music", "old")

    output = _run(mocked_responses, ("Music", "New."), dry_run=True)

    channel.refresh_from_db()
    assert channel.public_description == "old"
    assert "Would update 'Music'" in output
    assert "[dry run] 1 updated" in output
    clear_cache.assert_not_called()
