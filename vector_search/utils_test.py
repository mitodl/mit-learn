import asyncio
import random
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from django.conf import settings
from django.contrib.auth.models import Group
from django.urls import reverse
from qdrant_client import models
from qdrant_client.models import PointStruct

from learning_resources.constants import GROUP_CONTENT_FILE_CONTENT_VIEWERS
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
from vector_search.encoders.utils import dense_encoder, sparse_encoder
from vector_search.utils import (
    _chunk_documents,
    _chunk_markdown_documents,
    _embed_course_metadata_as_contentfile,
    _generate_content_file_points,
    _get_text_splitter,
    _is_markdown_content,
    _resource_vector_hits,
    async_qdrant_aggregations,
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
)
from vector_search.utils import qdrant_client as vector_qdrant_client

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
    filter_obj = qdrant_query_conditions(params)

    assert isinstance(filter_obj, models.Filter)
    assert (
        models.FieldCondition(
            key="offered_by.code", match=models.MatchAny(any=["ocw", "edx"])
        )
        in filter_obj.must
    )
    assert (
        models.FieldCondition(key="platform.code", match=models.MatchAny(any=["edx"]))
        in filter_obj.must
    )
    assert (
        models.FieldCondition(
            key="resource_type", match=models.MatchAny(any=["course", "podcast"])
        )
        in filter_obj.must
    )
    assert (
        models.FieldCondition(
            key="topics[].name",
            match=models.MatchAny(any=["test topic 1", "test topic 2"]),
        )
        in filter_obj.must
    )
    # test that items not in the filter map are ignored
    assert not any(
        isinstance(c, models.FieldCondition) and c.key == "q" for c in filter_obj.must
    )


