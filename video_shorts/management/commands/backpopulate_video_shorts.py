"""Management command for populating video shorts data"""

from django.conf import settings
from django.core.management import BaseCommand

from main.utils import clear_search_cache
from video_shorts.api import walk_video_shorts_from_s3
from video_shorts.models import VideoShort


class Command(BaseCommand):
    """Populate video shorts from S3"""

    help = "Populate video shorts from S3 metadata"

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete",
            dest="delete",
            action="store_true",
            help="Delete all existing VideoShort records first",
        )
        parser.add_argument(
            "--limit",
            dest="limit",
            type=int,
            default=settings.VIDEO_SHORTS_COUNT,
            help=(
                f"Maximum number of video shorts to process "
                f"(default: {settings.VIDEO_SHORTS_COUNT})"
            ),
        )
        super().add_arguments(parser)

    def handle(self, *args, **options):  # noqa: ARG002
        """Run populate video shorts"""
        if options["delete"]:
            count = VideoShort.objects.count()
            self.stdout.write(f"Deleting {count} existing VideoShort records")
            VideoShort.objects.all().delete()
            self.stdout.write("Deletion complete")

        limit = options["limit"]
        self.stdout.write(f"Processing up to {limit} video shorts from S3...")

        upserted_count = 0
        for video_short in walk_video_shorts_from_s3(limit=limit):
            upserted_count += 1
            self.stdout.write(
                f"Upserted: {video_short.title} ({video_short.youtube_id})"
            )
        clear_search_cache()
        self.stdout.write(
            self.style.SUCCESS(f"Complete: {upserted_count} video short(s) upserted")
        )
