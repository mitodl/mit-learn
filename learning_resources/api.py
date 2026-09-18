"""Learning resource APIs"""

from urllib.parse import urljoin

from django.conf import settings
from django.db.models import Count

from learning_resources.constants import (
    WEBSITE_CONTENT_READABLE_ID_PREFIX,
    LearningResourceType,
)
from learning_resources.models import LearningResource, LearningResourceViewEvent
from learning_resources.utils import (
    add_parent_topics_to_learning_resource,
    resource_unpublished_actions,
    resource_upserted_actions,
)
from main.utils import chunks
from website_content.utils import extract_text_from_content

VIEW_COUNT_BATCH_SIZE = 1000


def _update_view_counts_batch(resource_ids: list[int]) -> int:
    counts = dict(
        LearningResourceViewEvent.objects.filter(learning_resource_id__in=resource_ids)
        .values("learning_resource_id")
        .annotate(total=Count("id"))
        .values_list("learning_resource_id", "total")
    )
    resources = list(
        LearningResource.objects.filter(id__in=resource_ids).only("id", "view_count")
    )

    for resource in resources:
        resource.view_count = counts.get(resource.id, 0)

    return LearningResource.objects.bulk_update(resources, ["view_count"])


def update_resource_view_counts() -> int:
    """
    Update the view counts on all resources

    Returns:
        int: the number of resources updated
    """
    updated = 0
    published_resource_ids = LearningResource.objects.filter(
        published=True
    ).values_list("id", flat=True)
    for resource_ids in chunks(
        published_resource_ids.iterator(chunk_size=VIEW_COUNT_BATCH_SIZE),
        chunk_size=VIEW_COUNT_BATCH_SIZE,
    ):
        updated += _update_view_counts_batch(resource_ids)

    return updated


def website_content_readable_id(content_id: int) -> str:
    """
    Return the readable_id identifying a WebsiteContent item's LearningResource.

    Keyed on the numeric id rather than the slug: a slug is absent on a draft
    and can change when the item is republished, while the resource has to be
    found again on every subsequent sync.
    """
    return f"{WEBSITE_CONTENT_READABLE_ID_PREFIX}{content_id}"


def sync_website_content_to_learning_resource(content) -> LearningResource:
    """
    Upsert the LearningResource mirroring a published article.

    Callers are responsible for only handing this articles -- the plugin and
    the task that reach it both check the content type. News is not mirrored:
    it has the news feed instead.

    Editorial content carries no external platform or offeror, and it is not
    ETL'd, so those are left unset -- `etl_source` in particular must stay
    empty, because `load_documents` unpublishes any document bearing an ETL
    source it did not just see.

    Topics come straight from the editor's selections, which hold only the
    leaves they picked; `add_parent_topics_to_learning_resource` fills in the
    ancestors search needs to filter on.

    Args:
        content (WebsiteContent): a published content item

    Returns:
        LearningResource: the resource mirroring it
    """
    url = content.get_url()
    resource, _ = LearningResource.objects.update_or_create(
        readable_id=website_content_readable_id(content.id),
        resource_type=LearningResourceType.article.name,
        defaults={
            "title": content.title,
            "description": extract_text_from_content(content.content),
            "published": True,
            "url": urljoin(settings.APP_BASE_URL, url) if url else None,
            "last_modified": content.updated_on,
            "resource_category": LearningResourceType.article.value,
        },
    )
    resource.topics.set(content.topics.all())
    add_parent_topics_to_learning_resource(resource)
    # `percolate=False` follows the document loader: percolation drives
    # saved-search notifications, which are not this change's business.
    resource_upserted_actions(resource, percolate=False, generate_embeddings=True)
    return resource


def unpublish_website_content_learning_resource(content_id: int) -> None:
    """
    Take a WebsiteContent item's LearningResource out of search.

    The row is kept and marked unpublished rather than deleted, matching how
    every other resource leaves the index, so republishing restores it in place
    along with anything attached to it.

    Args:
        content_id (int): the id of the content item that was unpublished
    """
    resource = LearningResource.objects.filter(
        readable_id=website_content_readable_id(content_id),
        resource_type=LearningResourceType.article.name,
    ).first()
    if resource is None:
        # Nothing was ever published for this item -- a draft has no resource.
        return
    resource.published = False
    resource.save()
    resource_unpublished_actions(resource)