def test_complex_qdrant_query_conditions():
    """Test that __isnull and __isempty lookups are correctly translated"""
    params = {
        "url__isnull": True,
        "title__isnull": False,
        "readable_id": "test-id",
    }

    filter_obj = qdrant_query_conditions(
        params, collection_name=RESOURCES_COLLECTION_NAME
    )

    assert isinstance(filter_obj, models.Filter)
    # url__isnull=True -> IsNullCondition in must
    assert any(
        isinstance(c, models.IsNullCondition) and c.is_null.key == "url"
        for c in filter_obj.must
    )

    # title__isnull=False -> IsNullCondition in must_not
    assert any(
        isinstance(c, models.IsNullCondition) and c.is_null.key == "title"
        for c in filter_obj.must_not
    )

    # readable_id="test-id" -> FieldCondition with match=MatchValue("test-id") in must
    assert any(
        isinstance(c, models.FieldCondition)
        and c.key == "readable_id"
        and isinstance(c.match, models.MatchValue)
        and c.match.value == "test-id"
        for c in filter_obj.must
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


@pytest.mark.parametrize(
    ("doc", "expected"),
    [
        ({"file_type": "marketing_page"}, True),
        ({"file_extension": ".md"}, True),
        ({"file_type": "marketing_page", "file_extension": ".md"}, True),
        ({"file_type": "page", "file_extension": ".html"}, False),
        ({}, False),
    ],
)
def test_is_markdown_content(doc, expected):
    assert _is_markdown_content(doc) == expected


def test_chunk_markdown_documents_preserves_headers(mocker):
    """Headers are preserved in subchunks after markdown-aware splitting"""
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 100
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 10
    settings.LITELLM_TOKEN_ENCODING_NAME = None

    # Clear the cached text splitter so settings take effect
    _get_text_splitter.cache_clear()

    text = "## Section A\n\nContent under A\n\n## Section B\n\nContent under B"
    metadata = {"key": "test_key", "resource_readable_id": "r1"}

    docs = _chunk_markdown_documents(text, metadata)

    assert len(docs) >= 2
    # Each chunk should carry the original metadata
    for doc in docs:
        assert doc.metadata["key"] == "test_key"
        assert doc.metadata["resource_readable_id"] == "r1"
    # Header metadata from MarkdownHeaderTextSplitter is preserved
    contents = [d.page_content for d in docs]
    assert any("Section A" in c for c in contents)
    assert any("Section B" in c for c in contents)


def test_chunk_markdown_documents_long_section_preserves_header(mocker):
    """When a section is split into multiple chunks, header text is prepended"""
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 50
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 5
    settings.LITELLM_TOKEN_ENCODING_NAME = None
    _get_text_splitter.cache_clear()

    long_content = " ".join(["word"] * 100)
    text = f"## My Section\n\n{long_content}"
    metadata = {"key": "k1"}

    docs = _chunk_markdown_documents(text, metadata)

    # Should produce multiple chunks
    assert len(docs) > 1
    # Every chunk should have "My Section" in its page_content,
    # either from the original heading or prepended from metadata
    for doc in docs:
        assert "My Section" in doc.page_content


def test_chunk_markdown_documents_header_text_in_body(mocker):
    """Header is prepended even when its text appears as a substring in the body."""
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 50
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 5
    settings.LITELLM_TOKEN_ENCODING_NAME = None
    _get_text_splitter.cache_clear()

    # The body naturally contains the heading text "Required Courses"
    long_body = " ".join(["There are 6 Required Courses for this program."] * 20)
    text = f"## Required Courses\n\n{long_body}"
    metadata = {"key": "k1"}

    docs = _chunk_markdown_documents(text, metadata)

    assert len(docs) > 1
    # Every chunk should have "Required Courses" prepended or as the heading,
    # even though the same text appears in the body content
    for doc in docs:
        assert "Required Courses" in doc.page_content


def test_chunk_markdown_documents_no_redundant_header(mocker):
    """First chunk with intact markdown header should not get a duplicate prepended."""
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 50
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 5
    settings.LITELLM_TOKEN_ENCODING_NAME = None
    _get_text_splitter.cache_clear()

    long_content = " ".join(["word"] * 100)
    text = f"## My Section\n\n{long_content}"
    metadata = {"key": "k1"}

    docs = _chunk_markdown_documents(text, metadata)

    assert len(docs) > 1
    # The first chunk already starts with the markdown header,
    # so "My Section" should NOT be redundantly prepended as plain text
    first = docs[0].page_content
    assert first.startswith("## My Section")
    assert not first.startswith("My Section\n\n## My Section")


def test_chunk_markdown_documents_without_headers(mocker):
    """Markdown content without headers still yields non-empty chunks."""
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 80
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 10
    settings.LITELLM_TOKEN_ENCODING_NAME = None
    _get_text_splitter.cache_clear()

    text = "This is markdown text without any ATX headings. " * 10
    metadata = {"key": "no_header_doc", "resource_readable_id": "r-no-header"}

    docs = _chunk_markdown_documents(text, metadata)

    assert len(docs) >= 1
    assert any(doc.page_content.strip() for doc in docs)
    for doc in docs:
        assert doc.metadata["key"] == "no_header_doc"
        assert doc.metadata["resource_readable_id"] == "r-no-header"


def test_generate_content_points_uses_markdown_chunking_for_marketing_pages(mocker):
    """marketing_page files use _chunk_markdown_documents instead of _chunk_documents"""
    from langchain.schema import Document

    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 500
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 50

    mock_md_chunk = mocker.patch(
        "vector_search.utils._chunk_markdown_documents",
        return_value=[Document(page_content="chunk1", metadata={"key": "k1"})],
    )
    mock_chunk = mocker.patch("vector_search.utils._chunk_documents")
    mocker.patch(
        "vector_search.utils.should_generate_content_embeddings", return_value=True
    )
    mocker.patch("vector_search.utils.remove_points_matching_params")

    mock_dense = mocker.MagicMock()
    mock_dense.embed_documents.side_effect = lambda texts: [[0.1] for _ in texts]
    mock_dense.model_short_name.return_value = "dense"
    mock_sparse = mocker.MagicMock()
    mock_sparse.embed_documents.side_effect = lambda texts: [[0.2] for _ in texts]
    mock_sparse.model_short_name.return_value = "sparse"
    mocker.patch("vector_search.utils.dense_encoder", return_value=mock_dense)
    mocker.patch("vector_search.utils.sparse_encoder", return_value=mock_sparse)

    doc = {
        "content": "## Heading\n\nSome content",
        "file_type": "marketing_page",
        "file_extension": ".md",
        "platform": {"code": "x"},
        "resource_readable_id": "r1",
        "run_readable_id": "run1",
        "key": "k1",
    }

    list(_generate_content_file_points([doc]))
    mock_md_chunk.assert_called_once()
    mock_chunk.assert_not_called()


def test_generate_content_points_uses_standard_chunking_for_non_markdown(mocker):
    """Non-markdown files use _chunk_documents"""
    from langchain.schema import Document

    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 500
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 50

    mock_md_chunk = mocker.patch("vector_search.utils._chunk_markdown_documents")
    mock_chunk = mocker.patch(
        "vector_search.utils._chunk_documents",
        return_value=[Document(page_content="chunk1", metadata={"key": "k1"})],
    )
    mocker.patch(
        "vector_search.utils.should_generate_content_embeddings", return_value=True
    )
    mocker.patch("vector_search.utils.remove_points_matching_params")

    mock_dense = mocker.MagicMock()
    mock_dense.embed_documents.side_effect = lambda texts: [[0.1] for _ in texts]
    mock_dense.model_short_name.return_value = "dense"
    mock_sparse = mocker.MagicMock()
    mock_sparse.embed_documents.side_effect = lambda texts: [[0.2] for _ in texts]
    mock_sparse.model_short_name.return_value = "sparse"
    mocker.patch("vector_search.utils.dense_encoder", return_value=mock_dense)
    mocker.patch("vector_search.utils.sparse_encoder", return_value=mock_sparse)

    doc = {
        "content": "Some plain text content",
        "file_type": "page",
        "file_extension": ".html",
        "platform": {"code": "x"},
        "resource_readable_id": "r1",
        "run_readable_id": "run1",
        "key": "k1",
    }

    list(_generate_content_file_points([doc]))
    mock_chunk.assert_called_once()
    mock_md_chunk.assert_not_called()


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
    resource = LearningResourceFactory.create(resource_type="course")

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


def test_vector_search_group_by(mocker, client, django_user_model):
    """
    Test that async_vector_search with group_by parameter returns grouped results
    where chunks are merged on common fields
    """
    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )
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

    # Content files endpoint requires authentication
    user = django_user_model.objects.create()
    group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
    group.user_set.add(user)
    client.force_login(user)

    params = {
        "q": "test query",
        "group_by": group_by_field,
        "group_size": 2,
        "offset": 0,
    }

    response = client.get(
        reverse("vector_search:v0:vector_content_files_search"), data=params
    )

    assert response.status_code == 200
    response_json = response.json()
    assert response_json["count"] == 2
    assert len(response_json["results"]) == 2
    grouped_results = {
        result[group_by_field]: result for result in response_json["results"]
    }
    assert grouped_results[resource_id_1] == {
        group_by_field: resource_id_1,
        "common_field": "value1",
        "chunks": ["First part.", "Second part."],
        "chunk_content": None,
    }
    assert grouped_results[resource_id_2] == {
        group_by_field: resource_id_2,
        "common_field": "value2",
        "chunks": ["Only part."],
        "chunk_content": None,
    }
    hit1 = next(
        h for h in response_json["results"] if h[group_by_field] == resource_id_1
    )
    hit2 = next(
        h for h in response_json["results"] if h[group_by_field] == resource_id_2
    )

    assert hit1["chunk_content"] is None
    assert hit1["common_field"] == "value1"
    assert hit1["chunks"] == ["First part.", "Second part."]

    assert hit2["chunk_content"] is None
    assert hit2["common_field"] == "value2"
    assert hit2["chunks"] == ["Only part."]

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


