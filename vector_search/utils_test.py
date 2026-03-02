import random
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from django.conf import settings
from qdrant_client import models
from qdrant_client.models import PointStruct

from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourcePriceFactory,
    LearningResourceRunFactory,
    LearningResourceTopicFactory,
)
from learning_resources.models import LearningResource
from learning_resources.serializers import LearningResourceMetadataDisplaySerializer
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
)
from learning_resources_search.serializers import (
    serialize_bulk_content_files,
    serialize_bulk_learning_resources,
)
from main.utils import checksum_for_content
from vector_search.constants import (
    CONTENT_FILES_COLLECTION_NAME,
    QDRANT_CONTENT_FILE_INDEXES,
    QDRANT_CONTENT_FILE_PARAM_MAP,
    QDRANT_LEARNING_RESOURCE_INDEXES,
    QDRANT_RESOURCE_PARAM_MAP,
    RESOURCES_COLLECTION_NAME,
)
from vector_search.encoders.utils import dense_encoder
from vector_search.utils import (
    _chunk_documents,
    _embed_course_metadata_as_contentfile,
    _get_text_splitter,
    create_qdrant_collections,
    embed_learning_resources,
    embed_topics,
    filter_existing_qdrant_points,
    qdrant_query_conditions,
    should_generate_content_embeddings,
    should_generate_resource_embeddings,
    update_content_file_payload,
    update_learning_resource_payload,
    update_qdrant_indexes,
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

    mocker.patch(
        "learning_resources.content_summarizer.ContentSummarizer.summarize_content_files_by_ids"
    )

    embed_learning_resources(
        [resource.id for resource in resources], content_type, overwrite=True
    )

    if content_type == "course":
        point_ids = [
            vector_point_id(f"{resource.platform.code}.{resource.readable_id}")
            for resource in resources
        ]
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
                f"{resource['platform']['code']}.{resource['resource_readable_id']}.{resource['run_readable_id']}.{resource['key']}.0"
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
            return_value=[
                vector_point_id(f"{r.platform.code}.{r.readable_id}")
                for r in resources[0:2]
            ],
        )
    else:
        # all contentfiles exist in qdrant
        mocker.patch(
            "vector_search.utils.filter_existing_qdrant_points_by_ids",
            return_value=[
                vector_point_id(
                    f"{doc['platform']['code']}.{doc['resource_readable_id']}.{doc['run_readable_id']}.{doc['key']}.0"
                )
                for doc in serialize_bulk_content_files([r.id for r in resources[0:3]])
            ],
        )
    mocker.patch(
        "learning_resources.content_summarizer.ContentSummarizer.summarize_content_files_by_ids"
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
    _get_text_splitter.cache_clear()
    mocked_splitter = mocker.patch("vector_search.utils.RecursiveCharacterTextSplitter")
    mocked_chunker = mocker.patch("vector_search.utils.SemanticChunker")

    _chunk_documents(encoder, ["this is a test document"], [{}])
    mocked_chunker.assert_not_called()
    mocked_splitter.assert_called()


def test_expected_document_chunks(mocker):
    """
    Test that the expected number of chunks are uploaded
    """

    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = random.randrange(10, 120)  # noqa: S311
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = random.randrange(  # noqa: S311
        1, settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE
    )
    settings.CONTENT_FILE_EMBEDDING_SEMANTIC_CHUNKING_ENABLED = False

    encoder = dense_encoder()
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )

    encoder.token_encoding_name = None

    content_file = ContentFileFactory.create(
        content="this is a.  test: document. " * 1000
    )
    chunked = _chunk_documents(
        encoder,
        [content_file.content],
        list(serialize_bulk_content_files([content_file.id])),
    )

    embed_learning_resources([content_file.id], "content_file", overwrite=True)

    num_points_uploaded = sum(
        [
            len(mock_call.kwargs["update_operations"][0].upsert.points)
            for mock_call in mock_qdrant.batch_update_points.mock_calls
        ]
    )

    assert len(chunked) == num_points_uploaded


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

    # work around cache for testing
    _get_text_splitter.cache_clear()
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
        vector_point_id(
            f"{serialized_resources[0]['platform']['code']}.{serialized_resources[0]['readable_id']}"
        )
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
        "learning_resources.content_summarizer.ContentSummarizer.summarize_content_files_by_ids"
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

    assert hit1.payload["chunk_content"] is None
    assert hit1.payload["common_field"] == "value1"
    assert hit1.payload["chunks"] == ["First part.", "Second part."]

    assert hit2.payload["chunk_content"] is None
    assert hit2.payload["common_field"] == "value2"
    assert hit2.payload["chunks"] == ["Only part."]

    mock_qdrant.query_points_groups.assert_called_once()
    call_args = mock_qdrant.query_points_groups.call_args.kwargs
    assert call_args["group_by"] == group_by_field
    assert call_args["group_size"] == 2


@pytest.mark.django_db
def test_embed_course_metadata_as_contentfile_uploads_points_on_change(mocker):
    """
    Test that _embed_course_metadata_as_contentfile uploads points to Qdrant
    if any property of a serialized_resource has changed
    """

    mock_client = mocker.patch("vector_search.utils.qdrant_client").return_value
    mock_encoder = mocker.patch("vector_search.utils.dense_encoder").return_value
    mock_encoder.model_short_name.return_value = "test-model"
    mock_encoder.embed_documents.return_value = [[0.1, 0.2, 0.3]]
    resource = LearningResourceFactory.create()
    serialized_resource = next(serialize_bulk_learning_resources([resource.id]))
    serializer = LearningResourceMetadataDisplaySerializer(serialized_resource)
    rendered_document = serializer.render_document()
    resource_checksum = checksum_for_content(str(rendered_document))

    """
    Simulate qdrant returning a checksum for existing
    record that matches the checksum of metadata doc
    """
    mock_point = mocker.Mock()
    mock_point.payload = {"checksum": "checksum2"}
    mock_client.retrieve.return_value = [mock_point]

    _embed_course_metadata_as_contentfile([serialized_resource])

    # Assert upload_points was called
    assert mock_client.upload_points.called
    args, kwargs = mock_client.upload_points.call_args
    assert args[0] == CONTENT_FILES_COLLECTION_NAME
    points = list(kwargs["points"])
    assert len(points) == 1
    assert points[0].payload["resource_readable_id"] == resource.readable_id
    assert points[0].payload["checksum"] == resource_checksum
    assert points[0].payload["url"] == resource.url

    # simulate qdrant returning the same checksum for the metadata doc
    mock_point.payload = {"checksum": resource_checksum}
    mock_client.upload_points.reset_mock()
    _embed_course_metadata_as_contentfile([serialized_resource])

    # nothing has changed - no updates to make
    assert not mock_client.upload_points.called


@pytest.mark.parametrize(
    ("serialized_document", "expected_params"),
    [
        (
            {"resource_readable_id": "r1", "key": "k1", "run_readable_id": "run1"},
            {"resource_readable_id": "r1", "key": "k1", "run_readable_id": "run1"},
        ),
        (
            {"resource_readable_id": "r2", "key": "k2"},
            {"resource_readable_id": "r2", "key": "k2"},
        ),
        (
            {"run_readable_id": "run3"},
            {"run_readable_id": "run3"},
        ),
        ({"test": "run3"}, None),
    ],
)
def test_update_content_file_payload_only_includes_existing_keys(
    mocker, serialized_document, expected_params
):
    """
    Test that params only includes keys
    that are defined in the input document
    """
    mock_retrieve = mocker.patch(
        "vector_search.utils.retrieve_points_matching_params", return_value=[]
    )
    mocker.patch("vector_search.utils._set_payload")

    update_content_file_payload(serialized_document)
    if expected_params:
        # Check that retrieve_points_matching_params was called with only the expected keys
        mock_retrieve.assert_called_once_with(
            expected_params,
            collection_name=CONTENT_FILES_COLLECTION_NAME,
        )
    else:
        mock_retrieve.assert_not_called()


@pytest.mark.django_db
def test_embed_learning_resources_contentfile_summarization_filter(mocker):
    """
    Test that the summarizer runs for a content file if another content file
    in the parent learning run also has a summary.
    """
    settings.OPENAI_API_KEY = "test"
    settings.QDRANT_ENABLE_INDEXING_PLUGIN_HOOKS = True
    mock_content_summarizer = mocker.patch(
        "learning_resources.content_summarizer.ContentSummarizer.summarize_content_files_by_ids"
    )
    mock_chat_llm = mocker.patch(
        "learning_resources.content_summarizer.ChatLiteLLM", autospec=True
    )
    mock_instance = mock_chat_llm.return_value
    mock_summary_response = mocker.MagicMock()
    mock_summary_response.content = "mocked summary"
    mock_instance.invoke.return_value = mock_summary_response
    mock_instance.with_structured_output.return_value.invoke.return_value = {
        "flashcards": [
            {
                "question": "Generated Question",
                "answer": "Generated Answer",
            }
        ]
    }

    run = LearningResourceRunFactory.create(published=True)
    ContentFileFactory.create_batch(
        2, content="test content", summary="summary text", run=run
    )
    new_content_files = ContentFileFactory.create_batch(
        2, content="new content", summary="", run=run
    )
    cf_ids = [cf.id for cf in new_content_files]
    embed_learning_resources(cf_ids, resource_type=CONTENT_FILE_TYPE, overwrite=False)

    # Assert that the summarizer was called with the correct content file IDs
    assert sorted(mock_content_summarizer.mock_calls[0].args[0]) == sorted(cf_ids)


@pytest.mark.django_db
def test_update_qdrant_indexes_adds_missing_index(mocker):
    """
    Test that update_qdrant_indexes adds an index if it doesn't already exist
    """
    mock_client = mocker.patch("vector_search.utils.qdrant_client").return_value
    mock_client.get_collection.return_value.payload_schema = {}

    update_qdrant_indexes()

    # Ensure create_payload_index is called for missing indexes
    expected_calls = [
        mocker.call(
            collection_name=RESOURCES_COLLECTION_NAME,
            field_name=index_field,
            field_schema=QDRANT_LEARNING_RESOURCE_INDEXES[index_field],
        )
        for index_field in QDRANT_LEARNING_RESOURCE_INDEXES
    ] + [
        mocker.call(
            collection_name=CONTENT_FILES_COLLECTION_NAME,
            field_name=index_field,
            field_schema=QDRANT_CONTENT_FILE_INDEXES[index_field],
        )
        for index_field in QDRANT_CONTENT_FILE_INDEXES
    ]
    mock_client.create_payload_index.assert_has_calls(expected_calls, any_order=True)


@pytest.mark.django_db
def test_update_qdrant_indexes_updates_mismatched_field_type(mocker):
    """
    Test that update_qdrant_indexes updates the index if the field types mismatch
    """
    mock_client = mocker.patch("vector_search.utils.qdrant_client").return_value
    mock_client.get_collection.return_value.payload_schema = {
        index_field: mocker.MagicMock(data_type="wrong_type")
        for index_field in QDRANT_LEARNING_RESOURCE_INDEXES
    }

    update_qdrant_indexes()

    # Ensure create_payload_index is called for mismatched field types
    expected_calls = [
        mocker.call(
            collection_name=RESOURCES_COLLECTION_NAME,
            field_name=index_field,
            field_schema=QDRANT_LEARNING_RESOURCE_INDEXES[index_field],
        )
        for index_field in QDRANT_LEARNING_RESOURCE_INDEXES
    ] + [
        mocker.call(
            collection_name=CONTENT_FILES_COLLECTION_NAME,
            field_name=index_field,
            field_schema=QDRANT_CONTENT_FILE_INDEXES[index_field],
        )
        for index_field in QDRANT_CONTENT_FILE_INDEXES
    ]
    mock_client.create_payload_index.assert_has_calls(expected_calls, any_order=True)


def test_embed_topics_no_new_topics(mocker):
    """
    Test embed_topics when there are no new topics to embed
    """
    mock_client = MagicMock()
    mock_qdrant_client = mocker.patch("vector_search.utils.qdrant_client")
    mock_qdrant_client.return_value = mock_client
    mock_client.count.return_value.count = 1
    mock_vector_search = mocker.patch("vector_search.utils.vector_search")
    mock_vector_search.return_value = {"hits": [{"name": "topic1"}]}
    LearningResourceTopicFactory.create(name="topic1", parent=None)
    mock_remove_points_matching_params = mocker.patch(
        "vector_search.utils.remove_points_matching_params"
    )
    embed_topics()
    mock_remove_points_matching_params.assert_not_called()
    mock_client.upload_points.assert_not_called()


def test_embed_topics_new_topics(mocker):
    """
    Test embed_topics when there are new topics
    """
    mock_client = MagicMock()
    mock_qdrant_client = mocker.patch("vector_search.utils.qdrant_client")
    mock_qdrant_client.return_value = mock_client
    mock_client.count.return_value.count = 1
    mock_vector_search = mocker.patch("vector_search.utils.vector_search")
    mock_vector_search.return_value = {"hits": [{"name": "topic1"}]}
    LearningResourceTopicFactory.create(name="topic1", parent=None)
    LearningResourceTopicFactory.create(name="topic2", parent=None)
    LearningResourceTopicFactory.create(name="topic3", parent=None)
    mocker.patch("vector_search.utils.remove_points_matching_params")
    embed_topics()
    mock_client.upload_points.assert_called_once()
    assert len(list(mock_client.upload_points.mock_calls[0][2]["points"])) == 2


def test_embed_topics_remove_topics(mocker):
    """
    Test embed_topics when there are topics to remove
    """
    mock_client = MagicMock()
    mock_qdrant_client = mocker.patch("vector_search.utils.qdrant_client")
    mock_qdrant_client.return_value = mock_client
    mock_client.count.return_value.count = 1
    mock_vector_search = mocker.patch("vector_search.utils.vector_search")
    mock_vector_search.return_value = {"hits": [{"name": "remove-topic"}]}

    LearningResourceTopicFactory.create(name="topic2", parent=None)
    LearningResourceTopicFactory.create(name="topic3", parent=None)
    mock_remove_points_matching_params = mocker.patch(
        "vector_search.utils.remove_points_matching_params"
    )
    embed_topics()
    mock_remove_points_matching_params.assert_called_once()
    assert (
        mock_remove_points_matching_params.mock_calls[0][1][0]["name"] == "remove-topic"
    )


def test_set_payload_batched(mocker):
    """
    Test that _set_payload processes points in batches
    """
    batch_size = 2
    settings.QDRANT_POINT_UPLOAD_BATCH_SIZE = batch_size
    mock_client = mocker.patch("vector_search.utils.qdrant_client").return_value

    points = [f"point_{i}" for i in range(5)]
    document = {"key1": "val1", "key2": "val2", "ignored": "val3"}
    param_map = {"key1": "payload_key1", "key2": "payload_key2"}
    collection_name = "test_collection"

    from vector_search.utils import _set_payload

    _set_payload(points, document, param_map, collection_name)

    assert mock_client.set_payload.call_count == 3

    # Check first batch
    call1_kwargs = mock_client.set_payload.mock_calls[0].kwargs
    assert call1_kwargs["collection_name"] == collection_name
    assert call1_kwargs["payload"] == {"payload_key1": "val1", "payload_key2": "val2"}
    assert call1_kwargs["points"] == ["point_0", "point_1"]

    # Check second batch
    call2_kwargs = mock_client.set_payload.mock_calls[1].kwargs
    assert call2_kwargs["points"] == ["point_2", "point_3"]

    # Check third batch
    call3_kwargs = mock_client.set_payload.mock_calls[2].kwargs
    assert call3_kwargs["points"] == ["point_4"]
