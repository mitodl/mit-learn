"""Management command for calculating LearningResource.view_count"""

from django.core.management import BaseCommand

from learning_resources.api import update_resource_view_counts
from main.utils import now_in_utc


class Command(BaseCommand):
    """Update LearningResource.view_count data"""

    help = "Update LearningResourcePlatform data"

    def handle(self, *args, **options):  # noqa: ARG002
        """Update LearningResource.view_count data"""

        self.stdout.write("Updating LearningResource view count data")
        start = now_in_utc()
        num_updated = update_resource_view_counts()
        total_seconds = (now_in_utc() - start).total_seconds()
        self.stdout.write(
            f"Updated view count {num_updated} resources, took {total_seconds} seconds"
        )
