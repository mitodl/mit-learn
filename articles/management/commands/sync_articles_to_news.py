"""Management command to sync articles to news feed"""

from django.core.management.base import BaseCommand

from news_events.etl import pipelines


class Command(BaseCommand):
    help = "Sync published articles to the news feed"

    def handle(self, *args, **options):  # noqa: ARG002
        self.stdout.write("Syncing articles to news feed...")
        
        try:
            # Run the ETL pipeline
            pipelines.articles_news_etl()
            
            self.stdout.write(
                self.style.SUCCESS("Successfully synced articles to news feed!")
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Error syncing articles: {str(e)}")
            )
            raise
