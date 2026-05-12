"""Tasks for news_events"""

from main.celery import app
from main.utils import clear_views_cache
from news_events.etl import pipelines


@app.task
def get_medium_mit_news():
    """Run the Medium MIT News ETL pipeline"""
    pipelines.medium_mit_news_etl()
    clear_views_cache()


@app.task
def get_ol_events():
    """Run the Open Learning Events ETL pipeline"""
    pipelines.ol_events_etl()
    clear_views_cache()


@app.task
def get_sloan_exec_news():
    """Run the Sloan executive education news ETL pipeline"""
    pipelines.sloan_exec_news_etl()
    clear_views_cache()


@app.task
def get_sloan_exec_webinars():
    """Run the Sloan webinars ETL pipeline"""
    pipelines.sloan_webinars_etl()
    clear_views_cache()


@app.task
def get_mitpe_news():
    """Run the MIT Professional Education news ETL pipeline"""
    pipelines.mitpe_news_etl()
    clear_views_cache()


@app.task
def get_mitpe_events():
    """Run the MIT Professional Education events ETL pipeline"""
    pipelines.mitpe_events_etl()
    clear_views_cache()


@app.task
def get_website_content_news():
    """Run the website content news ETL pipeline"""
    pipelines.articles_news_etl()
    clear_views_cache()


# Backward-compatible alias so any queued Celery tasks using the old name still work.
get_articles_news = get_website_content_news


@app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 5},
)
def sync_website_content_to_news(self, content_id: int):
    """
    Sync a single website content news item to the news feed.

    Args:
        content_id (int): The ID of the WebsiteContent item to sync

    Retry policy:
        - Retries up to 3 times on any exception
        - 5 second delay between retries
    """
    import logging

    from news_events.etl.articles_news import sync_single_article_to_news
    from website_content.models import WebsiteContent

    logger = logging.getLogger(__name__)

    try:
        content = WebsiteContent.objects.get(id=content_id, is_published=True)
        sync_single_article_to_news(content)
        clear_views_cache()
        logger.info(
            "Successfully synced content %s to news feed",
            content_id,
        )
    except WebsiteContent.DoesNotExist:
        logger.warning(
            "WebsiteContent %s not found or not published, skipping sync",
            content_id,
        )
        return
    except Exception:
        logger.exception(
            "Failed to sync content %s to news feed (retry %s/%s)",
            content_id,
            self.request.retries,
            self.max_retries,
        )
        raise


# Backward-compatible alias so any queued Celery tasks using the old name still work.
sync_article_to_news = sync_website_content_to_news
