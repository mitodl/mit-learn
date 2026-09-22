"""Tasks for news_events"""

from main.celery import app
from news_events.etl import pipelines


@app.task(acks_late=True, reject_on_worker_lost=True)
def get_medium_mit_news():
    """Run the Medium MIT News ETL pipeline"""
    pipelines.medium_mit_news_etl()


@app.task(acks_late=True, reject_on_worker_lost=True)
def get_ol_events():
    """Run the Open Learning Events ETL pipeline"""
    pipelines.ol_events_etl()


@app.task
def get_sloan_exec_news():
    """Run the Sloan executive education news ETL pipeline"""
    pipelines.sloan_exec_news_etl()


@app.task
def get_sloan_exec_webinars():
    """Run the Sloan webinars ETL pipeline"""
    pipelines.sloan_webinars_etl()


@app.task(acks_late=True, reject_on_worker_lost=True)
def get_mitpe_news():
    """Run the MIT Professional Education news ETL pipeline"""
    pipelines.mitpe_news_etl()


@app.task(acks_late=True, reject_on_worker_lost=True)
def get_mitpe_events():
    """Run the MIT Professional Education events ETL pipeline"""
    pipelines.mitpe_events_etl()


@app.task(acks_late=True, reject_on_worker_lost=True)
def get_website_content_news():
    """Run the website content news ETL pipeline"""

    pipelines.articles_news_etl()


@app.task(name="news_events.tasks.get_articles_news")
def get_articles_news():
    """Backward-compatible alias for get_website_content_news."""
    pipelines.articles_news_etl()


@app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 5},
)
def delete_website_content_from_news(self, content_id: int):
    """
    Remove a website content item's entry from the news feed.

    The counterpart to `sync_website_content_to_news`, run when an item is
    unpublished. The deletion is keyed on the feed guid rather than on a loaded
    WebsiteContent, so it still cleans up after content that has since been
    removed, and is a safe no-op when there is nothing to delete.

    Args:
        content_id (int): The ID of the WebsiteContent item to remove

    Retry policy:
        - Retries up to 3 times on any exception
        - 5 second delay between retries
    """
    import logging

    from news_events.etl.articles_news import delete_website_content_news_from_news
    from website_content.models import WebsiteContent

    logger = logging.getLogger(__name__)

    # Queued work can run late. If the item was republished in the meantime, a
    # stale delete would strip the feed entry the republish just (re)created, so
    # bail out -- the mirror of the sync task only loading a published row.
    # `objects` hides soft-deleted rows, so a row that is gone or soft-deleted
    # still falls through and gets cleaned up.
    if WebsiteContent.objects.filter(id=content_id, is_published=True).exists():
        logger.info(
            "WebsiteContent %s is published again, skipping news feed removal",
            content_id,
        )
        return

    try:
        deleted = delete_website_content_news_from_news(content_id)
    except Exception:
        logger.exception(
            "Failed to remove content %s from news feed (retry %s/%s)",
            content_id,
            self.request.retries,
            self.max_retries,
        )
        raise
    else:
        logger.info(
            "Removed %s news feed item(s) for content %s",
            deleted,
            content_id,
        )


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

    from news_events.etl.articles_news import (
        delete_website_content_news_from_news,
        sync_single_website_content_news_to_news,
    )
    from website_content.models import WebsiteContent

    logger = logging.getLogger(__name__)

    try:
        content = WebsiteContent.objects.get(id=content_id, is_published=True)

        sync_single_website_content_news_to_news(content)

        # The published check above is a read, and the row can change under it:
        # unpublishing runs in the request, so it can land between that read
        # and this write and then have nothing queued behind it to notice --
        # leaving the story in the feed after it was taken down. Whoever writes
        # last reconciles, so re-read the row and undo if it has moved on.
        if not WebsiteContent.objects.filter(id=content_id, is_published=True).exists():
            logger.info(
                "WebsiteContent %s was unpublished while syncing, undoing the sync",
                content_id,
            )
            delete_website_content_news_from_news(content_id)
            return

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


@app.task(
    name="news_events.tasks.sync_article_to_news",
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 5},
)
def sync_article_to_news(article_id: int):
    """Backward-compatible alias for sync_website_content_to_news."""
    sync_website_content_to_news.apply(args=[article_id], throw=True)
