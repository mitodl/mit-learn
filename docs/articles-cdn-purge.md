# Articles CDN Purge Feature

This document describes the CDN (Fastly) cache purge functionality for articles in the MIT Learn platform.

## Overview

When articles are published or updated, the CDN cache is automatically purged to ensure users see the latest content. This implementation is based on the similar functionality in the [mitxonline repository](https://github.com/mitodl/mitxonline/blob/e7d37d64900270194b07d90b63843d361b29cae1/cms/tasks.py#L17).

## Architecture

```
Article Save (Django Signal)
    ↓
post_save signal handler (signals.py)
    ↓
Celery Tasks (tasks.py)
    ↓
Fastly API (HTTP PURGE request)
    ↓
CDN Cache Purged
```

## Components

### 1. Settings (`main/settings.py`)

Two new environment variables control the Fastly CDN integration:

```python
FASTLY_API_KEY = get_string("FASTLY_API_KEY", "")
FASTLY_URL = get_string("FASTLY_URL", "https://api.fastly.com")
```

**Environment Variables:**
- `FASTLY_API_KEY`: Your Fastly API authentication key
- `FASTLY_URL`: The Fastly API base URL (defaults to `https://api.fastly.com`)

### 2. Tasks (`articles/tasks.py`)

Four Celery tasks handle CDN purging:

#### `call_fastly_purge_api(relative_url)`
Low-level function that makes HTTP PURGE requests to the Fastly API.

**Features:**
- Uses soft-purge for individual pages (preserves stale content)
- Uses hard-purge for wildcard purges
- Includes proper authentication headers
- Returns parsed JSON response or False on error

#### `queue_fastly_purge_article(article_id)`
Purges a specific article from the CDN cache.

**Behavior:**
- Only purges published articles with slugs
- Logs all operations
- Returns True on success, False on failure

#### `queue_fastly_purge_articles_list()`
Purges the articles list endpoint (`/api/v1/articles/`).

**Features:**
- Uses `@single_task(10)` decorator to prevent duplicate runs within 10 seconds
- Ensures the articles list always shows current content

#### `queue_fastly_full_purge()`
Purges the entire CDN cache (use sparingly).

**Warning:** This purges ALL cached content, not just articles.

### 3. Model Method (`articles/models.py`)

#### `Article.get_url()`
Returns the relative URL for an article:

```python
article = Article.objects.get(slug="my-article")
print(article.get_url())  # /api/v1/articles/my-article/
```

Returns `None` if the article has no slug.

### 4. Signals (`articles/signals.py`)

#### `purge_article_on_save`
Django signal handler that automatically triggers CDN purge when articles are saved.

**Triggers when:**
- An article is published (`is_published=True`)
- The article has a slug
- The article is saved or updated

**Actions:**
1. Queues purge for the specific article page
2. Queues purge for the articles list page

**Does not trigger when:**
- Article is unpublished
- Article has no slug (draft state)

### 5. App Configuration (`articles/apps.py`)

Registers the signals when the app is ready:

```python
def ready(self):
    """Import signals when the app is ready"""
    import articles.signals  # noqa: F401
```

## Usage

### Automatic Purging (Default)

CDN purge happens automatically when you save a published article:

```python
from articles.models import Article

# Create and publish an article
article = Article.objects.create(
    title="New Article",
    content={"type": "doc", "content": []},
    is_published=True,
    user=some_user
)
# CDN purge is automatically queued!

# Update an existing article
article.title = "Updated Title"
article.save()
# CDN purge is automatically queued again!
```

### Manual Purging

You can manually trigger CDN purges:

```python
from articles.tasks import (
    queue_fastly_purge_article,
    queue_fastly_purge_articles_list,
    queue_fastly_full_purge
)

# Purge a specific article
queue_fastly_purge_article.delay(article_id=123)

# Purge the articles list
queue_fastly_purge_articles_list.delay()

# Purge entire cache (use carefully!)
queue_fastly_full_purge.delay()
```

### Django Admin

No special admin interface is needed - purging happens automatically when you save articles through the admin.

## Configuration

### Development/Testing

For local development, you can leave the Fastly API key empty. The code will still run but won't actually purge anything:

```bash
# .env file
FASTLY_API_KEY=
FASTLY_URL=
```

### Production

Set these environment variables in your production environment:

```bash
FASTLY_API_KEY=your-fastly-api-key-here
FASTLY_URL=https://api.fastly.com
```

**Note:** The `APP_BASE_URL` setting (already configured) is used to set the `Host` header in Fastly API requests.

## Testing

### Running Tests

```bash
# Test tasks
pytest articles/tasks_test.py -v

# Test signals
pytest articles/signals_test.py -v

# Test model methods
pytest articles/models_test.py -v

# Run all article tests
pytest articles/ -v
```

### Test Coverage

The test suite includes:

✅ Successful API calls  
✅ API error handling  
✅ Published vs unpublished articles  
✅ Articles with and without slugs  
✅ Signal triggering on save  
✅ URL generation  
✅ Full cache purge  
✅ Articles list purge  

## Monitoring and Logging

All CDN purge operations are logged using Python's standard logging:

```python
import logging
logger = logging.getLogger("fastly_purge")
```

**Log Levels:**
- `INFO`: Successful purges, task execution
- `DEBUG`: Detailed information (URLs, article IDs)
- `ERROR`: Failed API calls, missing articles

**Example logs:**
```
INFO: Processing purge request for article 123
DEBUG: Article URL is /api/v1/articles/my-article/
INFO: Fastly returned: {"status": "ok", "id": "abc-123"}
INFO: Purge request processed OK.
```

## Troubleshooting

### Article not purging from CDN

**Check:**
1. Is the article published? (`is_published=True`)
2. Does the article have a slug?
3. Are `FASTLY_API_KEY` and `FASTLY_URL` configured?
4. Check Celery logs for task execution
5. Check `fastly_purge` logger for API errors

### "Article not published or has no slug, skipping purge"

This is normal behavior for draft articles. Only published articles with slugs are purged.

### Fastly API returns 403 Forbidden

Your `FASTLY_API_KEY` is invalid or expired. Generate a new API key from your Fastly account.

### Celery tasks not running

Ensure your Celery worker is running:
```bash
celery -A main.celery:app worker -E -Q default --concurrency=2 -B -l INFO
```

## Differences from mitxonline Implementation

This implementation differs from mitxonline in the following ways:

1. **Page Model vs Article Model**: mitxonline uses Wagtail's `Page` model, we use Django's `Article` model
2. **URL Structure**: mitxonline uses `page.get_url()`, we use `/api/v1/articles/{slug}/`
3. **Settings Names**: We use `FASTLY_*` instead of `MITX_ONLINE_FASTLY_*`
4. **Additional Purge**: We also purge the articles list endpoint when articles change
5. **Logging**: Enhanced logging with more detailed information

## Future Enhancements

Potential improvements:

- [ ] Add purge on article deletion
- [ ] Batch purge for multiple articles
- [ ] Purge statistics and reporting
- [ ] Integration with admin action "Purge from CDN"
- [ ] Support for custom cache keys/tags
- [ ] Retry logic for failed purges
- [ ] Webhook notifications on successful purge

## Related Documentation

- [Fastly API Documentation](https://docs.fastly.com/api/)
- [mitxonline CDN Purge Implementation](https://github.com/mitodl/mitxonline/blob/main/cms/tasks.py)
- [Celery Task Documentation](https://docs.celeryproject.org/en/stable/userguide/tasks.html)
- [Django Signals Documentation](https://docs.djangoproject.com/en/stable/topics/signals/)