def _mock_topic_points(mocker, topic_names):
    """Create mock Qdrant points with topic name payloads."""
    points = []
    for name in topic_names:
        point = mocker.MagicMock()
        point.payload = {"name": name}
        points.append(point)
    return points


def test_embed_topics_no_new_topics(mocker):
    """
    Test embed_topics when there are no new topics to embed
    """
    mock_client = MagicMock()
    mock_qdrant_client = mocker.patch("vector_search.utils.qdrant_client")
    mock_qdrant_client.return_value = mock_client
    mock_client.count.return_value.count = 1
    mock_client.scroll.return_value = (
        _mock_topic_points(mocker, ["topic1"]),
        None,
    )
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
    mock_client.scroll.return_value = (
        _mock_topic_points(mocker, ["topic1"]),
        None,
    )
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
    mock_client.scroll.return_value = (
        _mock_topic_points(mocker, ["remove-topic"]),
        None,
    )

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


def test_qdrant_cloud_inference_client(mocker, settings):
    """
    Test that cloud inferencing is enabled in the qdrant client
    if one of the encoders requires it
    """
    # Patch the QdrantClient symbol used inside vector_search.utils
    mock_qdrant_client_cls = mocker.patch("vector_search.utils.QdrantClient")
    settings.QDRANT_SPARSE_ENCODER = (
        "vector_search.encoders.qdrant_cloud.QdrantCloudEncoder"
    )
    sparse_encoder.cache_clear()
    dense_encoder.cache_clear()
    vector_qdrant_client.cache_clear()
    vector_qdrant_client()
    # Verify that cloud inference is enabled when using the cloud encoder
    first_call_kwargs = mock_qdrant_client_cls.call_args.kwargs
    assert first_call_kwargs.get("cloud_inference") is True

    # Switch to a non-cloud encoder and verify cloud inference is disabled
    settings.QDRANT_SPARSE_ENCODER = (
        "vector_search.encoders.sparse_hash.SparseHashEncoder"
    )
    mock_qdrant_client_cls.reset_mock()
    vector_qdrant_client.cache_clear()
    sparse_encoder.cache_clear()
    dense_encoder.cache_clear()
    vector_qdrant_client()
    second_call_kwargs = mock_qdrant_client_cls.call_args.kwargs
    assert second_call_kwargs.get("cloud_inference", False) is False


