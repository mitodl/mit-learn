"""Management command for OVS video transcripts and deletion"""

from django.core.management import BaseCommand

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.management.commands.mixins import ConfirmDeleteMixin
from learning_resources.models import LearningResource
from learning_resources.tasks import get_ovs_transcripts
from learning_resources.utils import resource_delete_actions
from main.utils import now_in_utc


class Command(ConfirmDeleteMixin, BaseCommand):
    """Fetch OVS transcripts or delete OVS videos"""

    help = (
        "Fetch OVS transcripts or delete OVS videos. OVS videos themselves are "
        "loaded by the data platform's OVS webhook."
    )

    def add_arguments(self, parser):
        mode_group = parser.add_mutually_exclusive_group(required=True)
        mode_group.add_argument(
            "--delete",
            dest="delete",
            action="store_true",
            help="Delete all existing OVS video records",
        )
        mode_group.add_argument(
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
        """Delete OVS videos or fetch OVS transcripts"""
        if options["delete"]:
            self.stdout.write("Deleting all existing OVS videos from database")
            for video in LearningResource.objects.filter(
                resource_type=LearningResourceType.video.name,
                platform__code=PlatformType.ovs.name,
            ).iterator():
                resource_delete_actions(video)
            self.stdout.write("Complete")
        else:
            task = get_ovs_transcripts.delay(overwrite=options["overwrite"])
            self.stdout.write("Waiting on task...")
            start = now_in_utc()
            task.get()
            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(f"Completed in {total_seconds} seconds")
