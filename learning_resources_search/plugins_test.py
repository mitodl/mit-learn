"""Tests for learning_resources_search plugins"""

from types import SimpleNamespace

import pytest

from learning_resources.etl.constants import ETLSource
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
)
from learning_resources.models import LearningResourceRun
from learning_resources_search.constants import COURSE_TYPE, PROGRAM_TYPE
from learning_resources_search.plugins import SearchIndexPlugin


@pytest.fixture
def mock_search_index_helpers(mocker):
    """Mock the search index helpers"""
    mock_upsert_learning_resource = mocker.patch(
        "learning_resources_search.plugins.tasks.upsert_learning_resource"
    )
    mock_upsert_learning_resource_immutable_signature = mocker.patch(
        "learning_resources_search.plugins.tasks.upsert_learning_resource.si"
    )
    mock_remove_learning_resource = mocker.patch(
        "learning_resources_search.plugins.tasks.deindex_document"
    )
    mock_remove_learning_resource_immutable_signature = mocker.patch(
        "learning_resources_search.plugins.tasks.deindex_document.si"
    )
    mock_upsert_contentfiles = mocker.patch(
        "learning_resources_search.plugins.tasks.index_run_content_files"
    )
    mock_upsert_contentfiles_immutable_signature = mocker.patch(
        "learning_resources_search.plugins.tasks.index_run_content_files.si"
    )
    mock_remove_contentfiles = mocker.patch(
        "learning_resources_search.plugins.tasks.deindex_run_content_files"
    )
    mock_remove_contentfiles_immutable_signature = mocker.patch(
        "learning_resources_search.plugins.tasks.deindex_run_content_files.si"
    )
    mock_embed_run_contentfiles_immutable_signature = mocker.patch(
        "learning_resources_search.plugins.vector_tasks.embed_run_content_files.si"
    )
    mock_remove_unpublished_run_contentfiles_immutable_signature = mocker.patch(
        "learning_resources_search.plugins.vector_tasks.remove_unpublished_run_content_files.si"
    )
    mock_remove_run_contentfiles_immutable_signature = mocker.patch(
        "learning_resources_search.plugins.vector_tasks.remove_run_content_files.si"
    )
    mock_generate_embeddings_immutable_signature = mocker.patch(
        "learning_resources_search.plugins.vector_tasks.generate_embeddings.si"
    )

    return SimpleNamespace(
        mock_upsert_learning_resource=mock_upsert_learning_resource,
        mock_upsert_learning_resource_immutable_signature=mock_upsert_learning_resource_immutable_signature,
        mock_remove_learning_resource=mock_remove_learning_resource,
        mock_remove_learning_resource_immutable_signature=mock_remove_learning_resource_immutable_signature,
        mock_upsert_contentfiles=mock_upsert_contentfiles,
        mock_upsert_contentfiles_immutable_signature=mock_upsert_contentfiles_immutable_signature,
        mock_remove_contentfiles=mock_remove_contentfiles,
        mock_remove_contentfiles_immutable_signature=mock_remove_contentfiles_immutable_signature,
        mock_embed_run_contentfiles_immutable_signature=mock_embed_run_contentfiles_immutable_signature,
        mock_remove_unpublished_run_contentfiles_immutable_signature=mock_remove_unpublished_run_contentfiles_immutable_signature,
        mock_remove_run_contentfiles_immutable_signature=mock_remove_run_contentfiles_immutable_signature,
        mock_generate_embeddings_immutable_signature=mock_generate_embeddings_immutable_signature,
    )


@pytest.mark.django_db
@pytest.mark.parametrize("resource_type", [COURSE_TYPE, PROGRAM_TYPE])
def test_search_index_plugin_resource_upserted(
    mock_search_index_helpers, resource_type
):
    """The plugin function should upsert a resource to the search index"""
    resource = LearningResourceFactory.create(resource_type=resource_type)
    SearchIndexPlugin().resource_upserted(
        resource, percolate=False, generate_embeddings=False
    )

    mock_search_index_helpers.mock_upsert_learning_resource_immutable_signature.assert_called_once_with(
        resource.id
    )


