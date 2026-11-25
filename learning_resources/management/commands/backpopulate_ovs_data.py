"""Management command for OVS video loading, transcripts and deletion"""

import requests
from django.conf import settings
from django.core.management import BaseCommand, CommandError

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.loaders import load_ovs_video_from_webhook
from learning_resources.etl.ownership import Pipeline, may_write, writing_as
from learning_resources.management.commands.mixins import ConfirmDeleteMixin
from learning_resources.models import LearningResource
from learning_resources.tasks import get_ovs_transcripts
from learning_resources.utils import resource_delete_actions
from main.utils import now_in_utc

OVS_TYPES = [LearningResourceType.video_playlist.name, LearningResourceType.video.name]


class Command(ConfirmDeleteMixin, BaseCommand):
    """Load OVS videos, fetch OVS transcripts or delete OVS videos"""

    help = (
        "Load OVS videos from the OVS public API, fetch OVS transcripts or delete "
        "OVS videos. In deployed environments OVS videos are loaded by the data "
        "platform's OVS webhook; --load is for seeding a local database."
    )

    def add_arguments(self, parser):
        """Add the mode flags, one of which is required"""
        mode_group = parser.add_mutually_exclusive_group(required=True)
        mode_group.add_argument(
            "--load",
            dest="load",
            action="store_true",
            help=(
                "Load videos from OVS_API_BASE_URL through the OVS webhook's "
                "loader. Needs the (ovs, video_playlist) and (ovs, video) "
                "ownership rows set to webhook."
            ),
        )
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
        """Load OVS videos, delete OVS videos or fetch OVS transcripts"""
        if options["load"]:
            self.load_videos()
        elif options["delete"]:
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

    def load_videos(self):
        """Load every public, Complete include_in_learn video from the OVS API"""
        if not settings.OVS_API_BASE_URL:
            msg = "OVS_API_BASE_URL is not set"
            raise CommandError(msg)
        url = (
            f"{settings.OVS_API_BASE_URL.rstrip('/')}"
            "/api/v0/public/videos/?include_in_learn=true"
        )
        loaded = skipped = 0
        with writing_as(Pipeline.WEBHOOK):
            if not may_write(ETLSource.ovs.name, OVS_TYPES):
                msg = (
                    f"The webhook does not own ovs/{', '.join(OVS_TYPES)}. Set "
                    "those ETLSourceOwnership rows' owner to webhook in Django admin."
                )
                raise CommandError(msg)
            while url:
                response = requests.get(url, timeout=settings.REQUESTS_TIMEOUT)
                response.raise_for_status()
                data = response.json()
                for video in data.get("results", []):
                    # the removed legacy extract's filter; the webhook has none
                    if (
                        video.get("is_public")
                        and video.get("status") == "Complete"
                        and load_ovs_video_from_webhook(video)
                    ):
                        loaded += 1
                    else:
                        skipped += 1
                url = data.get("next")
        self.stdout.write(f"Loaded {loaded} OVS videos, skipped {skipped}")