def test_vector_search_hybrid(mocker, client):
    """
    Test that async_vector_search with hybrid_search=True searches using
    sparse and dense vectors
    """
    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    mock_search_result = mocker.MagicMock()
    mock_search_result.points = []
    mock_qdrant.query_points.return_value = mock_search_result
    mock_qdrant.count.return_value = models.CountResult(count=1)
    mock_dense_encoder = mocker.patch("vector_search.views.dense_encoder")()
    mock_dense_encoder.clear_cache()

    mock_sparse_encoder = mocker.patch("vector_search.views.sparse_encoder")()
    mock_sparse_encoder.clear_cache()

    mock_dense_encoder.embed_query.return_value = [0.1, 0.2, 0.3]
    mock_dense_encoder.model_short_name.return_value = "dense-test-encoder"

    # Sparse encoder expects dict like {"indices": [...], "values": [...]} for SparseVector kwargs
    mock_sparse_encoder.embed.return_value = {"indices": [1, 2], "values": [0.5, 0.6]}
    mock_sparse_encoder.model_short_name.return_value = "sparse-test-encoder"

    from django.urls import reverse

    params = {
        "q": "test hybrid query",
        "hybrid_search": True,
    }

    client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    mock_qdrant.query_points.assert_called_once()
    call_args = mock_qdrant.query_points.call_args.kwargs

    assert isinstance(call_args["query"], models.FusionQuery)
    assert call_args["query"].fusion == models.Fusion.RRF

    prefetches = call_args["prefetch"]
    assert len(prefetches) == 2

    sparse_prefetch = prefetches[0]
    dense_prefetch = prefetches[1]

    assert sparse_prefetch.using == "sparse-test-encoder"
    assert isinstance(sparse_prefetch.query, models.SparseVector)
    assert sparse_prefetch.query.indices == [1, 2]
    assert sparse_prefetch.query.values == [0.5, 0.6]

    assert dense_prefetch.using == "dense-test-encoder"
    assert dense_prefetch.query == [0.1, 0.2, 0.3]


@pytest.mark.parametrize("use_group_by", [True, False])
def test_vector_search_group_by_offset_behavior(
    mocker, client, django_user_model, use_group_by
):
    """
    Test that async_vector_search passes 'offset' to query_points when no
    group_by is provided, and drops 'offset' and calls query_points_groups
    when group_by is provided.
    """
    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    mock_group_result = mocker.MagicMock()
    mock_group_result.groups = []
    mock_qdrant.query_points_groups.return_value = mock_group_result

    mock_search_result = mocker.MagicMock()
    mock_search_result.points = []
    mock_qdrant.query_points.return_value = mock_search_result

    mock_qdrant.count.return_value = models.CountResult(count=0)

    mocker.patch("vector_search.views._content_file_vector_hits", return_value=[])

    # Content files endpoint requires authentication
    from django.contrib.auth.models import Group

    from learning_resources.constants import GROUP_CONTENT_FILE_CONTENT_VIEWERS

    user = django_user_model.objects.create()
    group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
    group.user_set.add(user)
    client.force_login(user)

    from django.urls import reverse

    params = {"q": "test query", "offset": 15}
    if use_group_by:
        params["group_by"] = "resource_readable_id"

    client.get(reverse("vector_search:v0:vector_content_files_search"), data=params)

    if use_group_by:
        mock_qdrant.query_points_groups.assert_called_once()
        mock_qdrant.query_points.assert_not_called()
        call_args = mock_qdrant.query_points_groups.call_args.kwargs
        assert "offset" not in call_args
        assert call_args.get("group_by") == "resource_readable_id"
    else:
        mock_qdrant.query_points.assert_called_once()
        mock_qdrant.query_points_groups.assert_not_called()
        call_args = mock_qdrant.query_points.call_args.kwargs
        assert call_args.get("offset") == 15
        assert "group_by" not in call_args


