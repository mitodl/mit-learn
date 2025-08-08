from decimal import Decimal

import pytest
from django.conf import settings
from qdrant_client import models
from qdrant_client.models import PointStruct

from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourcePriceFactory,
    LearningResourceRunFactory,
)
from learning_resources.models import LearningResource
from learning_resources_search.serializers import (
    serialize_bulk_content_files,
    serialize_bulk_learning_resources,
)
from vector_search.constants import (
    CONTENT_FILES_COLLECTION_NAME,
    QDRANT_CONTENT_FILE_PARAM_MAP,
    QDRANT_RESOURCE_PARAM_MAP,
    RESOURCES_COLLECTION_NAME,
)
from vector_search.encoders.utils import dense_encoder
from vector_search.utils import (
    _chunk_documents,
    _embed_course_metadata_as_contentfile,
    create_qdrant_collections,
    embed_learning_resources,
    filter_existing_qdrant_points,
    qdrant_query_conditions,
    should_generate_content_embeddings,
    should_generate_resource_embeddings,
    update_content_file_payload,
    update_learning_resource_payload,
    vector_point_id,
    vector_search,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("content_type", ["course", "content_file"])
def test_vector_point_id_used_for_embed(mocker, content_type):
    # test the vector ids we generate for embedding resources and files
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    if content_type == "course":
        resources = LearningResourceFactory.create_batch(5)
        mocker.patch(
            "vector_search.utils.filter_existing_qdrant_points",
            return_value=[r.readable_id for r in resources],
        )
    else:
        resources = ContentFileFactory.create_batch(5, content="test content")

    summarize_content_files_by_ids_mock = mocker.patch(
        "vector_search.utils.ContentSummarizer.summarize_content_files_by_ids"
    )

    embed_learning_resources(
        [resource.id for resource in resources], content_type, overwrite=True
    )

    if content_type == "course":
        point_ids = [vector_point_id(resource.readable_id) for resource in resources]
        assert sorted(
            [
                p.id
                for p in mock_qdrant.batch_update_points.mock_calls[0]
                .kwargs["update_operations"][0]
                .upsert.points
            ]
        ) == sorted(point_ids)
    else:
        point_ids = [
            vector_point_id(
                f"{resource['resource_readable_id']}.{resource['run_readable_id']}.{resource['key']}.0"
            )
            for resource in serialize_bulk_content_files([r.id for r in resources])
        ]
        assert sorted(
            [
                p.id
                for p in mock_qdrant.batch_update_points.mock_calls[0]
                .kwargs["update_operations"][0]
                .upsert.points
            ]
        ) == sorted(point_ids)
        # TODO: Pass "[resource.id for resource in resources]" instead of [] when we want the scheduled content file summarization  # noqa: FIX002, TD002, TD003
        summarize_content_files_by_ids_mock.assert_called_once_with(
            [],
            True,  # noqa: FBT003
        )


@pytest.mark.parametrize("content_type", ["course", "content_file"])
def test_embed_learning_resources_no_overwrite(mocker, content_type):
    # test when overwrite flag is false we dont re-embed existing resources
    if content_type == "course":
        resources = LearningResourceFactory.create_batch(5)
    else:
        resources = ContentFileFactory.create_batch(5, content="test content")
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    if content_type == "course":
        # filter out 3 resources that are already embedded
        mocker.patch(
            "vector_search.utils.filter_existing_qdrant_points_by_ids",
            return_value=[vector_point_id(r.readable_id) for r in resources[0:2]],
        )
    else:
        # all contentfiles exist in qdrant
        mocker.patch(
            "vector_search.utils.filter_existing_qdrant_points_by_ids",
            return_value=[
                vector_point_id(
                    f"{doc['resource_readable_id']}.{doc['run_readable_id']}.{doc['key']}.0"
                )
                for doc in serialize_bulk_content_files([r.id for r in resources[0:3]])
            ],
        )
    summarize_content_files_by_ids_mock = mocker.patch(
        "vector_search.utils.ContentSummarizer.summarize_content_files_by_ids"
    )
    embed_learning_resources(
        [resource.id for resource in resources], content_type, overwrite=False
    )

    if content_type == "course":
        assert (
            len(
                list(
                    mock_qdrant.batch_update_points.mock_calls[0]
                    .kwargs["update_operations"][0]
                    .upsert.points
                )
            )
            == 2
        )
    else:
        assert (
            len(
                list(
                    mock_qdrant.batch_update_points.mock_calls[0]
                    .kwargs["update_operations"][0]
                    .upsert.points
                )
            )
            == 3
        )
        # TODO: Pass "[resource.id for resource in resources]" instead of [] when we want the scheduled content file summarization  # noqa: FIX002, TD002, TD003
        summarize_content_files_by_ids_mock.assert_called_once_with(
            [],
            False,  # noqa: FBT003
        )


def test_filter_existing_qdrant_points(mocker):
    """
    Test that filter_existing_qdrant_points filters out
    resources that are already embedded in Qdrant
    """
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    resources = LearningResourceFactory.create_batch(10)
    already_embedded = resources[:3]
    mock_qdrant.scroll.return_value = [
        [
            PointStruct(
                id=resource.id,
                payload={"readable_id": resource.readable_id},
                vector=[0, 0, 0, 0],
            )
            for resource in already_embedded
        ],
        None,
    ]
    readable_ids = [r.readable_id for r in resources]
    filtered_readable_ids = filter_existing_qdrant_points(
        readable_ids, lookup_field="readable_id", collection_name="test.resources"
    )
    filtered_resources = LearningResource.objects.filter(
        readable_id__in=filtered_readable_ids
    )
    assert (
        len(
            [
                res.id
                for res in already_embedded
                if res.id in filtered_resources.values_list("id", flat=True)
            ]
        )
        == 0
    )
    assert filtered_resources.count() == 7


def test_force_create_qdrant_collections(mocker):
    """
    Test that the force flag will recreate collections
    even if they exist
    """
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.collection_exists.return_value = True
    create_qdrant_collections(force_recreate=True)
    assert (
        mock_qdrant.recreate_collection.mock_calls[0].kwargs["collection_name"]
        == RESOURCES_COLLECTION_NAME
    )
    assert (
        mock_qdrant.recreate_collection.mock_calls[1].kwargs["collection_name"]
        == CONTENT_FILES_COLLECTION_NAME
    )
    assert (
        "dummy-embedding"
        in mock_qdrant.recreate_collection.mock_calls[0].kwargs["vectors_config"]
    )
    assert (
        "dummy-embedding"
        in mock_qdrant.recreate_collection.mock_calls[1].kwargs["vectors_config"]
    )


def test_auto_create_qdrant_collections(mocker):
    """
    Test that collections will get autocreated if they
    don't exist
    """
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.collection_exists.return_value = False
    create_qdrant_collections(force_recreate=False)
    assert (
        mock_qdrant.recreate_collection.mock_calls[0].kwargs["collection_name"]
        == RESOURCES_COLLECTION_NAME
    )
    assert (
        mock_qdrant.recreate_collection.mock_calls[1].kwargs["collection_name"]
        == CONTENT_FILES_COLLECTION_NAME
    )
    assert (
        "dummy-embedding"
        in mock_qdrant.recreate_collection.mock_calls[0].kwargs["vectors_config"]
    )
    assert (
        "dummy-embedding"
        in mock_qdrant.recreate_collection.mock_calls[1].kwargs["vectors_config"]
    )


def test_skip_creating_qdrand_collections(mocker):
    """
    Test collections do not get recreated
    if they exist and force_recreate is False
    """
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.collection_exists.return_value = False
    create_qdrant_collections(force_recreate=False)
    assert (
        mock_qdrant.recreate_collection.mock_calls[0].kwargs["collection_name"]
        == RESOURCES_COLLECTION_NAME
    )
    assert (
        mock_qdrant.recreate_collection.mock_calls[1].kwargs["collection_name"]
        == CONTENT_FILES_COLLECTION_NAME
    )
    assert (
        "dummy-embedding"
        in mock_qdrant.recreate_collection.mock_calls[0].kwargs["vectors_config"]
    )
    assert (
        "dummy-embedding"
        in mock_qdrant.recreate_collection.mock_calls[1].kwargs["vectors_config"]
    )


def test_qdrant_query_conditions(mocker):
    """
    Test query filter mapping to qdrant conditions
    """
    params = {
        "q": "test",
        "topic": ["test topic 1", "test topic 2"],
        "offered_by": ["ocw", "edx"],
        "platform": ["edx"],
        "resource_type": ["course", "podcast"],
        "free": True,
    }
    query_conditions = qdrant_query_conditions(params)

    assert (
        models.FieldCondition(
            key="offered_by.code", match=models.MatchAny(any=["ocw", "edx"])
        )
        in query_conditions
    )
    assert (
        models.FieldCondition(key="platform.code", match=models.MatchAny(any=["edx"]))
        in query_conditions
    )
    assert (
        models.FieldCondition(
            key="resource_type", match=models.MatchAny(any=["course", "podcast"])
        )
        in query_conditions
    )
    assert (
        models.FieldCondition(
            key="topics[].name",
            match=models.MatchAny(any=["test topic 1", "test topic 2"]),
        )
        in query_conditions
    )
    # test that items not in the filter map are ignored
    assert (
        models.FieldCondition(key="q", match=models.MatchValue(value="test"))
        not in query_conditions
    )


def test_document_chunker(mocker):
    """
    Test that the correct splitter is returned based on encoder
    """
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = None
    settings.CONTENT_FILE_EMBEDDING_SEMANTIC_CHUNKING_ENABLED = True
    settings.LITELLM_TOKEN_ENCODING_NAME = None
    encoder = dense_encoder()
    encoder.token_encoding_name = None
    mocked_splitter = mocker.patch("vector_search.utils.RecursiveCharacterTextSplitter")
    mocked_chunker = mocker.patch("vector_search.utils.SemanticChunker")
    _chunk_documents(encoder, ["this is a test document"], [{}])

    mocked_chunker.assert_called()
    mocked_splitter.assert_called()

    settings.CONTENT_FILE_EMBEDDING_SEMANTIC_CHUNKING_ENABLED = False

    mocked_splitter = mocker.patch("vector_search.utils.RecursiveCharacterTextSplitter")
    mocked_chunker = mocker.patch("vector_search.utils.SemanticChunker")

    _chunk_documents(encoder, ["this is a test document"], [{}])
    mocked_chunker.assert_not_called()
    mocked_splitter.assert_called()


def test_document_chunker_tiktoken(mocker):
    """
    Test that we use tiktoken if a token encoding is specified
    """
    settings.LITELLM_TOKEN_ENCODING_NAME = None
    encoder = dense_encoder()
    encoder.token_encoding_name = None
    mocked_splitter = mocker.patch(
        "vector_search.utils.RecursiveCharacterTextSplitter.from_tiktoken_encoder"
    )

    _chunk_documents(encoder, ["this is a test document"], [{}])
    mocked_splitter.assert_not_called()

    settings.LITELLM_TOKEN_ENCODING_NAME = "test"  # noqa: S105
    _chunk_documents(encoder, ["this is a test document"], [{}])
    mocked_splitter.assert_called()


def test_text_splitter_chunk_size_override(mocker):
    """
    Test that we always use the recursive splitter if chunk size is overriden
    """
    chunk_size = 100
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = chunk_size
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = chunk_size / 10
    encoder = dense_encoder()
    mocked_splitter = mocker.patch("vector_search.utils.RecursiveCharacterTextSplitter")
    encoder.token_encoding_name = "cl100k_base"  # noqa: S105
    _chunk_documents(encoder, ["this is a test document"], [{}])
    assert mocked_splitter.mock_calls[0].kwargs["chunk_size"] == 100
    mocked_splitter = mocker.patch("vector_search.utils.RecursiveCharacterTextSplitter")
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = None
    _chunk_documents(encoder, ["this is a test document"], [{}])
    assert "chunk_size" not in mocked_splitter.mock_calls[0].kwargs


def test_course_metadata_indexed_with_learning_resources(mocker):
    # test the we embed a metadata document when embedding learning resources
    resources = LearningResourceFactory.create_batch(5)

    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mock_embed_course_metadata_as_contentfile = mocker.patch(
        "vector_search.utils._embed_course_metadata_as_contentfile"
    )
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )

    mocker.patch(
        "vector_search.utils.filter_existing_qdrant_points",
        return_value=[r.readable_id for r in resources],
    )
    embed_learning_resources(
        [resource.id for resource in resources], "course", overwrite=True
    )
    mock_embed_course_metadata_as_contentfile.assert_called()