@pytest.mark.django_db
@pytest.mark.parametrize("resource_type", [COURSE_TYPE, PROGRAM_TYPE])
@pytest.mark.parametrize("has_content_files", [True, False])
@pytest.mark.parametrize("test_mode", [True, False])
def test_search_index_plugin_resource_unpublished(
    mocker, mock_search_index_helpers, resource_type, has_content_files, test_mode
):
    """The plugin function should remove a resource from the search index"""
    resource = LearningResourceFactory.create(
        resource_type=resource_type, test_mode=test_mode, published=False
    )
    if resource_type == COURSE_TYPE and has_content_files:
        for run in resource.runs.all():
            ContentFileFactory.create(run=run)
    marketing_page = ContentFileFactory.create(learning_resource=resource)
    unpublish_run_mock = mocker.patch(
        "learning_resources_search.plugins.tasks.deindex_run_content_files.si"
    )
    deindex_direct_files_mock = mocker.patch(
        "learning_resources_search.plugins.tasks.deindex_content_files.si"
    )
    SearchIndexPlugin().resource_unpublished(resource)
    mock_search_index_helpers.mock_remove_learning_resource_immutable_signature.assert_called_once_with(
        resource.id, resource.resource_type
    )
    if resource_type == COURSE_TYPE and has_content_files and not test_mode:
        assert unpublish_run_mock.call_count == resource.runs.count()
        for run in resource.runs.all():
            # Default "mock" source is non-retained -> removed from both indexes.
            unpublish_run_mock.assert_any_call(run.id, unpublished_only=False)
    else:
        unpublish_run_mock.assert_not_called()
    if test_mode:
        deindex_direct_files_mock.assert_not_called()
    else:
        deindex_direct_files_mock.assert_called_once_with(
            [marketing_page.id], resource.id, resource_type=resource.resource_type
        )


@pytest.mark.django_db
@pytest.mark.parametrize("resource_type", [COURSE_TYPE, PROGRAM_TYPE])
def test_search_index_plugin_bulk_resources_unpublished_direct_files(
    mocker, resource_type
):
    """bulk_resources_unpublished should deindex the resources' direct content files"""
    resources = LearningResourceFactory.create_batch(
        2, resource_type=resource_type, published=False
    )
    marketing_pages = {
        resource.id: ContentFileFactory.create(learning_resource=resource)
        for resource in resources
    }
    mocker.patch(
        "learning_resources_search.plugins.tasks.bulk_deindex_learning_resources.si"
    )
    deindex_direct_files_mock = mocker.patch(
        "learning_resources_search.plugins.tasks.deindex_content_files.si"
    )
    SearchIndexPlugin().bulk_resources_unpublished(
        [resource.id for resource in resources], resource_type
    )
    assert deindex_direct_files_mock.call_count == len(resources)
    for resource in resources:
        deindex_direct_files_mock.assert_any_call(
            [marketing_pages[resource.id].id],
            resource.id,
            resource_type=resource_type,
        )


@pytest.mark.django_db
@pytest.mark.parametrize("resource_type", [COURSE_TYPE, PROGRAM_TYPE])
@pytest.mark.parametrize("test_mode", [True, False])
def test_search_index_plugin_resource_before_delete(
    mock_search_index_helpers, resource_type, test_mode
):
    """The plugin function should remove a resource from the search index then delete the resource"""
    resource = LearningResourceFactory.create(
        resource_type=resource_type,
        test_mode=test_mode,
    )
    if resource_type == COURSE_TYPE:
        for run in resource.runs.all():
            ContentFileFactory.create(run=run)

    resource_id = resource.id
    SearchIndexPlugin().resource_before_delete(resource)

    mock_search_index_helpers.mock_remove_learning_resource_immutable_signature.assert_called_once_with(
        resource_id, resource.resource_type
    )
    assert resource.test_mode is False

    if resource_type == COURSE_TYPE:
        assert (
            mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.call_count
            == resource.runs.count()
        )
        for run in resource.runs.all():
            mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_any_call(
                run.id, unpublished_only=False
            )
    else:
        mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_not_called()


