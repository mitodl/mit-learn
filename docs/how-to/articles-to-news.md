# Creating News from Articles - Complete Guide

This guide explains how to create news feed items from published Articles in the system.

## Overview

The Articles-to-News feature uses the same ETL (Extract, Transform, Load) pattern as other news sources like Medium MIT News. Published articles are automatically synced to the news feed.

## Architecture

```
Article (Django Model)
    ↓
ETL Pipeline (Extract → Transform → Load)
    ↓
FeedSource → FeedItem → FeedNewsDetail
    ↓
News API Endpoint
```

## Components Created

### 1. ETL Module (`news_events/etl/articles_news.py`)

**Extract Phase:**
- Queries `Article.objects.filter(is_published=True)`
- Returns list of article dictionaries

**Transform Phase:**
- Converts article data to feed item format
- Extracts text from JSON content
- Builds author information from User model
- Creates article URLs using slug

**Load Phase:**
- Uses shared loader functions (`loaders.py`)
- Creates/updates `FeedSource`, `FeedItem`, `FeedNewsDetail`
- Handles image and detail relationships

### 2. Pipeline Definition (`news_events/etl/pipelines.py`)

```python
articles_news_etl = compose(
    load_sources(FeedType.news.name),
    articles_news.transform,
    articles_news.extract,
)
```

### 3. Celery Task (`news_events/tasks.py`)

```python
@app.task
def get_articles_news():
    """Run the Articles News ETL pipeline"""
    pipelines.articles_news_etl()
    clear_views_cache()
```

### 4. Scheduled Job (`main/settings_celery.py`)

```python
"update_articles_news": {
    "task": "news_events.tasks.get_articles_news",
    "schedule": get_int(
        "NEWS_EVENTS_ARTICLES_NEWS_SCHEDULE_SECONDS", 60 * 60 * 1
    ),  # default is every 1 hour
}
```

### 5. Signal Handler (`articles/signals.py`)

Automatically syncs when an article is published:

```python
@receiver(post_save, sender=Article)
def sync_article_to_news_on_publish(sender, instance, created, **kwargs):
    if instance.is_published:
        get_articles_news.delay()
```

### 6. Management Command

Manual sync command:
```bash
python manage.py sync_articles_to_news
```

## How It Works

### Automatic Sync (Recommended)

1. **User publishes an article** via the Articles API/Admin
2. **Signal fires** (`sync_article_to_news_on_publish`)
3. **Celery task queued** (`get_articles_news.delay()`)
4. **ETL pipeline runs**:
   - Extracts all published articles
   - Transforms to feed format
   - Loads into news_events tables
5. **Cache cleared** for fresh API responses

### Scheduled Sync (Backup)

- Runs every hour (configurable via `NEWS_EVENTS_ARTICLES_NEWS_SCHEDULE_SECONDS`)
- Ensures consistency even if signals fail
- Handles bulk updates

### Manual Sync (Development/Testing)

```bash
# Via management command
python manage.py sync_articles_to_news

# Via Django shell
from news_events.etl import pipelines
pipelines.articles_news_etl()

# Via Celery task
from news_events.tasks import get_articles_news
get_articles_news.delay()
```

## Data Flow

### 1. Extract
```python
Article.objects.filter(is_published=True)
    ↓
[{
    'id': 1,
    'title': 'My Article',
    'slug': 'my-article',
    'content': {...},
    'user': User(...),
    'created_on': datetime(...),
}]
```

### 2. Transform
```python
[{
    'title': 'MIT Learn Articles',
    'url': '/articles',
    'feed_type': 'news',
    'items': [{
        'guid': 'article-1',
        'title': 'My Article',
        'url': '/articles/my-article',
        'summary': 'First 500 chars...',
        'content': 'Full text...',
        'detail': {
            'authors': ['John Doe'],
            'topics': [],
            'publish_date': '2024-01-01T00:00:00Z',
        }
    }]
}]
```

### 3. Load
```
FeedSource
├── title: "MIT Learn Articles"
├── url: "/articles"
└── feed_type: "news"
    → FeedItem (for each article)
       ├── guid: "article-1"
       ├── title: "My Article"
       ├── url: "/articles/my-article"
       └── source: FeedSource
           → FeedNewsDetail
              ├── authors: ['John Doe']
              ├── topics: []
              └── publish_date: datetime(...)
```

## Customization Guide

### 1. Adjust Content Extraction

The `extract_text_from_content()` function needs customization based on your JSON structure:

```python
def extract_text_from_content(content_json: dict) -> str:
    # For Draft.js
    blocks = content_json.get('blocks', [])
    return ' '.join([block.get('text', '') for block in blocks])
    # For ProseMirror
    def walk_nodes(node):
        if node.get('type') == 'text':
            return node.get('text', '')
        children = node.get('content', [])
        return ' '.join(walk_nodes(child) for child in children)
    return walk_nodes(content_json)
    # For EditorJS
    blocks = content_json.get('blocks', [])
    return ' '.join([
        block.get('data', {}).get('text', '')
        for block in blocks
    ])
```