def test_course_metadata_document_contents(mocker):
    # test the contents of the metadata document
    resource = LearningResourceFactory.create()

    run = LearningResourceRunFactory.create(
        learning_resource=resource,
        published=True,
        prices=[Decimal("1.00"), Decimal("50.00")],
        resource_prices=LearningResourcePriceFactory.create_batch(
            2, amount=Decimal("1.00")
        ),
        location="Portland, OR",
        duration="7 - 9 weeks",
        min_weeks=7,
        max_weeks=9,
        languages=["en", "es"],
        time_commitment="8 - 9 hours per week",
        min_weekly_hours=8,
        max_weekly_hours=19,
    )
    resource.prices = [Decimal("1.00"), Decimal("3.00")]
    resource.resource_prices.set(
        LearningResourcePriceFactory.create_batch(2, amount=1.00)
    )
    resource.save()

    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")

    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )

    serialized_resource = next(serialize_bulk_learning_resources([resource.id]))

    _embed_course_metadata_as_contentfile([serialized_resource])
    point = next(mock_qdrant.upload_points.mock_calls[0].kwargs["points"])
    course_metadata_content = point.payload["chunk_content"]
    assert course_metadata_content.startswith("# Information about this course:")
    assert resource.title in course_metadata_content
    assert resource.description in course_metadata_content
    assert resource.full_description in course_metadata_content

    for topic in resource.topics.all():
        assert topic.name in course_metadata_content
    for run in serialized_resource["runs"]:
        for level in run["level"]:
            assert level["name"] in course_metadata_content