@pytest.mark.django_db
def test_resource_before_delete_retained_source_purges_qdrant(
    mock_search_index_helpers, settings
):
    """Deleting a retained-source course purges each run's content from Qdrant,
    since resource_run_unpublished would otherwise keep retained sources there.
    """
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    resource = LearningResourceFactory.create(
        resource_type=COURSE_TYPE,
        etl_source=ETLSource.mitxonline.value,
        create_runs=False,
    )
    runs = LearningResourceRunFactory.create_batch(
        2, learning_resource=resource, published=True
    )
    for run in runs:
        ContentFileFactory.create(run=run)

    SearchIndexPlugin().resource_before_delete(resource)

    assert (
        mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.call_count
        == len(runs)
    )
    for run in runs:
        mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.assert_any_call(
            run.id
        )


@pytest.mark.django_db
@pytest.mark.parametrize("course_published", [True, False])
def test_resource_run_unpublished_retained_source_keeps_qdrant(
    mock_search_index_helpers, settings, course_published
):
    """edX/Canvas: run leaves OpenSearch (keep_published) but ALWAYS stays in
    Qdrant -- even when the whole course is unpublished.
    """
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    run = LearningResourceRunFactory.create(
        published=False,
        learning_resource__published=course_published,
        learning_resource__test_mode=False,
        learning_resource__etl_source=ETLSource.mitxonline.value,
    )
    ContentFileFactory.create(run=run)

    SearchIndexPlugin().resource_run_unpublished(run)

    mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_called_once_with(
        run.id, unpublished_only=False, keep_published=True
    )
    mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.assert_not_called()


@pytest.mark.django_db
def test_resource_run_unpublished_non_retained_source_removes_both(
    mock_search_index_helpers, settings
):
    """OCW (non-retained): run is removed from BOTH indexes (current behavior)."""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    run = LearningResourceRunFactory.create(
        published=False,
        learning_resource__published=True,
        learning_resource__test_mode=False,
        learning_resource__etl_source=ETLSource.ocw.value,
    )
    ContentFileFactory.create(run=run)

    SearchIndexPlugin().resource_run_unpublished(run)

    mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_called_once_with(
        run.id, unpublished_only=False
    )
    mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )


@pytest.mark.django_db
@pytest.mark.parametrize("has_content_files", [True, False])
def test_resource_run_unpublished_test_mode_or_empty_noops(
    mock_search_index_helpers, settings, has_content_files
):
    """test_mode (any source) or a run with no content files -> no-op."""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    run = LearningResourceRunFactory.create(
        published=False,
        learning_resource__published=True,
        learning_resource__test_mode=True,
        learning_resource__etl_source=ETLSource.mitxonline.value,
    )
    if has_content_files:
        ContentFileFactory.create(run=run)

    SearchIndexPlugin().resource_run_unpublished(run)

    mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_not_called()
    mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.assert_not_called()


@pytest.mark.django_db
def test_resource_unpublished_course_purges_runs_from_qdrant(
    mock_search_index_helpers, settings
):
    """Unpublishing a whole course purges each run's content files from Qdrant."""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    resource = LearningResourceFactory.create(
        resource_type=COURSE_TYPE, published=False, test_mode=False, create_runs=False
    )
    runs = LearningResourceRunFactory.create_batch(
        2, learning_resource=resource, published=False
    )
    for run in runs:
        ContentFileFactory.create(run=run)

    SearchIndexPlugin().resource_unpublished(resource)

    assert (
        mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.call_count
        == len(runs)
    )
    for run in runs:
        mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.assert_any_call(
            run.id
        )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "etl_source", [ETLSource.mitxonline.value, ETLSource.ocw.value]
)
@pytest.mark.parametrize("has_content_files", [True, False])
@pytest.mark.parametrize("test_mode", [True, False])
def test_search_index_plugin_resource_run_delete(
    mock_search_index_helpers, settings, etl_source, has_content_files, test_mode
):
    """Deleting a run always purges BOTH indexes and deletes the object,
    regardless of source, test_mode, or whether content files exist.
    """
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    run = LearningResourceRunFactory.create(
        learning_resource__published=True,
        learning_resource__test_mode=test_mode,
        learning_resource__etl_source=etl_source,
    )
    if has_content_files:
        ContentFileFactory.create(run=run)
    run_id = run.id

    SearchIndexPlugin().resource_run_delete(run)

    mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_called_once_with(
        run_id, unpublished_only=False
    )
    mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.assert_called_once_with(
        run_id
    )
    assert LearningResourceRun.objects.filter(id=run_id).exists() is False


