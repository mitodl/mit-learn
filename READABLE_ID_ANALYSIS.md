# Analysis: Places where readable_id is used alone to uniquely identify LearningResource objects

## Issue Summary

LearningResource objects should be uniquely identified by the combination of (`platform`, `readable_id`, `resource_type`) as defined in the model's unique constraint:

```python
# learning_resources/models.py:583
unique_together = (("platform", "readable_id", "resource_type"),)
```

However, there are multiple places in the codebase where `readable_id` alone is used to identify LearningResource objects, which can lead to incorrect behavior when multiple platforms have resources with the same `readable_id`.

## Critical Issues Found

### 1. **Task: remove_duplicate_resources() - CRITICAL**
**File:** `learning_resources/tasks.py:48-72`
**Issue:** Identifies and removes "duplicate" resources based only on `readable_id`, ignoring platform differences.

```python
duplicates = (
    LearningResource.objects.values("readable_id")
    .annotate(count_id=Count("id"))
    .filter(count_id__gt=1)
)
for duplicate in duplicates:
    unpublished_resources = LearningResource.objects.filter(
        readable_id=duplicate["readable_id"],  # ❌ Missing platform filter
        published=False,
    ).values_list("id", flat=True)
```

**Impact:** This could delete legitimate resources from different platforms that happen to have the same readable_id.

### 2. **Vector Search: vector_point_id() - CRITICAL**
**File:** `vector_search/utils.py:147-156`
**Issue:** Generates vector IDs using only `readable_id`, not considering platform.

```python
def vector_point_id(readable_id):
    """
    Generate a consistent unique id for a learning resource
    Args:
        readable_id (str): Readable id of learning resource
    """
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, readable_id))  # ❌ Only uses readable_id
```

**Impact:** Different platforms with same readable_id will get same vector ID, causing data corruption.

### 3. **Vector Search: _resource_vector_hits() - HIGH**
**File:** `vector_search/utils.py:582-587`
**Issue:** Filters resources by `readable_id` only when retrieving vector search results.

```python
def _resource_vector_hits(search_result):
    hits = [hit.payload["readable_id"] for hit in search_result]
    return LearningResourceSerializer(
        LearningResource.objects.for_serialization().filter(readable_id__in=hits),  # ❌ Missing platform filter
        many=True,
    ).data
```

**Impact:** Could return wrong resources from different platforms in search results.

### 4. **Webhook: process_delete_content_file_request() - HIGH**
**File:** `webhooks/views.py:123-126`
**Issue:** Tries to find Canvas resources using only `readable_id` pattern.

```python
resource = LearningResource.objects.get(
    readable_id__istartswith=f"{course_id}-",  # ❌ Missing platform filter
    etl_source=ETLSource.canvas.name,
)
```

**Impact:** Could affect wrong resource if multiple platforms have similar readable_id patterns.

### 5. **API Filters: filter_readable_id() - MEDIUM**
**File:** `learning_resources/filters.py:165-167`
**Issue:** API endpoint allows filtering by `readable_id` alone.

```python
def filter_readable_id(self, queryset, _, value):
    """Readable id filter for learning resources"""
    return multi_or_filter(queryset, "readable_id", value)  # ❌ No platform consideration
```

**Impact:** API users might get unexpected results when filtering by readable_id.

### 6. **Search API: get_similar_resources_qdrant() - MEDIUM**
**File:** `learning_resources_search/api.py:959-961`
**Issue:** Filters similar resources by `readable_id` only.

```python
return (
    LearningResource.objects.for_search_serialization()
    .filter(
        readable_id__in=[
            resource["readable_id"] for resource in hits if resource["published"]  # ❌ Missing platform context
        ]
    )
    .exclude(id=value_doc["id"])
)
```

**Impact:** Similar resource recommendations could include wrong resources from different platforms.

## Medium/Low Priority Issues

### 7. **Search Tasks: Blocklist Filtering - MEDIUM**
**Files:** 
- `learning_resources_search/tasks.py:728`
- `learning_resources_search/tasks.py:788`  
- `learning_resources_search/tasks.py:794`
- `learning_resources/tasks.py:215`

**Issue:** Uses `readable_id__in=blocklisted_ids` without platform context.

### 8. **ETL Test Files - LOW**
**Files:**
- `learning_resources/etl/loaders_test.py:1360` - `LearningResource.objects.get(readable_id=podcast.readable_id)`
- `learning_resources/etl/canvas_test.py:130` - `LearningResource.objects.get(readable_id=f"{course_folder}-TEST101")`

**Issue:** Tests use `readable_id` alone for lookups.
**Impact:** Tests may pass incorrectly if there are platform conflicts.

### 9. **Task Tests - LOW**
**File:** `learning_resources/tasks_test.py:691,694`
**Issue:** Test assertions count resources by `readable_id` alone.

```python
assert LearningResource.objects.filter(readable_id=duplicate_id).count() == 4
```

## Additional Patterns to Review

### 10. **Migration: OCW readable_id refactor - INFORMATIONAL**
**File:** `learning_resources/migrations/0020_refactor_ocw_readable_id.py`
**Issue:** Migration updates readable_id but includes platform filter, so this is actually correct.

## Recommendations

1. **Immediate Action Required (CRITICAL):**
   - Fix `remove_duplicate_resources()` to consider platform in duplicate detection
   - Fix `vector_point_id()` to include platform in UUID generation
   - Fix `_resource_vector_hits()` to include platform context

2. **High Priority:**
   - Fix webhook delete functionality to be more specific
   - Review and update similar resource search logic

3. **Medium Priority:**
   - Update API filters to be platform-aware or document limitations
   - Review search task blocklist logic

4. **Low Priority:**
   - Update test patterns to use proper unique identification
   - Consider adding database constraints to prevent these issues

## Search Patterns Used

The following search patterns were used to identify these issues:
- `grep -rn "readable_id" /path --include="*.py"`
- `grep -rn "objects\.filter.*readable_id" /path --include="*.py"`
- `grep -rn "objects\.get.*readable_id" /path --include="*.py"`
- `grep -rn "readable_id__in" /path --include="*.py"`

This analysis focused on finding places where `readable_id` is used for unique identification without considering the platform context.