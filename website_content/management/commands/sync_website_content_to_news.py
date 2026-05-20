"""Management command to sync website content news items to the news feed"""

from django.core.management.base import BaseCommand

from news_events.etl import pipelines


class Command(BaseCommand):
    help = "Sync published news-type website content to the news feed"

    def handle(self, *args, **options):  # noqa: ARG002
        self.stdout.write("Syncing website content to news feed...")

        try:
            pipelines.articles_news_etl()

            self.stdout.write(
                self.style.SUCCESS("Successfully synced website content to news feed!")
            )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error syncing website content: {e!s}"))
            raise