def test_resource_vector_hits_preserves_qdrant_score_order():
    """Results should be returned in the same order as the search_result (qdrant score order)."""
    resources = LearningResourceFactory.create_batch(5)
    # Shuffle to create a non-alphabetical, non-pk order (simulating qdrant ranking)
    shuffled = random.sample(resources, len(resources))

    # Build mock ScoredPoints with readable_ids in the shuffled order
    search_result = [
        MagicMock(payload={"readable_id": r.readable_id}) for r in shuffled
    ]

    result = _resource_vector_hits(search_result)

    expected_readable_ids = [r.readable_id for r in shuffled]
    actual_readable_ids = [r["readable_id"] for r in result]
    assert actual_readable_ids == expected_readable_ids


def _make_facet_hit(count=0, value="test"):
    """Build a minimal mock that looks like a Qdrant FacetHit."""
    hit = MagicMock()
    hit.value = value
    hit.count = count
    return hit


def _make_facet_response(hits):
    """Build a minimal mock that looks like a Qdrant FacetResponse."""
    resp = MagicMock()
    resp.hits = hits
    return resp


def test_async_qdrant_aggregations_empty_keys(mocker):
    """Should return {} immediately without calling Qdrant when aggregation_keys is empty."""
    mock_client = mocker.AsyncMock()
    mocker.patch(
        "vector_search.utils.async_qdrant_client",
        return_value=mock_client,
    )
    result = asyncio.run(async_qdrant_aggregations([], {}))
    assert result == {}
    mock_client.facet.assert_not_called()


def test_async_qdrant_aggregations_unknown_key(mocker):
    """An aggregation key not present in the param map should return an empty list."""
    mock_client = mocker.AsyncMock()
    mocker.patch(
        "vector_search.utils.async_qdrant_client",
        return_value=mock_client,
    )
    result = asyncio.run(
        async_qdrant_aggregations(
            ["nonexistent_field"],
            {},
            collection_name=RESOURCES_COLLECTION_NAME,
        )
    )
    assert result == {"nonexistent_field": []}
    mock_client.facet.assert_not_called()


def test_async_qdrant_aggregations_single_key(mocker):
    """A valid single aggregation key should query Qdrant and return correctly shaped data."""
    mock_client = mocker.AsyncMock()
    mocker.patch(
        "vector_search.utils.async_qdrant_client",
        return_value=mock_client,
    )

    mock_client.facet.return_value = _make_facet_response(
        [
            _make_facet_hit(42, value="course"),
            _make_facet_hit(7, value="podcast"),
        ]
    )

    result = asyncio.run(
        async_qdrant_aggregations(
            ["resource_type"],
            {},
            collection_name=RESOURCES_COLLECTION_NAME,
        )
    )

    assert "resource_type" in result
    hits = result["resource_type"]
    # Should be sorted descending by doc_count
    assert hits[0] == {"key": "course", "doc_count": 42}
    assert hits[1] == {"key": "podcast", "doc_count": 7}

    mock_client.facet.assert_awaited_once()
    call_kwargs = mock_client.facet.call_args.kwargs
    assert call_kwargs["collection_name"] == RESOURCES_COLLECTION_NAME
    assert call_kwargs["key"] == QDRANT_RESOURCE_PARAM_MAP["resource_type"]
    assert call_kwargs["limit"] == 100


def test_async_qdrant_aggregations_multiple_keys(mocker):
    """Multiple valid keys should each issue a concurrent Qdrant facet call."""
    mock_client = mocker.AsyncMock()
    mocker.patch(
        "vector_search.utils.async_qdrant_client",
        return_value=mock_client,
    )

    # Return different data depending on the 'key' kwarg
    def _facet_side_effect(**kwargs):
        if kwargs["key"] == QDRANT_RESOURCE_PARAM_MAP["resource_type"]:
            return _make_facet_response([_make_facet_hit(10, value="course")])
        if kwargs["key"] == QDRANT_RESOURCE_PARAM_MAP["platform"]:
            return _make_facet_response(
                [_make_facet_hit(30, value="ocw"), _make_facet_hit(20, value="edx")]
            )
        return _make_facet_response([])

    mock_client.facet.side_effect = _facet_side_effect

    result = asyncio.run(
        async_qdrant_aggregations(
            ["resource_type", "platform"],
            {},
            collection_name=RESOURCES_COLLECTION_NAME,
        )
    )

    assert set(result.keys()) == {"resource_type", "platform"}
    assert result["resource_type"] == [{"key": "course", "doc_count": 10}]
    # Descending sort
    assert result["platform"][0] == {"key": "ocw", "doc_count": 30}
    assert result["platform"][1] == {"key": "edx", "doc_count": 20}
    assert mock_client.facet.await_count == 2