@pytest.mark.django_db
def test_search_index_plugin_content_files_loaded_published_run(
    mock_search_index_helpers,
):
    """Published run should index content files and remove unpublished ones."""
    run = LearningResourceRunFactory.create(
        published=True, learning_resource__create_runs=False
    )
    ContentFileFactory.create(run=run)

    SearchIndexPlugin().content_files_loaded(run)

    mock_search_index_helpers.mock_upsert_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )


@pytest.mark.django_db
def test_search_index_plugin_content_files_loaded_published_run_with_qdrant(
    mock_search_index_helpers, settings
):
    """Published run should schedule Qdrant embed and unpublished cleanup."""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    run = LearningResourceRunFactory.create(
        published=True, learning_resource__create_runs=False
    )
    ContentFileFactory.create(run=run)

    SearchIndexPlugin().content_files_loaded(run)

    mock_search_index_helpers.mock_embed_run_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )
    mock_search_index_helpers.mock_upsert_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )
    mock_search_index_helpers.mock_remove_unpublished_run_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )


@pytest.mark.django_db
def test_content_files_loaded_unpublished_run_embeds_qdrant_only(
    mock_search_index_helpers, settings
):
    """An unpublished run is embedded into Qdrant but NOT indexed into OpenSearch."""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    run = LearningResourceRunFactory.create(
        published=False, learning_resource__published=True
    )
    ContentFileFactory.create(run=run)

    SearchIndexPlugin().content_files_loaded(run)

    mock_search_index_helpers.mock_embed_run_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )
    mock_search_index_helpers.mock_remove_unpublished_run_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )
    # OpenSearch indexing is skipped for a non-published run.
    mock_search_index_helpers.mock_upsert_contentfiles_immutable_signature.assert_not_called()
    # The old behavior (deindex / remove from Qdrant) no longer fires here.
    mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_not_called()
    mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.assert_not_called()


@pytest.mark.django_db
def test_content_files_loaded_non_best_published_run_skips_opensearch(
    mock_search_index_helpers, settings
):
    """A published-but-not-best run embeds to Qdrant only (no OpenSearch index)."""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    from datetime import UTC, datetime

    course = LearningResourceFactory.create(published=True, create_runs=False)
    LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        start_date=datetime(2023, 1, 1, tzinfo=UTC),
    )  # best run
    non_best = LearningResourceRunFactory.create(
        learning_resource=course,
        published=True,
        start_date=datetime(2022, 1, 1, tzinfo=UTC),
    )
    ContentFileFactory.create(run=non_best)

    SearchIndexPlugin().content_files_loaded(non_best)

    mock_search_index_helpers.mock_embed_run_contentfiles_immutable_signature.assert_called_once_with(
        non_best.id
    )
    mock_search_index_helpers.mock_upsert_contentfiles_immutable_signature.assert_not_called()


@pytest.mark.django_db
def test_content_files_loaded_test_mode_published_run_indexes_opensearch(
    mock_search_index_helpers, settings
):
    """Any published run of a test_mode course is indexed into OpenSearch."""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    course = LearningResourceFactory.create(
        published=False, test_mode=True, create_runs=False
    )
    run = LearningResourceRunFactory.create(learning_resource=course, published=True)
    ContentFileFactory.create(run=run)

    SearchIndexPlugin().content_files_loaded(run)

    mock_search_index_helpers.mock_upsert_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )
    mock_search_index_helpers.mock_embed_run_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )


@pytest.mark.django_db
def test_content_files_loaded_variant_run_skips_opensearch(
    mock_search_index_helpers, settings
):
    """Variant runs should be embedded in Qdrant but skipped in OpenSearch."""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    course = LearningResourceFactory.create(
        published=False, test_mode=True, create_runs=False
    )
    run = LearningResourceRunFactory.create(
        learning_resource=course, published=True, is_b2b=True, is_variant=True
    )
    ContentFileFactory.create(run=run)

    SearchIndexPlugin().content_files_loaded(run)

    mock_search_index_helpers.mock_upsert_contentfiles_immutable_signature.assert_not_called()
    mock_search_index_helpers.mock_embed_run_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )
    mock_search_index_helpers.mock_remove_unpublished_run_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )
    mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_not_called()
    mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize("qdrant_enabled", [True, False])
def test_content_files_loaded_retired_course_does_nothing(
    mock_search_index_helpers, settings, qdrant_enabled
):
    """A fully-retired course (unpublished, non-test_mode) is neither embedded
    into Qdrant nor indexed into OpenSearch.
    """
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = qdrant_enabled
    run = LearningResourceRunFactory.create(
        published=False,
        learning_resource__published=False,
        learning_resource__test_mode=False,
    )
    ContentFileFactory.create(run=run)

    SearchIndexPlugin().content_files_loaded(run)

    mock_search_index_helpers.mock_embed_run_contentfiles_immutable_signature.assert_not_called()
    mock_search_index_helpers.mock_remove_unpublished_run_contentfiles_immutable_signature.assert_not_called()
    mock_search_index_helpers.mock_upsert_contentfiles_immutable_signature.assert_not_called()


@pytest.mark.django_db
def test_resource_similar_topics(mocker, settings):
    """The plugin function should return expected topics for a resource"""
    expected_topics = ["topic1", "topic2"]
    mock_similar_topics = mocker.patch(
        "learning_resources_search.plugins.get_similar_topics_qdrant",
        return_value=expected_topics,
    )
    resource = LearningResourceFactory.create()
    topics = SearchIndexPlugin().resource_similar_topics(resource)
    assert topics == [{"name": topic} for topic in expected_topics]
    mock_similar_topics.assert_called_once_with(
        resource,
        {
            "title": resource.title,
            "description": resource.description,
            "full_description": resource.full_description,
        },
        settings.OPEN_VIDEO_MAX_TOPICS,
    )


@pytest.mark.django_db
@pytest.mark.parametrize("resource_type", [COURSE_TYPE, PROGRAM_TYPE])
def test_search_index_plugin_resource_upserted_generate_embeddings(
    mock_search_index_helpers, resource_type, settings
):
    """Test upsert plugin with generate_embeddings_flag"""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    resource = LearningResourceFactory.create(resource_type=resource_type)

    SearchIndexPlugin().resource_upserted(
        resource, percolate=False, generate_embeddings=False
    )
    mock_search_index_helpers.mock_generate_embeddings_immutable_signature.assert_not_called()
    mock_search_index_helpers.mock_upsert_learning_resource_immutable_signature.assert_called_once_with(
        resource.id
    )
    SearchIndexPlugin().resource_upserted(
        resource, percolate=False, generate_embeddings=True
    )
    mock_search_index_helpers.mock_generate_embeddings_immutable_signature.assert_called_once_with(
        [resource.id], resource_type, overwrite=True
    )


@pytest.mark.django_db
def test_content_files_loaded_always_purges_unpublished(
    mock_search_index_helpers, settings
):
    """The remove-unpublished task always runs so failed removals self-heal."""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    run = LearningResourceRunFactory.create(
        published=True, learning_resource__create_runs=False
    )
    ContentFileFactory.create(run=run)

    SearchIndexPlugin().content_files_loaded(run)

    mock_search_index_helpers.mock_remove_unpublished_run_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )
