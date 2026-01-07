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
def get_articles_news():
    """Run the Articles News ETL pipeline"""
    pipelines.articles_news_etl()
    clear_views_cache()


@app.task
def sync_article_to_news(article_id: int):
    """
    Sync a single article to the news feed.

    Args:
        article_id (int): The ID of the article to sync
    """
    from articles.models import Article
    from news_events.etl.articles_news import sync_single_article_to_news

    try:
        article = Article.objects.get(id=article_id, is_published=True)
        sync_single_article_to_news(article)
        clear_views_cache()
    except Article.DoesNotExist:
        pass  # Article was deleted or unpublished, skip sync