### 2. Add Image Support

If your Article model has images:

```python
def transform_items(articles_data: list[dict]) -> list[dict]:
    # ... existing code ...
    # Add image extraction
    image_data = None
    if article.image_field:  # Replace with your field name
        image_data = {
            "url": article.image_field.url,
            "alt": article.title,
            "description": article.title,
        }
    entry = {
        # ... existing fields ...
        "image": image_data,
    }
```

### 3. Add Topics/Categories

If you add topics to your Article model:

```python
class Article(TimestampedModel):
    # ... existing fields ...
    topics = models.ManyToManyField('Topic')

# In transform_items:
entry = {
    "detail": {
        "authors": [author_name],
        "topics": [topic.name for topic in article.topics.all()],
        "publish_date": article.created_on.isoformat(),
    }
}
```

### 4. Adjust Sync Frequency

In `.env` or environment variables:
```bash
# Sync every 30 minutes
NEWS_EVENTS_ARTICLES_NEWS_SCHEDULE_SECONDS=1800

# Sync every 5 minutes
NEWS_EVENTS_ARTICLES_NEWS_SCHEDULE_SECONDS=300
```

### 5. Disable Automatic Sync

Comment out the signal in `articles/signals.py`:

```python
# @receiver(post_save, sender=Article)
# def sync_article_to_news_on_publish(...):
#     ...
```

## Testing

### Unit Tests

Run the test suite:
```bash
pytest news_events/etl/articles_news_test.py -v
```

### Integration Test

1. Create and publish an article:
```python
from articles.models import Article
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.first()

article = Article.objects.create(
    title="Test Article",
    content={"blocks": [{"text": "Test content"}]},
    user=user,
    is_published=True
)
```

2. Check news feed:
```python
from news_events.models import FeedItem

items = FeedItem.objects.filter(guid=f"article-{article.id}")
print(items.first().title)  # Should be "Test Article"
```

### Manual Pipeline Test

```python
from news_events.etl import pipelines

# Run the pipeline
result = pipelines.articles_news_etl()

# Check results
from news_events.models import FeedSource
source = FeedSource.objects.get(title="MIT Learn Articles")
print(f"Found {source.feed_items.count()} articles in news feed")
```

## Troubleshooting

### Articles not appearing in news feed

1. **Check if published:**
   ```python
   Article.objects.filter(is_published=True).count()
   ```

2. **Run pipeline manually:**
   ```bash
   python manage.py sync_articles_to_news
   ```

3. **Check for errors:**
   ```python
   from news_events.tasks import get_articles_news
   get_articles_news()  # Run synchronously to see errors
   ```

### Content not displaying correctly

- Check your `extract_text_from_content()` function
- Verify the JSON structure matches your Article.content format
- Add debug logging:
  ```python
  import logging
  log = logging.getLogger(__name__)
  log.info(f"Content structure: {content_json}")
  ```

### Signal not firing

- Ensure `articles/apps.py` has the `ready()` method
- Check that `ArticlesConfig` is in `INSTALLED_APPS`
- Verify Celery is running: `celery -A main worker -l info`

## API Endpoints

Once synced, articles appear in the news API:

```
GET /api/v1/news_events/?feed_type=news
```

Response includes articles from all sources, including "MIT Learn Articles".

## Database Schema

```sql
-- Feed Source (one record for all articles)
FeedSource {
    id: 1
    title: "MIT Learn Articles"
    url: "/articles"
    feed_type: "news"
}

-- Feed Items (one per published article)
FeedItem {
    id: 123
    guid: "article-45"
    source_id: 1
    title: "My Article Title"
    url: "/articles/my-article-slug"
    summary: "First 500 chars..."
    content: "Full text content..."
}

-- News Details (extends FeedItem)
FeedNewsDetail {
    id: 456
    feed_item_id: 123
    authors: ["John Doe"]
    topics: ["Python", "Django"]
    publish_date: "2024-01-01T00:00:00Z"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEWS_EVENTS_ARTICLES_NEWS_SCHEDULE_SECONDS` | `3600` (1 hour) | How often to sync articles |

## Next Steps

1. **Customize content extraction** based on your Article.content structure
2. **Add image support** if needed
3. **Add topics/categories** to Article model
4. **Test the sync** with sample articles
5. **Monitor Celery logs** for any issues
6. **Adjust sync frequency** based on your needs

## Summary

✅ **Automatic sync** when articles are published
✅ **Scheduled backup** every hour
✅ **Manual trigger** via management command
✅ **Same pattern** as other news sources
✅ **Fully tested** with unit tests
✅ **Cache clearing** for fresh responses

Your articles are now part of the unified news feed system! 🎉