def test_async_qdrant_aggregations_excludes_own_param_from_filter(mocker):
    """
    When building the per-facet filter, the aggregation key's own param
    must be excluded so that all values for that facet are counted.
    """
    mock_client = mocker.AsyncMock()
    mocker.patch(
        "vector_search.utils.async_qdrant_client",
        return_value=mock_client,
    )
    mock_client.facet.return_value = _make_facet_response([])

    params = {
        "resource_type": ["course"],
        "platform": ["ocw"],
    }

    asyncio.run(
        async_qdrant_aggregations(
            ["resource_type"],
            params,
            collection_name=RESOURCES_COLLECTION_NAME,
        )
    )

    mock_client.facet.assert_awaited_once()
    call_kwargs = mock_client.facet.call_args.kwargs

    # The facet_filter should NOT contain a condition for resource_type
    # (it was stripped out so we get all resource_type facet values),
    # but it SHOULD still filter by platform.
    facet_filter = call_kwargs.get("facet_filter")
    # facet_filter is a qdrant models.Filter with must conditions
    assert facet_filter is not None
    condition_keys = [c.key for c in facet_filter.must if hasattr(c, "key")]
    assert QDRANT_RESOURCE_PARAM_MAP["platform"] in condition_keys
    assert QDRANT_RESOURCE_PARAM_MAP["resource_type"] not in condition_keys


def test_async_qdrant_aggregations_bool_values_lowercased(mocker):
    """Boolean hit values must be returned as lowercase strings ('true'/'false')."""
    mock_client = mocker.AsyncMock()
    mocker.patch(
        "vector_search.utils.async_qdrant_client",
        return_value=mock_client,
    )

    mock_client.facet.return_value = _make_facet_response(
        [
            _make_facet_hit(5, value=True),
            _make_facet_hit(3, value=False),
        ]
    )

    result = asyncio.run(
        async_qdrant_aggregations(
            ["free"],
            {},
            collection_name=RESOURCES_COLLECTION_NAME,
        )
    )

    keys = {hit["key"] for hit in result["free"]}
    assert "true" in keys
    assert "false" in keys
    # Verify no raw booleans slipped through
    assert True not in keys
    assert False not in keys


def test_async_qdrant_aggregations_sorted_by_doc_count_desc(mocker):
    """Results must be sorted by doc_count in descending order."""
    mock_client = mocker.AsyncMock()
    mocker.patch(
        "vector_search.utils.async_qdrant_client",
        return_value=mock_client,
    )

    mock_client.facet.return_value = _make_facet_response(
        [
            _make_facet_hit(5, value="edx"),
            _make_facet_hit(100, value="ocw"),
            _make_facet_hit(20, value="xpro"),
        ]
    )

    result = asyncio.run(
        async_qdrant_aggregations(
            ["platform"],
            {},
            collection_name=RESOURCES_COLLECTION_NAME,
        )
    )

    counts = [hit["doc_count"] for hit in result["platform"]]
    assert counts == sorted(counts, reverse=True)


def test_async_qdrant_aggregations_uses_content_file_param_map(mocker):
    """
    When collection_name is CONTENT_FILES_COLLECTION_NAME the function must
    use QDRANT_CONTENT_FILE_PARAM_MAP to resolve the Qdrant field name.
    """
    mock_client = mocker.AsyncMock()
    mocker.patch(
        "vector_search.utils.async_qdrant_client",
        return_value=mock_client,
    )
    mock_client.facet.return_value = _make_facet_response(
        [_make_facet_hit(8, value=".pdf")]
    )

    result = asyncio.run(
        async_qdrant_aggregations(
            ["file_extension"],
            {},
            collection_name=CONTENT_FILES_COLLECTION_NAME,
        )
    )

    assert "file_extension" in result
    call_kwargs = mock_client.facet.call_args.kwargs
    assert call_kwargs["collection_name"] == CONTENT_FILES_COLLECTION_NAME
    # The Qdrant field for 'file_extension' should come from the content-file map
    assert call_kwargs["key"] == QDRANT_CONTENT_FILE_PARAM_MAP["file_extension"]
