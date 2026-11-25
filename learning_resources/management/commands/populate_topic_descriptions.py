"""Management command to set topic descriptions from a Google Sheet"""

import csv
import io
import re
from collections import Counter

import requests
from django.conf import settings
from django.core.management import BaseCommand, CommandError

from channels.api import clear_featured_caches
from learning_resources.models import LearningResourceTopic
from main.utils import clear_views_cache

# The topic page copy sheet, exported as CSV. It has to be shared as "anyone
# with the link can view" for the export to work without credentials.
DEFAULT_SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1s1zpk-05B6PNR1OyPmusHxyElUvMSHRDw3kp5AeiAsw/export?format=csv&gid=0"
)
DESCRIPTION_COLUMN = "Page"
# The sheet marks top-level topics as e.g. "Main Engineering".
PARENT_TOPIC_PREFIX = "Main "

UPDATED = "updated"
UNCHANGED = "unchanged"
SKIPPED = "skipped"


def normalize_topic_name(name: str) -> str:
    """
    Reduce a topic name to a form that ignores case, punctuation and "&"/"and",
    so "Health and Medicine" matches "Health & Medicine".
    """
    name = name.lower().replace("&", " and ")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", name).split())


class Command(BaseCommand):
    """Set the description on each topic's channel from the topic copy sheet"""

    help = (
        "Set topic descriptions (the topic channel's public_description) from "
        "the 'Page' column of the topic copy Google Sheet, matching rows to "
        "topics by name. Rows that match no topic are logged and skipped."
    )

    def add_arguments(self, parser):
        """Add the sheet URL and dry-run options"""
        parser.add_argument(
            "--url",
            dest="url",
            default=DEFAULT_SHEET_CSV_URL,
            help="CSV export URL of the sheet (defaults to the topic copy sheet)",
        )
        parser.add_argument(
            "--dry-run",
            dest="dry_run",
            action="store_true",
            help="Report what would change without saving anything",
        )

    def handle(self, *args, **options):  # noqa: ARG002
        """Read the sheet and update matching topic channels"""
        response = requests.get(options["url"], timeout=settings.REQUESTS_TIMEOUT)
        response.raise_for_status()
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
        if not rows:
            msg = f"The sheet at {options['url']} is empty"
            raise CommandError(msg)

        header = [column.strip() for column in rows[0]]
        if DESCRIPTION_COLUMN not in header:
            # A sheet that isn't shared publicly returns Google's sign-in page
            # rather than CSV, which reads as a sheet without the column.
            msg = (
                f"No '{DESCRIPTION_COLUMN}' column in {options['url']}. If the "
                "sheet has one, check that it is shared as 'Anyone with the "
                "link can view': otherwise Google returns its sign-in page "
                "instead of the CSV."
            )
            raise CommandError(msg)
        description_index = header.index(DESCRIPTION_COLUMN)

        topics_by_name = {
            normalize_topic_name(topic.name): topic
            for topic in LearningResourceTopic.objects.prefetch_related(
                "channel_topic_details__channel"
            )
        }

        dry_run = options["dry_run"]
        updated_channels = []
        outcomes = Counter(
            self._apply_row(
                row,
                description_index,
                topics_by_name,
                updated_channels,
                dry_run=dry_run,
            )
            for row in rows[1:]
            # The topic name is in the first, unlabelled column.
            if row and row[0].strip()
        )

        prefix = "[dry run] " if dry_run else ""
        self.stdout.write(
            f"{prefix}{outcomes[UPDATED]} updated, "
            f"{outcomes[UNCHANGED]} already up to date, {outcomes[SKIPPED]} skipped"
        )
        if updated_channels and not dry_run:
            # As the channel admin does on save: clear the cached API
            # responses, then purge the updated topic pages from Fastly, which
            # would otherwise keep serving the old description.
            clear_views_cache()
            clear_featured_caches(
                [
                    channel.channel_url
                    for channel in updated_channels
                    if channel.channel_url
                ]
            )

    def _apply_row(
        self, row, description_index, topics_by_name, updated_channels, *, dry_run
    ):
        """
        Set one row's description on its topic's channel, adding the channel to
        `updated_channels` if it changed, and return the outcome.
        """
        sheet_name = row[0].strip()
        name = sheet_name.removeprefix(PARENT_TOPIC_PREFIX)
        description = (
            row[description_index].strip() if description_index < len(row) else ""
        )

        topic = topics_by_name.get(normalize_topic_name(name))
        if topic is None:
            self.stdout.write(f"Topic not found: '{sheet_name}'")
            return SKIPPED
        if not description:
            self.stdout.write(f"No description in the sheet for '{topic.name}'")
            return SKIPPED
        topic_detail = next(iter(topic.channel_topic_details.all()), None)
        if topic_detail is None:
            self.stdout.write(f"Topic '{topic.name}' has no channel")
            return SKIPPED

        channel = topic_detail.channel
        if channel.public_description == description:
            return UNCHANGED
        if not dry_run:
            channel.public_description = description
            channel.save(update_fields=["public_description", "updated_on"])
        updated_channels.append(channel)
        verb = "Would update" if dry_run else "Updated"
        self.stdout.write(f"{verb} '{topic.name}'")
        return UPDATED
