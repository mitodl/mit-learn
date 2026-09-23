"""Tests for the shared content file selectors"""

import pytest

from learning_resources.etl.constants import ETLSource
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
)
from learning_resources.models import LearningResource
from learning_resources_search.selectors import (
    opensearch_content_files,
    qdrant_content_files,
    run_content_files_deindex_targets,
)

pytestmark = pytest.mark.django_db


def _course_with_runs(**kwargs):
    """Create a course with a best run, an older published run, a variant and an unpublished run"""
    course = LearningResourceFactory.create(is_course=True, create_runs=False, **kwargs)
    best = LearningResourceRunFactory.create(learning_resource=course, published=True)
    older = LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        start_date=best.start_date.replace(year=2000),
    )
    variant = LearningResourceRunFactory.create(
        learning_resource=course, published=True, is_variant=True
    )
    unpublished = LearningResourceRunFactory.create(
        learning_resource=course, published=False
    )
    files = {
        run: ContentFileFactory.create(run=run, published=True)
        for run in (best, older, variant, unpublished)
    }
    files["direct"] = ContentFileFactory.create(
        learning_resource=course, published=True
    )
    files["withdrawn"] = ContentFileFactory.create(run=best, published=False)
    assert course.best_run == best
    return course, (best, older), files


def test_opensearch_content_files_best_run_and_direct_only():
    """OpenSearch gets the best run's published files plus the resource's direct files"""
    course, (best, _), files = _course_with_runs()

    assert set(opensearch_content_files(course)) == {files[best], files["direct"]}


def test_opensearch_content_files_test_mode_any_published_non_variant_run():
    """A test_mode course indexes every published non-variant run"""
    course, (best, older), files = _course_with_runs(published=False, test_mode=True)

    assert set(opensearch_content_files(course)) == {
        files[best],
        files[older],
        files["direct"],
    }


@pytest.mark.parametrize("published", [True, False])
def test_opensearch_content_files_canvas_needs_published(published):
    """test_mode alone keeps a Canvas course out of OpenSearch, but not Qdrant"""
    course, (best, _), files = _course_with_runs(
        etl_source=ETLSource.canvas.name, published=published, test_mode=True
    )

    expected = {files[best], files["direct"]} if published else set()
    assert set(opensearch_content_files(course)) == expected
    assert qdrant_content_files(LearningResource.objects.filter(id=course.id)).exists()


def test_opensearch_content_files_unpublished_course_has_none():
    """An unpublished, non-test_mode course indexes nothing"""
    course, _, _ = _course_with_runs(published=False)

    assert not opensearch_content_files(course).exists()


def test_qdrant_content_files_every_run():
    """Qdrant gets published files of every run, published or not, plus direct files"""
    course, _, files = _course_with_runs()

    assert set(qdrant_content_files(LearningResource.objects.filter(id=course.id))) == {
        cf for key, cf in files.items() if key != "withdrawn"
    }


def test_qdrant_content_files_unpublished_course_has_none():
    """Files of an unpublished, non-test_mode course are not embedded"""
    course, _, _ = _course_with_runs(published=False)
    test_course, _, test_files = _course_with_runs(published=False, test_mode=True)

    selected = set(
        qdrant_content_files(
            LearningResource.objects.filter(id__in=[course.id, test_course.id])
        )
    )

    assert selected == {cf for key, cf in test_files.items() if key != "withdrawn"}


@pytest.mark.parametrize(
    ("etl_source", "test_mode", "expected"),
    [
        (ETLSource.mitxonline.value, False, [True]),
        (ETLSource.ocw.value, False, [False]),
        (ETLSource.mitxonline.value, True, []),
    ],
)
def test_run_content_files_deindex_targets(etl_source, test_mode, expected):
    """test_mode runs are skipped; retained sources keep their files published"""
    course = LearningResourceFactory.create(
        is_course=True, create_runs=True, etl_source=etl_source, test_mode=test_mode
    )
    run = course.runs.first()

    targets = list(run_content_files_deindex_targets([run]))

    assert [keep for _, keep in targets] == expected
    assert [target_run for target_run, _ in targets] == ([run] if expected else [])
