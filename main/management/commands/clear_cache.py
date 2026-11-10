"""Command to clear the cache"""

from django.core.management.base import BaseCommand

from main.utils import clear_views_cache


class Command(BaseCommand):
    """
    Clear cached view responses.

    Cached responses otherwise expire after REDIS_VIEW_CACHE_DURATION. Run
    this to publish a manual change without waiting for them to expire.
    """

    help = "Command to clear the cache"

    def handle(self, *args, **options):  # noqa: ARG002
        cache_items = clear_views_cache()
        self.stdout.write(f"cleared {cache_items} items from cache")
