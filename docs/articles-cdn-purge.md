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
APP_BASE_URL = get_string("APP_BASE_URL", "http://localhost:8063")
```

**Environment Variables:**
- `FASTLY_API_KEY`: Your Fastly API authentication key
- `APP_BASE_URL`: The base URL of your application (e.g., `https://learn.mit.edu`)

### 2. Tasks (`articles/tasks.py`)

Three Celery tasks handle CDN purging:

#### `call_fastly_purge_api(relative_url, timeout=30)`
Low-level function that makes HTTP PURGE requests to the Fastly API.

**Features:**
- Raises HTTPError for failed requests (4xx, 5xx status codes)
- Raises RequestException for network/timeout errors
- Returns parsed JSON response on success
- Skips purge in dev environments (when `FASTLY_API_KEY` is empty)

**Usage:**
```python
try:
    result = call_fastly_purge_api("/news/my-article/", timeout=5)
    if result.get("status") == "ok":
        print("Purge successful!")
except requests.HTTPError:
    print("HTTP error occurred")
except requests.RequestException:
    print("Network error occurred")
```

#### `fastly_purge_relative_url(relative_url, timeout=30)`
Purges a specific relative URL from the CDN cache.

**Behavior:**
- Can be called directly (runs immediately) or via `.delay()` (enqueued for Celery)
- Accepts any relative URL path (e.g., `/news/article-slug/`)
- Returns dict with status on success, `{"status": "error"}` on failure

**Example:**
```python
# Call immediately in current thread
result = fastly_purge_relative_url("/news/article-slug/", timeout=5)

# Enqueue for Celery background processing
fastly_purge_relative_url.delay("/news/article-slug/")
```

#### `fastly_purge_articles_list()`
Purges the articles list endpoint (`/news`).

**Features:**
- Uses `@single_task(10)` decorator to prevent duplicate runs within 10 seconds
- Can be called directly or via `.delay()`
- Ensures the articles list always shows current content

#### `fastly_full_purge()`
Purges the entire CDN cache (use sparingly).

**Warning:** This purges ALL cached content, not just articles.

### 3. Model Method (`articles/models.py`)

#### `Article.get_url()`
Returns the relative URL for an article:

```python
article = Article.objects.get(slug="my-article")
print(article.get_url())  # /news/my-article/
```

Returns `None` if the article has no slug.

### 4. API Functions (`articles/api.py`)

#### `purge_article_on_save(article)`
Handles CDN purge when articles are saved. This function implements a "try immediate, fall back to Celery" pattern.

**Triggers when:**
- An article is published (`is_published=True`)
- The article has a slug
- The article is saved or updated

**Actions:**
1. Attempts immediate purge with short timeout (5 seconds)
2. If successful, logs and continues
3. If fails or times out, enqueues for Celery retry
4. Enqueues purge for the articles list page

**Does not trigger when:**
- Article is unpublished
- Article has no slug (draft state)

### 5. Signals (`articles/signals.py`)

Django signal handler that automatically calls `purge_article_on_save()` after article saves.

### 6. App Configuration (`articles/apps.py`)

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
    fastly_purge_relative_url,
    fastly_purge_articles_list,
    fastly_full_purge
)

# Purge a specific URL immediately (blocking)
result = fastly_purge_relative_url("/news/my-article/")

# Purge a specific URL via Celery (non-blocking)
fastly_purge_relative_url.delay("/news/my-article/")

# Purge the articles list
fastly_purge_articles_list.delay()

# Purge entire cache (use carefully!)
fastly_full_purge.delay()
```

### Backwards Compatibility

For backwards compatibility, the following aliases are available but deprecated:

```python
# Old names (still work but discouraged)
from articles.tasks import (
    queue_fastly_purge_articles_list,  # Use fastly_purge_articles_list
    queue_fastly_full_purge,           # Use fastly_full_purge
)
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
