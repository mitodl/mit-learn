"""Management command for populating OVS video data"""

from django.core.management import BaseCommand

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.management.commands.mixins import ConfirmDeleteMixin
from learning_resources.models import LearningResource
from learning_resources.tasks import get_ovs_data, get_ovs_transcripts
from learning_resources.utils import resource_delete_actions
from main.utils import now_in_utc


class Command(ConfirmDeleteMixin, BaseCommand):
    """Populate OVS videos"""

    help = "Populate OVS videos and transcripts"

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete",
            dest="delete",
            action="store_true",
            help="Delete all existing OVS video records",
        )
        parser.add_argument(
            "--transcripts",
            dest="transcripts",
            action="store_true",
            help="Fetch transcripts for OVS videos",
        )
        parser.add_argument(
            "--overwrite",
            dest="overwrite",
            action="store_true",
            help="Overwrite any existing transcript records",
        )
        super().add_arguments(parser)

    def handle(self, *args, **options):  # noqa: ARG002
        """Run Populate OVS video data"""
        if options["delete"]:
            self.stdout.write("Deleting all existing OVS videos from database")
            for video in LearningResource.objects.filter(
                resource_type=LearningResourceType.video.name,
                platform__code=PlatformType.ovs.name,
            ).iterator():
                resource_delete_actions(video)
            self.stdout.write("Complete")
        elif options["transcripts"]:
            task = get_ovs_transcripts.delay(overwrite=options["overwrite"])
            self.stdout.write("Waiting on task...")
            start = now_in_utc()
            task.get()
            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(f"Completed in {total_seconds} seconds")
        else:
            task = get_ovs_data.delay()
            self.stdout.write(f"Started task {task} to get OVS video data")
            self.stdout.write("Waiting on task...")
            start = now_in_utc()
            task.get()
            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(
                f"Population of OVS video data finished, took {total_seconds} seconds"
            )
