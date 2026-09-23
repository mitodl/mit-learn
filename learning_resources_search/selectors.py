"""
Which content files belong in each index.

OpenSearch carries a course's best published run only (any published
non-variant run of a test_mode course, except Canvas, whose private course
material is only searchable once published); Qdrant carries every run. Both
carry files attached directly to the resource. Unpublishing leaves test_mode
resources' files alone and, for QDRANT_RETAINED_SOURCES, removes them from
OpenSearch without unpublishing the rows so they stay in Qdrant.
"""

from django.db.models import Q

from learning_resources.etl.constants import QDRANT_RETAINED_SOURCES, ETLSource
from learning_resources.models import ContentFile, LearningResourceRun


def _opensearch_test_mode(resource):
    """Whether test_mode alone puts `resource` in OpenSearch."""
    return resource.test_mode and resource.etl_source != ETLSource.canvas.name


def opensearch_runs(resource):
    """Select the runs of `resource` whose content files belong in OpenSearch."""
    if not resource.published and not _opensearch_test_mode(resource):
        return LearningResourceRun.objects.none()
    if _opensearch_test_mode(resource):
        return resource.runs.filter(published=True, is_variant=False)
    best_run = resource.best_run
    return resource.runs.filter(id=best_run.id) if best_run else resource.runs.none()


def opensearch_content_files(resource):
    """Select the published content files of `resource` that belong in OpenSearch."""
    if not resource.published and not _opensearch_test_mode(resource):
        return ContentFile.objects.none()
    return ContentFile.objects.filter(published=True).filter(
        Q(learning_resource_id=resource.id) | Q(run__in=opensearch_runs(resource))
    )


def qdrant_content_files(resources):
    """
    Select the published content files of every run of, or attached directly
    to, the published or test_mode resources in the `resources` queryset.
    """
    eligible = resources.filter(Q(published=True) | Q(test_mode=True))
    return ContentFile.objects.filter(published=True).filter(
        Q(run__learning_resource__in=eligible) | Q(learning_resource__in=eligible)
    )


def run_content_files_deindex_targets(runs):
    """
    Yield (run, keep_published) for each run whose content files leave
    OpenSearch when it or its resource is unpublished. test_mode resources are
    skipped; retained sources keep the rows published so they stay in Qdrant.
    """
    for run in runs:
        resource = run.learning_resource
        if resource.test_mode:
            continue
        yield run, resource.etl_source in QDRANT_RETAINED_SOURCES