def test_should_generate_for_changed_resource(mocker):
    """Should generate embeddings when resource content has changed"""
    resource = LearningResourceFactory.create()
    serialized_resources = list(serialize_bulk_learning_resources([resource.id]))

    mock_qdrant = mocker.MagicMock()
    fake_payload = {
        "title": "Different title",
        "description": serialized_resources[0]["description"],
        "full_description": serialized_resources[0]["full_description"],
    }
    mock_point = mocker.MagicMock()
    # return record with different title
    mock_point.payload = fake_payload
    mock_qdrant.retrieve.return_value = [mock_point]
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    result = should_generate_resource_embeddings(serialized_resources[0])
    assert result is True


def test_should_generate_for_changed_content_file(mocker):
    """Should generate embeddings when content file checksum has changed"""

    content_file = ContentFileFactory.create(content="Test content")
    serialized_files = list(serialize_bulk_content_files([content_file.id]))

    mock_qdrant = mocker.MagicMock()
    mock_point = mocker.MagicMock()
    # return record with different checksum
    mock_point.payload = {"checksum": "different-checksum"}
    mock_qdrant.retrieve.return_value = [mock_point]
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    result = should_generate_content_embeddings(serialized_files[0])
    assert result is True


def test_should_not_generate_for_unchanged_content_file(mocker):
    """Should not generate embeddings when content file hasn't changed"""

    content_file = ContentFileFactory.create(content="Test content")
    serialized_files = list(serialize_bulk_content_files([content_file.id]))

    mock_qdrant = mocker.MagicMock()
    mock_point = mocker.MagicMock()
    # return record with same checksum
    mock_point.payload = {"checksum": serialized_files[0]["checksum"]}
    mock_qdrant.retrieve.return_value = [mock_point]
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    result = should_generate_content_embeddings(serialized_files[0])
    assert result is False


