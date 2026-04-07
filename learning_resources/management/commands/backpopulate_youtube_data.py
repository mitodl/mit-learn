"""Management command for populating youtube course data"""

from datetime import UTC, datetime

from django.core.management import BaseCommand

from learning_resources.etl.constants import ETLSource
from learning_resources.management.commands.mixins import ConfirmDeleteMixin
from learning_resources.models import LearningResource, VideoChannel
from learning_resources.tasks import get_youtube_data, get_youtube_transcripts
from learning_resources.utils import resource_delete_actions
from main.constants import ISOFORMAT
from main.utils import now_in_utc


class Command(ConfirmDeleteMixin, BaseCommand):
    """Populate youtube videos"""

    help = """Populates youtube videos"""

    def add_arguments(self, parser):
        """Configure arguments for this command"""
        parser.add_argument(
            "--delete",
            dest="delete",
            action="store_true",
            help="Delete all existing records first",
        )
        parser.add_argument(
            "--transcripts",
            dest="transcripts",
            action="store_true",
            help="Fetch video transcript data",
        )
        parser.add_argument(
            "-c",
            "--channel-id",
            dest="channel_ids",
            action="append",
            default=None,
            help="Only fetch channels specified by channel id",
        )
        parser.add_argument(
            "--created-after",
            dest="created_after",
            default=None,
            help="Only fetch transcripts for videos indexed after timestamp (yyyy-mm-ddThh:mm:ssZ)",  # noqa: E501
        )
        parser.add_argument(
            "--created-minutes",
            dest="created_minutes",
            default=None,
            help="Only fetch transcripts for videos indexed this number of minutes ago and later",  # noqa: E501
        )
        parser.add_argument(
            "--overwrite",
            dest="overwrite",
            action="store_true",
            help="Overwrite any existing transcript records",
        )
        super().add_arguments(parser)

    def handle(self, *args, **options):  # noqa: ARG002
        """Run Populate youtube videos"""
        if options["delete"]:
            videos_playlists = LearningResource.objects.filter(
                etl_source=ETLSource.youtube.name
            )
            self.stdout.write(
                f"Deleting {videos_playlists.count()} existing YouTube resources"
            )
            for resource in videos_playlists:
                resource_delete_actions(resource)
            VideoChannel.objects.all().delete()
            self.stdout.write("Complete")
        elif options["transcripts"]:
            created_after = options["created_after"]
            created_minutes = options["created_minutes"]
            overwrite = options["overwrite"]

            if created_after:
                try:
                    created_after = datetime.strptime(created_after, ISOFORMAT).replace(
                        tzinfo=UTC
                    )
                except ValueError:
                    self.stdout.write("Invalid date format")
                    return

            if created_minutes:
                try:
                    created_minutes = int(created_minutes)
                except ValueError:
                    self.stdout.write("created_minutes must be an integer")
                    return

            task = get_youtube_transcripts.delay(
                created_after=created_after,
                created_minutes=created_minutes,
                overwrite=overwrite,
            )
            self.stdout.write("Waiting on task...")
            start = now_in_utc()
            task.get()
            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(f"Completed in {total_seconds} seconds")
        else:
            channel_ids = options["channel_ids"]
            task = get_youtube_data.delay(channel_ids=channel_ids)
            self.stdout.write(f"Started task {task} to get YouTube video data")
            self.stdout.write("Waiting on task...")
            start = now_in_utc()
            result = task.get()
            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(
                f"Fetched {result} YouTube channel in {total_seconds} seconds"
            )
