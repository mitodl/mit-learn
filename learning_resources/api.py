"""Learning resource APIs"""

from learning_resources.models import LearningResource


def update_resource_view_counts() -> int:
    """
    Update the view counts on all resources

    Returns:
        int: the number of resources updated
    """
    count = 0

    for resource in LearningResource.objects.filter(published=True).iterator():
        resource.view_count = resource.views.count()
        resource.save()

        count += 1

    return count