def test_update_payload_learning_resource(mocker):
    """Should update payload for learning resources"""
    resource = LearningResourceFactory.create()
    serialized_resources = list(serialize_bulk_learning_resources([resource.id]))
    mock_qdrant = mocker.MagicMock()
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    update_learning_resource_payload(serialized_resources[0])
    mock_qdrant.set_payload.assert_called_once()
    call_args = mock_qdrant.set_payload.call_args[1]
    assert call_args["collection_name"] == RESOURCES_COLLECTION_NAME
    assert call_args["points"] == [
        vector_point_id(serialized_resources[0]["readable_id"])
    ]
    # Verify payload contains the mapped values
    for src_key, dest_key in QDRANT_RESOURCE_PARAM_MAP.items():
        if src_key in serialized_resources[0]:
            assert dest_key in call_args["payload"]
            assert call_args["payload"][dest_key] == serialized_resources[0][src_key]


def test_update_payload_content_file(mocker):
    """Should update payload for content files"""
    content_file = ContentFileFactory.create(content="Test content")
    serialized_files = list(serialize_bulk_content_files([content_file.id]))
    mock_qdrant = mocker.MagicMock()
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)

    # Mock retrieve_points_matching_params to return points
    mock_point = mocker.MagicMock()
    mock_point.id = "test-point-id"
    mocker.patch(
        "vector_search.utils.retrieve_points_matching_params", return_value=[mock_point]
    )
    update_content_file_payload(serialized_files[0])
    mock_qdrant.set_payload.assert_called_once()
    call_args = mock_qdrant.set_payload.call_args[1]
    assert call_args["collection_name"] == CONTENT_FILES_COLLECTION_NAME
    assert call_args["points"] == ["test-point-id"]
    # Verify payload contains the mapped values
    for src_key, dest_key in QDRANT_CONTENT_FILE_PARAM_MAP.items():
        if src_key in serialized_files[0]:
            assert dest_key in call_args["payload"]
            assert call_args["payload"][dest_key] == serialized_files[0][src_key]


def test_update_payload_no_points(mocker):
    """Should not update payload when no points are found"""

    content_file = ContentFileFactory.create(content="Test content")
    serialized_files = list(serialize_bulk_content_files([content_file.id]))
    mock_qdrant = mocker.MagicMock()
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    mocker.patch("vector_search.utils.retrieve_points_matching_params", return_value=[])
    update_content_file_payload(serialized_files[0])
    # Verify set_payload not called
    mock_qdrant.set_payload.assert_not_called()


@pytest.mark.django_db
def test_embed_learning_resources_summarizes_only_contentfiles_with_summary(mocker):
    """
    Test that summarize_content_files_by_ids is only called with contentfiles that have an existing summary
    """
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    mocker.patch("vector_search.utils.create_qdrant_collections")
    mocker.patch("vector_search.utils._process_content_embeddings", return_value=None)
    mocker.patch(
        "vector_search.utils.filter_existing_qdrant_points_by_ids", return_value=[]
    )
    mocker.patch("vector_search.utils.remove_qdrant_records")

    # Create ContentFiles, some with summary, some without
    contentfiles_with_summary = ContentFileFactory.create_batch(
        2, content="abc", summary="summary text"
    )
    contentfiles_without_summary = ContentFileFactory.create_batch(
        3, content="def", summary=""
    )
    all_contentfiles = contentfiles_with_summary + contentfiles_without_summary

    # Patch serialize_bulk_content_files to return dicts with/without summary
    serialized = []
    for cf in all_contentfiles:
        d = {
            "id": cf.id,
            "resource_readable_id": getattr(cf, "resource_readable_id", "resid"),
            "run_readable_id": getattr(cf, "run_readable_id", "runid"),
            "key": getattr(cf, "key", "key"),
            "summary": cf.summary,
            "content": cf.content,
            "checksum": "checksum",
        }
        serialized.append(d)
    mocker.patch(
        "vector_search.utils.serialize_bulk_content_files", return_value=serialized
    )

    summarize_mock = mocker.patch(
        "vector_search.utils.ContentSummarizer.summarize_content_files_by_ids"
    )
    embed_learning_resources(
        [cf.id for cf in all_contentfiles], "content_file", overwrite=True
    )

    # Only contentfiles with summary should be passed
    expected_ids = [cf.id for cf in contentfiles_with_summary]
    summarize_mock.assert_called_once_with(expected_ids, True)  # noqa: FBT003


def test_vector_search_group_by(mocker):
    """
    Test that vector_search with group_by parameter returns grouped results
    where chunks are merged on common fields
    """
    mock_qdrant = mocker.patch("vector_search.utils.qdrant_client")()
    mock_encoder = mocker.patch("vector_search.utils.dense_encoder")()
    mock_encoder.embed_query.return_value = [0.1, 0.2, 0.3]
    mock_encoder.model_short_name.return_value = "test-encoder"

    group_by_field = "resource_readable_id"
    resource_id_1 = "resource1"
    resource_id_2 = "resource2"

    mock_group1_hit1 = mocker.MagicMock()
    mock_group1_hit1.payload = {
        group_by_field: resource_id_1,
        "chunk_content": "First part.",
        "common_field": "value1",
    }
    mock_group1_hit2 = mocker.MagicMock()
    mock_group1_hit2.payload = {
        group_by_field: resource_id_1,
        "chunk_content": "Second part.",
        "common_field": "value1",
    }

    mock_group2_hit1 = mocker.MagicMock()
    mock_group2_hit1.payload = {
        group_by_field: resource_id_2,
        "chunk_content": "Only part.",
        "common_field": "value2",
    }

    mock_group1 = mocker.MagicMock()
    mock_group1.hits = [mock_group1_hit1, mock_group1_hit2]
    mock_group2 = mocker.MagicMock()
    mock_group2.hits = [mock_group2_hit1]

    mock_group_result = mocker.MagicMock()
    mock_group_result.groups = [mock_group1, mock_group2]
    mock_qdrant.query_points_groups.return_value = mock_group_result
    mock_qdrant.count.return_value = models.CountResult(count=2)

    mocker.patch(
        "vector_search.utils._content_file_vector_hits", side_effect=lambda x: x
    )

    params = {
        "group_by": group_by_field,
        "group_size": 2,
    }
    results = vector_search(
        "test query",
        params,
        search_collection=CONTENT_FILES_COLLECTION_NAME,
    )

    assert len(results["hits"]) == 2
    assert results["total"]["value"] == 2

    hit1 = next(
        h for h in results["hits"] if h.payload[group_by_field] == resource_id_1
    )
    hit2 = next(
        h for h in results["hits"] if h.payload[group_by_field] == resource_id_2
    )

    assert hit1.payload["chunk_content"] == "First part. Second part."
    assert hit1.payload["common_field"] == "value1"
    assert hit1.payload["chunks"] == ["First part.", "Second part."]

    assert hit2.payload["chunk_content"] == "Only part."
    assert hit2.payload["common_field"] == "value2"
    assert hit2.payload["chunks"] == ["Only part."]

    mock_qdrant.query_points_groups.assert_called_once()
    call_args = mock_qdrant.query_points_groups.call_args.kwargs
    assert call_args["group_by"] == group_by_field
    assert call_args["group_size"] == 2
