"""Command to clear the cache"""

from django.core.management.base import BaseCommand

from main.utils import clear_views_cache


class Command(BaseCommand):
    """
    Clear cached view responses.

    Cached responses are otherwise dropped on a schedule by
    main.tasks.clear_views_cache (CLEAR_VIEWS_CACHE_SCHEDULE_SECONDS). Run this
    to publish a manual change without waiting for the next scheduled clear.
    """

    help = "Command to clear the cache"

    def handle(self, *args, **options):  # noqa: ARG002
        cache_items = clear_views_cache()
        self.stdout.write(f"cleared {cache_items} items from cache")
