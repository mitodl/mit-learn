"""Management command for populating see course data"""

from django.core.management import BaseCommand

from learning_resources.constants import LearningResourceType
from learning_resources.management.commands.mixins import ConfirmDeleteMixin
from learning_resources.models import LearningResource
from learning_resources.tasks import get_podcast_data, get_podcast_transcripts
from learning_resources.utils import resource_delete_actions
from main.utils import now_in_utc


class Command(ConfirmDeleteMixin, BaseCommand):
    """Populate podcasts"""

    help = "Populate podcasts and episode transcripts"

    def add_arguments(self, parser):
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
            help="Fetch transcripts for podcast episodes",
        )
        parser.add_argument(
            "--overwrite",
            dest="overwrite",
            action="store_true",
            help="Overwrite any existing transcript records",
        )
        super().add_arguments(parser)

    def handle(self, *args, **options):  # noqa: ARG002
        """Run Populate Podcast data"""
        if options["delete"]:
            self.stdout.write(
                "Deleting all existing podcasts and episodes from database"
            )
            for episode in LearningResource.objects.filter(
                resource_type=LearningResourceType.podcast_episode.name
            ).iterator():
                resource_delete_actions(episode)
            for podcast in LearningResource.objects.filter(
                resource_type=LearningResourceType.podcast.name
            ).iterator():
                resource_delete_actions(podcast)
        elif options["transcripts"]:
            task = get_podcast_transcripts.delay(overwrite=options["overwrite"])
            self.stdout.write("Waiting on task...")
            start = now_in_utc()
            task.get()
            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(f"Completed in {total_seconds} seconds")
        else:
            task = get_podcast_data.delay()
            self.stdout.write(f"Started task {task} to get podcast data")
            self.stdout.write("Waiting on task...")
            start = now_in_utc()
            task.get()
            total_seconds = (now_in_utc() - start).total_seconds()
            self.stdout.write(
                f"Population of podcast data finished, took {total_seconds} seconds"
            )
