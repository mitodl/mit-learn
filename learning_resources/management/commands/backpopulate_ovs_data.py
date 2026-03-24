"""Management command for populating OVS video data"""

from django.core.management import BaseCommand

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.models import LearningResource
from learning_resources.tasks import get_ovs_data, get_ovs_transcripts
from learning_resources.utils import resource_delete_actions
from main.utils import now_in_utc


class Command(BaseCommand):
    """Populate OVS videos"""

    help = "Populate OVS videos and transcripts"

    def add_arguments(self, parser):
        subparsers = parser.add_subparsers(dest="command")

        subparsers.add_parser("delete", help="Delete all existing OVS video records")

        subparsers.add_parser("fetch", help="Fetch OVS video data")

        transcripts_parser = subparsers.add_parser(
            "transcripts", help="Fetch transcripts for OVS videos"
        )
        transcripts_parser.add_argument(
            "--overwrite",
            dest="overwrite",
            action="store_true",
            help="Overwrite any existing transcript records",
        )

        super().add_arguments(parser)

    def handle(self, *args, **options):  # noqa: ARG002
        """Run Populate OVS video data"""
        command = options["command"]
        if command == "delete":
            self.stdout.write("Deleting all existing OVS videos from database")
            for video in LearningResource.objects.filter(
                resource_type=LearningResourceType.video.name,
                platform__code=PlatformType.ovs.name,
            ).iterator():
                resource_delete_actions(video)
            self.stdout.write("Complete")
        elif command == "fetch":
            task = get_ovs_data.delay()
            self.stdout.write(f"Started task {task} to get OVS video data")
            self.stdout.write("Waiting on task...")
            start = now_in_utc()
            task.get()
            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(
                f"Population of OVS video data finished, took {total_seconds} seconds"
            )
        elif command == "transcripts":
            overwrite = options["overwrite"]
            task = get_ovs_transcripts.delay(overwrite=overwrite)
            self.stdout.write("Waiting on task...")
            start = now_in_utc()
            task.get()
            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(f"Completed in {total_seconds} seconds")
        else:
            self.print_help("manage.py", "backpopulate_ovs_data")
