"""Management command for populating youtube course data"""

from datetime import UTC, datetime

from django.core.management import BaseCommand
from django.db.models import Count

from learning_resources.etl.constants import YOUTUBE_ETL_TASK_NAME, ETLSource
from learning_resources.management.commands.mixins import ConfirmDeleteMixin
from learning_resources.models import LearningResource, VideoChannel
from learning_resources.tasks import get_youtube_transcripts, start_youtube_etl_job
from learning_resources.utils import resource_delete_actions
from main.constants import ISOFORMAT
from main.models import TaskJob
from main.utils import now_in_utc


class Command(ConfirmDeleteMixin, BaseCommand):
    """Populate youtube videos"""

    help = """Populates youtube videos"""

    def add_arguments(self, parser):
        """Configure arguments for this command"""
        mode_group = parser.add_mutually_exclusive_group()
        mode_group.add_argument(
            "--delete",
            dest="delete",
            action="store_true",
            help="Delete all existing records first",
        )
        mode_group.add_argument(
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
        mode_group.add_argument(
            "--status",
            dest="status",
            nargs="?",
            type=int,
            const=0,
            default=None,
            help=(
                "Print the status of a youtube ETL job instead of starting one "
                "(defaults to the most recent job)"
            ),
        )
        super().add_arguments(parser)

    def print_job_status(self, job_id):
        """Print the status of a youtube ETL job"""
        jobs = TaskJob.objects.filter(task_name=YOUTUBE_ETL_TASK_NAME)
        job = jobs.filter(id=job_id).first() if job_id else jobs.order_by("-id").first()
        if not job:
            self.stdout.write("No youtube ETL job found")
            return
        self.stdout.write(f"Youtube ETL job {job.id}: {job.status}")
        self.stdout.write("  batches:")
        batch_counts = job.batches.values("kind", "status").annotate(count=Count("id"))
        kind_counts = {}
        for row in batch_counts:
            kind_counts.setdefault(row["kind"], {})[row["status"]] = row["count"]
        for kind, counts in sorted(kind_counts.items()):
            self.stdout.write(f"    {kind}: {counts}")
        if job.error:
            self.stdout.write(f"  error: {job.error}")

    def handle(self, *args, **options):  # noqa: ARG002
        """Run Populate youtube videos"""
        if options["status"] is not None:
            self.print_job_status(options["status"])
        elif options["delete"]:
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
            job = start_youtube_etl_job(channel_ids=options["channel_ids"])
            if job is None:
                self.stdout.write(
                    "A youtube ETL job is already in progress, nothing started"
                )
                return
            self.stdout.write(f"Started youtube ETL job {job.id}")
            self.stdout.write(
                f"Check progress with:"
                f" ./manage.py backpopulate_youtube_data --status {job.id}"
            )
