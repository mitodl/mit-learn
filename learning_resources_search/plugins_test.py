"""Tests for learning_resources_search plugins"""

from types import SimpleNamespace

import pytest

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
        resource_type=resource_type, test_mode=test_mode
    )
    if resource_type == COURSE_TYPE and has_content_files:
        for run in resource.runs.all():
            ContentFileFactory.create(run=run)
    unpublish_run_mock = mocker.patch(
        "learning_resources_search.plugins.tasks.deindex_run_content_files.si"
    )
    SearchIndexPlugin().resource_unpublished(resource)
    mock_search_index_helpers.mock_remove_learning_resource_immutable_signature.assert_called_once_with(
        resource.id, resource.resource_type
    )
    if resource_type == COURSE_TYPE and has_content_files and not test_mode:
        assert unpublish_run_mock.call_count == resource.runs.count()
        for run in resource.runs.all():
            unpublish_run_mock.assert_any_call(run.id, unpublished_only=False)
    else:
        unpublish_run_mock.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize("resource_type", [COURSE_TYPE, PROGRAM_TYPE])
def test_search_index_plugin_resource_before_delete(
    mock_search_index_helpers, resource_type
):
    """The plugin function should remove a resource from the search index then delete the resource"""
    resource = LearningResourceFactory.create(resource_type=resource_type)
    resource_id = resource.id
    SearchIndexPlugin().resource_before_delete(resource)

    mock_search_index_helpers.mock_remove_learning_resource_immutable_signature.assert_called_once_with(
        resource_id, resource.resource_type
    )


@pytest.mark.django_db
@pytest.mark.parametrize("has_content_files", [True, False])
@pytest.mark.parametrize("test_mode", [True, False])
def test_search_index_plugin_resource_run_unpublished(
    mock_search_index_helpers, has_content_files, test_mode
):
    """The plugin function should remove a run's contenfiles from the search index"""
    run = LearningResourceRunFactory.create(learning_resource__test_mode=test_mode)
    if has_content_files:
        ContentFileFactory.create(run=run)
    SearchIndexPlugin().resource_run_unpublished(run)
    if has_content_files and not test_mode:
        mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_called_once_with(
            run.id,
            unpublished_only=False,
        )
    else:
        mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize("has_content_files", [True, False])
@pytest.mark.parametrize("test_mode", [True, False])
def test_search_index_plugin_resource_run_delete(
    mock_search_index_helpers, has_content_files, test_mode
):
    """The plugin function should remove contenfiles from the index and delete the run"""
    run = LearningResourceRunFactory.create(learning_resource__test_mode=test_mode)
    if has_content_files:
        ContentFileFactory.create(run=run)
    run_id = run.id
    SearchIndexPlugin().resource_run_delete(run)
    if has_content_files and not test_mode:
        mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_called_once_with(
            run_id,
            unpublished_only=False,
        )
    else:
        mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_not_called()
    assert LearningResourceRun.objects.filter(id=run_id).exists() is False


@pytest.mark.django_db
def test_search_index_plugin_content_files_loaded_published_run(
    mock_search_index_helpers,
):
    """Published run should index content files and remove unpublished ones."""
    run = LearningResourceRunFactory.create(published=True)
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
    run = LearningResourceRunFactory.create(published=True)
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
def test_search_index_plugin_content_files_loaded_unpublished_run_with_qdrant(
    mock_search_index_helpers, settings
):
    """Unpublished run should deindex and remove all run content files."""
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    run = LearningResourceRunFactory.create(published=False)
    ContentFileFactory.create(run=run)

    SearchIndexPlugin().content_files_loaded(run)

    mock_search_index_helpers.mock_remove_contentfiles_immutable_signature.assert_called_once_with(
        run.id,
        unpublished_only=False,
    )
    mock_search_index_helpers.mock_remove_run_contentfiles_immutable_signature.assert_called_once_with(
        run.id
    )


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
