import pytest
from django.conf import settings
from qdrant_client import models
from qdrant_client.models import PointStruct

from learning_resources.factories import ContentFileFactory, LearningResourceFactory
from learning_resources.models import LearningResource
from learning_resources_search.serializers import serialize_bulk_content_files
from vector_search.constants import (
    CONTENT_FILES_COLLECTION_NAME,
    RESOURCES_COLLECTION_NAME,
)
from vector_search.encoders.utils import dense_encoder
from vector_search.utils import (
    _chunk_documents,
    create_qdrand_collections,
    embed_learning_resources,
    filter_existing_qdrant_points,
    qdrant_query_conditions,
    vector_point_id,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("content_type", ["learning_resource", "content_file"])
def test_vector_point_id_used_for_embed(mocker, content_type):
    # test the vector ids we generate for embedding resources and files
    if content_type == "learning_resource":
        resources = LearningResourceFactory.create_batch(5)
    else:
        resources = ContentFileFactory.create_batch(5, content="test content")
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )

    embed_learning_resources([resource.id for resource in resources], content_type)

    if content_type == "learning_resource":
        point_ids = [vector_point_id(resource.readable_id) for resource in resources]
    else:
        point_ids = [
            vector_point_id(
                f"{resource['resource_readable_id']}.{resource['run_readable_id']}.{resource['key']}.0"
            )
            for resource in serialize_bulk_content_files([r.id for r in resources])
        ]

    assert sorted(
        [p.id for p in mock_qdrant.upload_points.mock_calls[0].kwargs["points"]]
    ) == sorted(point_ids)


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


def test_force_create_qdrand_collections(mocker):
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
    create_qdrand_collections(force_recreate=True)
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


def test_auto_create_qdrand_collections(mocker):
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
    create_qdrand_collections(force_recreate=False)
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
    create_qdrand_collections(force_recreate=False)
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
