"""Learning resource APIs"""

from django.db.models import Count

from learning_resources.models import LearningResource, LearningResourceViewEvent
from main.utils import chunks

VIEW_COUNT_BATCH_SIZE = 1000


def _update_view_counts_batch(resource_ids: list[int]) -> int:
    counts = dict(
        LearningResourceViewEvent.objects.filter(learning_resource_id__in=resource_ids)
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
