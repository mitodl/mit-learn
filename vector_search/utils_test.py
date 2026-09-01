import asyncio
import json
import random
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from asgiref.sync import async_to_sync
from django.conf import settings
from django.contrib.auth.models import Group
from django.urls import reverse
from freezegun import freeze_time
from langchain_core.documents import Document
from qdrant_client import models
from qdrant_client.http.models.models import CountResult
from qdrant_client.models import PointStruct

import vector_search.utils as vs_utils
from learning_resources.constants import (
    CONTENT_FILE_LARGE_FIELDS,
    GROUP_CONTENT_FILE_CONTENT_VIEWERS,
    LearningResourceType,
)
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourcePlatformFactory,
    LearningResourcePriceFactory,
    LearningResourceRunFactory,
    LearningResourceTopicFactory,
)
from learning_resources.models import ContentFile, LearningResource
from learning_resources.serializers import LearningResourceMetadataDisplaySerializer
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
    COURSE_TYPE,
)
from learning_resources_search.serializers import (
    serialize_bulk_content_files,
    serialize_bulk_learning_resources,
)
from main.utils import checksum_for_content
from vector_search.constants import (
    COMPLETENESS_PAYLOAD_KEY,
    CONTENT_FILES_COLLECTION_NAME,
    QDRANT_CONTENT_FILE_INDEXES,
    QDRANT_CONTENT_FILE_PARAM_MAP,
    QDRANT_LEARNING_RESOURCE_INDEXES,
    QDRANT_OPTIMIZER_FLUSH_INTERVAL_LARGE,
    QDRANT_OPTIMIZER_FLUSH_INTERVAL_MEDIUM,
    QDRANT_OPTIMIZER_FLUSH_INTERVAL_SMALL,
    QDRANT_OPTIMIZER_FLUSH_INTERVAL_XLARGE,
    QDRANT_OPTIMIZER_INDEXING_THRESHOLD_RATIO,
    QDRANT_OPTIMIZER_SEGMENT_LARGE,
    QDRANT_OPTIMIZER_SEGMENT_MEDIUM,
    QDRANT_OPTIMIZER_SEGMENT_SMALL,
    QDRANT_OPTIMIZER_SEGMENT_XLARGE,
    QDRANT_OPTIMIZER_THRESHOLD_LARGE,
    QDRANT_OPTIMIZER_THRESHOLD_MEDIUM,
    QDRANT_OPTIMIZER_THRESHOLD_SMALL,
    QDRANT_RESOURCE_PARAM_MAP,
    RESOURCE_AGE_DATE_PAYLOAD_KEY,
    RESOURCE_EMBEDDING_CHECKSUM_FIELD,
    RESOURCES_COLLECTION_NAME,
    RESOURCES_PAYLOAD_EXCLUDE,
    RESOURCES_RETRIEVE_PAYLOAD,
    SECONDS_PER_YEAR,
)
from vector_search.encoders.utils import dense_encoder, sparse_encoder
from vector_search.utils import (
    _chunk_documents,
    _chunk_markdown_documents,
    _content_file_vector_hits,
    _embed_course_metadata_as_contentfile,
    _generate_content_file_points,
    _get_text_splitter,
    _is_markdown_content,
    _resource_payload_hits,
    _resource_vector_hits,
    _set_payload,
    async_qdrant_aggregations,
    check_missing_content_file_ids,
    completeness_penalty_expression,
    compute_optimizer_settings,
    create_qdrant_collections,
    custom_score_formula,
    embed_learning_resources,
    embed_topics,
    filter_existing_qdrant_points,
    qdrant_query_conditions,
    remove_qdrant_records,
    resource_embedding_checksum,
    resources_payload_selector,
    score_formula_query,
    should_generate_content_embeddings,
    should_generate_resource_embeddings,
    staleness_penalty_expression,
    update_content_file_payload,
    update_learning_resource_payload,
    update_qdrant_indexes,
    vector_point_id,
    vector_point_key,
)
from vector_search.utils import qdrant_client as vector_qdrant_client

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("point_count", "shard_number", "segment_size", "flush_interval"),
    [
        (
            0,
            10,
            QDRANT_OPTIMIZER_SEGMENT_SMALL,
            QDRANT_OPTIMIZER_FLUSH_INTERVAL_SMALL,
        ),
        (
            QDRANT_OPTIMIZER_THRESHOLD_SMALL - 1,
            1,
            QDRANT_OPTIMIZER_SEGMENT_SMALL,
            QDRANT_OPTIMIZER_FLUSH_INTERVAL_SMALL,
        ),
        (
            QDRANT_OPTIMIZER_THRESHOLD_SMALL,
            1,
            QDRANT_OPTIMIZER_SEGMENT_MEDIUM,
            QDRANT_OPTIMIZER_FLUSH_INTERVAL_MEDIUM,
        ),
        (
            QDRANT_OPTIMIZER_THRESHOLD_MEDIUM,
            2,
            QDRANT_OPTIMIZER_SEGMENT_MEDIUM,
            QDRANT_OPTIMIZER_FLUSH_INTERVAL_MEDIUM,
        ),
        (
            QDRANT_OPTIMIZER_THRESHOLD_MEDIUM,
            1,
            QDRANT_OPTIMIZER_SEGMENT_LARGE,
            QDRANT_OPTIMIZER_FLUSH_INTERVAL_LARGE,
        ),
        (
            QDRANT_OPTIMIZER_THRESHOLD_LARGE,
            4,
            QDRANT_OPTIMIZER_SEGMENT_LARGE,
            QDRANT_OPTIMIZER_FLUSH_INTERVAL_LARGE,
        ),
        (
            QDRANT_OPTIMIZER_THRESHOLD_LARGE,
            1,
            QDRANT_OPTIMIZER_SEGMENT_XLARGE,
            QDRANT_OPTIMIZER_FLUSH_INTERVAL_XLARGE,
        ),
    ],
)
def test_compute_optimizer_settings(
    point_count, shard_number, segment_size, flush_interval
):
    """Optimizer settings are determined by point count per shard."""
    assert compute_optimizer_settings(point_count, shard_number) == {
        "indexing_threshold": int(
            segment_size * QDRANT_OPTIMIZER_INDEXING_THRESHOLD_RATIO
        ),
        "flush_interval_sec": flush_interval,
    }


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
        # the last 2 contentfiles already have points in qdrant; the first 3 don't
        mock_qdrant.retrieve.return_value = [
            mocker.MagicMock(
                id=vector_point_id(
                    vector_point_key(doc, chunk_number=0, document_type="content_file")
                ),
                payload={"checksum": doc["checksum"]},
            )
            for doc in serialize_bulk_content_files([r.id for r in resources[3:5]])
        ]
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


@pytest.mark.parametrize(
    ("platform_value", "expected_params"),
    [
        ({"code": "ocw"}, {"readable_id": "shared-readable-id", "platform": "ocw"}),
        (None, {"readable_id": "shared-readable-id"}),
    ],
)
def test_remove_qdrant_records_filters_learning_resources_by_platform(
    mocker, platform_value, expected_params
):
    """Learning resource deletes should not cross platform boundaries."""
    mocker.patch(
        "vector_search.utils.serialize_bulk_learning_resources",
        return_value=[
            {"readable_id": "shared-readable-id", "platform": platform_value}
        ],
    )
    mock_remove_points_matching_params = mocker.patch(
        "vector_search.utils.remove_points_matching_params"
    )

    remove_qdrant_records([1], COURSE_TYPE)

    mock_remove_points_matching_params.assert_called_once_with(
        expected_params,
        collection_name=RESOURCES_COLLECTION_NAME,
    )


def test_remove_qdrant_records_filters_content_files_by_platform(mocker):
    """Content file deletes should include the platform in their identity filter."""
    mocker.patch(
        "vector_search.utils.serialize_bulk_content_files",
        return_value=[
            {
                "platform": {"code": "mitxonline"},
                "run_readable_id": "shared-run-id",
                "resource_readable_id": "shared-readable-id",
                "key": "documents/syllabus.pdf",
            }
        ],
    )
    mock_remove_points_matching_params = mocker.patch(
        "vector_search.utils.remove_points_matching_params"
    )

    remove_qdrant_records([1], CONTENT_FILE_TYPE)

    mock_remove_points_matching_params.assert_called_once_with(
        {
            "platform": "mitxonline",
            "run_readable_id": "shared-run-id",
            "resource_readable_id": "shared-readable-id",
            "key": "documents/syllabus.pdf",
        },
        collection_name=CONTENT_FILES_COLLECTION_NAME,
    )


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


def test_expected_document_chunks(mocker):
    """
    Test that the expected number of chunks are uploaded
    """

    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = random.randrange(10, 120)  # noqa: S311
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = random.randrange(  # noqa: S311
        1, settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE
    )

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


def test_embed_learning_resources_chunks_content_file_serialization(mocker, settings):
    """
    QDRANT_CONTENT_FILE_SERIALIZATION_CHUNK_SIZE controls how many content files are serialized at once for embedding.
    """

    settings.QDRANT_CONTENT_FILE_SERIALIZATION_CHUNK_SIZE = 2
    mocker.patch("vector_search.utils.qdrant_client", return_value=MagicMock())
    mocker.patch("vector_search.utils.ensure_qdrant_collections")
    serialize_mock = mocker.patch(
        "vector_search.utils.serialize_bulk_content_files", return_value=[]
    )

    embed_learning_resources([1, 2, 3, 4, 5], CONTENT_FILE_TYPE, overwrite=True)

    assert [mock_call.args[0] for mock_call in serialize_mock.mock_calls] == [
        [1, 2],
        [3, 4],
        [5],
    ]


def test_document_chunker_tiktoken(mocker):
    """
    Test that we use tiktoken if a token encoding is specified
    """

    settings.LITELLM_TOKEN_ENCODING_NAME = None
    encoder = dense_encoder()
    encoder.token_encoding_name = None
    mocked_splitter = mocker.patch(
        "langchain_text_splitters.RecursiveCharacterTextSplitter.from_tiktoken_encoder"
    )

    _chunk_documents(["this is a test document"], [{}])
    mocked_splitter.assert_not_called()

    # work around cache for testing
    _get_text_splitter.cache_clear()
    settings.LITELLM_TOKEN_ENCODING_NAME = "test"  # noqa: S105
    _chunk_documents(["this is a test document"], [{}])
    mocked_splitter.assert_called()


def test_text_splitter_chunk_size_override(mocker):
    """
    Test that we always use the recursive splitter if chunk size is overriden
    """
    chunk_size = 100
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = chunk_size
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = chunk_size / 10
    encoder = dense_encoder()
    mocked_splitter = mocker.patch(
        "langchain_text_splitters.RecursiveCharacterTextSplitter"
    )
    encoder.token_encoding_name = "cl100k_base"  # noqa: S105
    _chunk_documents(["this is a test document"], [{}])
    assert mocked_splitter.mock_calls[0].kwargs["chunk_size"] == 100
    mocked_splitter = mocker.patch(
        "langchain_text_splitters.RecursiveCharacterTextSplitter"
    )
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = None
    _chunk_documents(["this is a test document"], [{}])
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

    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 500
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 50

    mock_md_chunk = mocker.patch(
        "vector_search.utils._chunk_markdown_documents",
        return_value=[Document(page_content="chunk1", metadata={"key": "k1"})],
    )
    mock_chunk = mocker.patch("vector_search.utils._chunk_documents")
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

    list(_generate_content_file_points([doc], {}))
    mock_md_chunk.assert_called_once()
    mock_chunk.assert_not_called()


def test_generate_content_points_uses_standard_chunking_for_non_markdown(mocker):
    """Non-markdown files use _chunk_documents"""

    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 500
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 50

    mock_md_chunk = mocker.patch("vector_search.utils._chunk_markdown_documents")
    mock_chunk = mocker.patch(
        "vector_search.utils._chunk_documents",
        return_value=[Document(page_content="chunk1", metadata={"key": "k1"})],
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

    list(_generate_content_file_points([doc], {}))
    mock_chunk.assert_called_once()
    mock_md_chunk.assert_not_called()


def test_generate_content_points_leaves_headroom_under_token_limit(mocker):
    """
    Embedding request batches must leave headroom under OpenAI's 300k
    tokens-per-request limit, since markdown header prefixes are prepended
    after the chunk-size split and inflate chunks past the nominal size
    """
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 500
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 50

    # 600 chunks * 500 tokens == exactly 300k if packed with no headroom
    num_chunks = 600
    mocker.patch(
        "vector_search.utils._chunk_documents",
        return_value=[
            Document(page_content=f"chunk{i}", metadata={"key": "k1"})
            for i in range(num_chunks)
        ],
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

    points = list(_generate_content_file_points([doc], {}))

    batch_sizes = [
        len(call.args[0]) for call in mock_dense.embed_documents.call_args_list
    ]
    assert sum(batch_sizes) == num_chunks
    assert len(points) == num_chunks
    # nominal tokens per request must stay at least ~5% under the 300k limit
    assert max(batch_sizes) * 500 <= 285000


def test_generate_content_points_request_chunk_size_never_zero(mocker):
    """
    A misconfigured (huge) chunk-size override must not make request_chunk_size 0,
    which would raise ValueError in the range() batching loop
    """
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 500000
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 50

    mocker.patch(
        "vector_search.utils._chunk_documents",
        return_value=[
            Document(page_content=f"chunk{i}", metadata={"key": "k1"}) for i in range(3)
        ],
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

    points = list(_generate_content_file_points([doc], {}))
    assert len(points) == 3


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


def _mock_resource_point(mocker, payload):
    """Point the resources collection retrieve at a single stored payload."""
    mock_qdrant = mocker.MagicMock()
    mock_point = mocker.MagicMock()
    mock_point.payload = payload
    mock_qdrant.retrieve.return_value = [] if payload is None else [mock_point]
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    return mock_qdrant


def test_should_generate_for_changed_resource(mocker):
    """Should generate embeddings when the embedding context has changed"""
    resource = LearningResourceFactory.create()
    doc = next(iter(serialize_bulk_learning_resources([resource.id])))
    _mock_resource_point(
        mocker,
        {
            RESOURCE_EMBEDDING_CHECKSUM_FIELD: resource_embedding_checksum(
                "the context that was actually embedded"
            )
        },
    )

    assert should_generate_resource_embeddings(doc, "a different context") is True


def test_should_not_generate_for_matching_checksum(mocker):
    """A point whose stored checksum matches what we would embed is left alone"""
    resource = LearningResourceFactory.create()
    doc = next(iter(serialize_bulk_learning_resources([resource.id])))
    context = vs_utils._learning_resource_embedding_context(doc)  # noqa: SLF001
    _mock_resource_point(
        mocker,
        {RESOURCE_EMBEDDING_CHECKSUM_FIELD: resource_embedding_checksum(context)},
    )

    assert should_generate_resource_embeddings(doc, context) is False


def test_should_generate_for_resource_without_stored_checksum(mocker):
    """
    Points embedded before the checksum existed have no stored value, so they
    are re-embedded once. This is what pulls the existing catalog onto the
    metadata-document context instead of leaving it on its old vectors.
    """
    resource = LearningResourceFactory.create()
    doc = next(iter(serialize_bulk_learning_resources([resource.id])))
    context = vs_utils._learning_resource_embedding_context(doc)  # noqa: SLF001
    _mock_resource_point(mocker, {"title": doc["title"]})

    assert should_generate_resource_embeddings(doc, context) is True


def test_should_generate_for_missing_resource_point(mocker):
    """A resource with no point at all is always embedded"""
    resource = LearningResourceFactory.create()
    doc = next(iter(serialize_bulk_learning_resources([resource.id])))
    _mock_resource_point(mocker, None)

    assert should_generate_resource_embeddings(doc, "any context") is True


def test_resource_embedding_checksum_tracks_the_version(mocker):
    """
    Bumping RESOURCE_EMBEDDING_VERSION changes the checksum of unchanged text,
    so a format change that renders the same data differently still invalidates
    every stored point.
    """
    before = resource_embedding_checksum("unchanged context")
    mocker.patch("vector_search.utils.RESOURCE_EMBEDDING_VERSION", 2)

    assert resource_embedding_checksum("unchanged context") != before


@pytest.fixture
def serialized_course():
    """Serialize a course the way the embedding pipeline sees it."""
    resource = LearningResourceFactory.create(resource_type=COURSE_TYPE, published=True)
    LearningResourceRunFactory.create(learning_resource=resource, published=True)
    return next(iter(serialize_bulk_learning_resources([resource.id])))


def test_embedding_context_is_the_course_metadata_document(serialized_course):
    """
    The course metadata document -- the markdown rendering of the resource
    drawer -- is the embedding context, so instructors, prices and dates are
    all searchable.
    """
    context = vs_utils._learning_resource_embedding_context(serialized_course)  # noqa: SLF001

    assert context.startswith("# Information about this course:")
    assert serialized_course["title"] in context
    assert serialized_course["description"] in context
    assert serialized_course["full_description"] in context
    assert "**Instructors**" in context
    for run in serialized_course["runs"]:
        for instructor in run["instructors"]:
            assert instructor["full_name"] in context
    for topic in serialized_course["topics"]:
        assert topic["name"] in context


def test_embedding_context_matches_rendered_metadata_document(serialized_course):
    """
    The context leads with the same document that gets embedded into the
    content file collection.
    """
    metadata_document = LearningResourceMetadataDisplaySerializer(
        serialized_course,
        context=vs_utils._metadata_serializer_context(),  # noqa: SLF001
    ).render_markdown()

    context = vs_utils._learning_resource_embedding_context(serialized_course)  # noqa: SLF001

    assert context.startswith(metadata_document)


def test_embedding_context_is_none_when_the_document_cannot_render(
    mocker, serialized_course
):
    """
    A document the display serializer chokes on yields no context at all,
    rather than a degraded one.
    """
    mocker.patch.object(
        LearningResourceMetadataDisplaySerializer,
        "render_markdown",
        side_effect=KeyError("delivery"),
    )

    assert vs_utils._learning_resource_embedding_context(serialized_course) is None  # noqa: SLF001


def test_unrenderable_resource_is_skipped_not_embedded(mocker, serialized_course):
    """
    A render failure leaves the existing point completely alone -- no embedding
    from a degraded context, and no payload refresh either, since that would
    overwrite the checksum of the vector the point still holds. The next run
    retries and repairs it.
    """
    mocker.patch.object(
        LearningResourceMetadataDisplaySerializer,
        "render_markdown",
        side_effect=KeyError("delivery"),
    )
    mock_qdrant = _mock_resource_point(mocker, None)

    assert vs_utils._process_resource_embeddings([serialized_course]) is None  # noqa: SLF001
    mock_qdrant.overwrite_payload.assert_not_called()


def test_unchanged_resource_is_not_re_embedded_on_the_next_run(mocker):
    """
    The checksum the first run stores comes back through Qdrant as JSON -- the
    serialized doc carries real datetimes and Decimals, the stored payload
    carries strings -- and still matches, so the second run refreshes the
    payload instead of re-embedding. Comparing rendered documents instead would
    re-embed the whole catalog every run.
    """
    resource = LearningResourceFactory.create(resource_type=COURSE_TYPE, published=True)
    LearningResourceRunFactory.create(learning_resource=resource, published=True)
    mock_qdrant = _mock_resource_point(mocker, None)

    points = list(
        vs_utils._process_resource_embeddings(  # noqa: SLF001
            serialize_bulk_learning_resources([resource.id])
        )
    )
    assert len(points) == 1
    stored_payload = json.loads(json.dumps(points[0].payload, default=str))
    assert stored_payload[RESOURCE_EMBEDDING_CHECKSUM_FIELD]

    stored_point = mocker.MagicMock()
    stored_point.payload = stored_payload
    mock_qdrant.retrieve.return_value = [stored_point]

    assert (
        vs_utils._process_resource_embeddings(  # noqa: SLF001
            serialize_bulk_learning_resources([resource.id])
        )
        is None
    )
    # ...and the refresh writes the checksum back, rather than blanking the key
    # and re-embedding on every subsequent run.
    refreshed = mock_qdrant.overwrite_payload.call_args.kwargs["payload"]
    assert (
        refreshed[RESOURCE_EMBEDDING_CHECKSUM_FIELD]
        == stored_payload[RESOURCE_EMBEDDING_CHECKSUM_FIELD]
    )


def test_embedding_context_includes_content_files(serialized_course):
    """
    Content file text should be folded into the embedding context for any
    resource type, mirroring the OpenSearch query.
    """
    serialized_course["content_files"] = [
        {"content": "The first content file text"},
        {"content": None},
        {"content": "The second content file text"},
    ]

    context = vs_utils._learning_resource_embedding_context(serialized_course)  # noqa: SLF001

    assert context.endswith(
        "\n\n## Content\nThe first content file text\n\nThe second content file text"
    )


def test_embedding_context_includes_serialized_content_files():
    """Content from a real serialized document resource ends up in the context"""
    resource = LearningResourceFactory.create(resource_type="document", published=True)
    ContentFileFactory.create(
        direct_learning_resource=resource, content="sentinel text", published=True
    )
    serialized = next(iter(serialize_bulk_learning_resources([resource.id])))
    assert "sentinel text" in vs_utils._learning_resource_embedding_context(serialized)  # noqa: SLF001


def test_embedding_context_without_content_files(serialized_course):
    """Resources without content files should just use the metadata document."""
    serialized_course["content_files"] = []

    context = vs_utils._learning_resource_embedding_context(serialized_course)  # noqa: SLF001

    assert "## Content" not in context


def test_embedding_context_truncates_content(mocker, serialized_course):
    """The combined context should be truncated to the embedding model's limit."""
    encoder = mocker.MagicMock(
        model_name="test-model",
        token_encoding_name="test-encoding",  # noqa: S106
    )
    mocker.patch("vector_search.utils.dense_encoder", return_value=encoder)
    truncate_mock = mocker.patch(
        "vector_search.utils.truncate_to_model_limit",
        side_effect=lambda text, *_args, **_kwargs: text[:10],
    )
    serialized_course["content_files"] = [{"content": "0123456789ABCDEF"}]

    context = vs_utils._learning_resource_embedding_context(serialized_course)  # noqa: SLF001

    assert context == "# Informat"
    untruncated, model = truncate_mock.call_args.args
    assert untruncated.endswith("## Content\n0123456789ABCDEF")
    assert model == "test-model"
    assert truncate_mock.call_args.kwargs == {"token_encoding_name": "test-encoding"}


def test_embedding_context_includes_course_code(serialized_course):
    """A resource without course numbers falls back to its readable_id."""
    serialized_course["course_numbers"] = None
    serialized_course["course"] = None
    serialized_course["readable_id"] = "18.06"

    context = vs_utils._learning_resource_embedding_context(serialized_course)  # noqa: SLF001

    assert "**Course number:** 18.06" in context


@pytest.mark.parametrize(
    ("course_numbers", "expected"),
    [
        (
            [{"value": "18.06"}, {"value": "18.061"}],
            "**Course numbers:** 18.06, 18.061",
        ),
        (["18.06", "18.061"], "**Course numbers:** 18.06, 18.061"),
    ],
)
def test_embedding_context_includes_course_numbers(
    serialized_course, course_numbers, expected
):
    """The resource's course_numbers should be formatted as a comma-separated list."""
    serialized_course["course_numbers"] = course_numbers

    context = vs_utils._learning_resource_embedding_context(serialized_course)  # noqa: SLF001

    assert expected in context


@pytest.mark.parametrize(
    ("description", "full_description"),
    [
        ("A short description", "A full description"),
        (None, "A full description"),
        ("A short description", None),
        (None, None),
    ],
)
def test_embedding_context_omits_missing_descriptions(
    serialized_course, description, full_description
):
    """Missing description fields should be dropped rather than rendered as None."""
    serialized_course["description"] = description
    serialized_course["full_description"] = full_description

    context = vs_utils._learning_resource_embedding_context(serialized_course)  # noqa: SLF001

    for value in (description, full_description):
        if value:
            assert value in context
    assert "None" not in context


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


def test_stored_content_payloads_batches_and_maps(mocker, settings):
    """One retrieve per id-chunk; existing points map to their stored payload."""
    settings.QDRANT_POINT_UPLOAD_BATCH_SIZE = 2
    present = mocker.MagicMock(id="p1", payload={"checksum": "abc"})
    no_checksum = mocker.MagicMock(id="p2", payload={})
    mock_qdrant = mocker.MagicMock()
    # p3 does not exist in Qdrant
    mock_qdrant.retrieve.side_effect = [[present, no_checksum], []]
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)

    stored = vs_utils._stored_content_payloads(  # noqa: SLF001
        ["p1", "p2", "p3"], fields=("checksum", "title")
    )

    assert stored == {"p1": {"checksum": "abc"}, "p2": {}}
    assert mock_qdrant.retrieve.call_count == 2  # ceil(3 ids / batch size 2)
    for call in mock_qdrant.retrieve.call_args_list:
        assert call.kwargs["collection_name"] == CONTENT_FILES_COLLECTION_NAME
        assert call.kwargs["with_payload"] == ["checksum", "title"]


@pytest.mark.parametrize(
    ("stored_entry", "expect_regenerate"),
    [
        ("missing", True),  # no point in Qdrant (new file or failed prior embed)
        (None, True),  # point exists but has no stored checksum
        ("stale-checksum", True),  # stored checksum differs
        ("current-checksum", False),  # matches -> payload-only update
    ],
)  # stored_entry is the checksum in the stored payload dict
def test_generate_content_points_checksum_gate(mocker, stored_entry, expect_regenerate):
    """Docs are re-embedded unless their stored Qdrant checksum matches."""
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 500
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 50

    mocker.patch(
        "vector_search.utils._chunk_documents",
        return_value=[Document(page_content="chunk1", metadata={"key": "k1"})],
    )
    mocker.patch("vector_search.utils.remove_points_matching_params")
    update_payload_mock = mocker.patch(
        "vector_search.utils.update_content_file_payload"
    )
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
        "checksum": "current-checksum",
    }
    point_id = vector_point_id(
        vector_point_key(doc, chunk_number=0, document_type="content_file")
    )
    stored = {} if stored_entry == "missing" else {point_id: {"checksum": stored_entry}}

    points = list(_generate_content_file_points([doc], stored))

    if expect_regenerate:
        assert len(points) == 1
        update_payload_mock.assert_not_called()
    else:
        assert points == []
        update_payload_mock.assert_called_once_with(doc)


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
    """Should overwrite the point payload with the full serialized document"""
    resource = LearningResourceFactory.create()
    doc = next(iter(serialize_bulk_learning_resources([resource.id])))
    mock_qdrant = mocker.MagicMock()
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    update_learning_resource_payload(doc)
    mock_qdrant.overwrite_payload.assert_called_once()
    call_args = mock_qdrant.overwrite_payload.call_args[1]
    assert call_args["collection_name"] == RESOURCES_COLLECTION_NAME
    assert call_args["points"] == [vector_point_id(vector_point_key(doc))]
    # The whole serialized doc is written. Topics in particular must propagate;
    # the old param-map projection keyed on `topic` (not `topics`) silently
    # dropped them, hiding resources from topic filters (mitodl/hq#11786).
    assert call_args["payload"] == doc
    assert doc["topics"]
    assert call_args["payload"]["topics"] == doc["topics"]


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


def test_generate_content_points_runless_run_readable_id_fallback(mocker):
    """
    Run-less content files (e.g. scraped marketing pages) must get a
    run_readable_id payload equal to the resource readable_id: the content-file
    search API rewrites resource_readable_id filters into run_readable_id
    filters, so points without the field are unreachable. Files with a real
    run keep the run's id.
    """
    settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE = 500
    settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP = 50
    mocker.patch("vector_search.utils.remove_points_matching_params")
    mock_dense = mocker.MagicMock()
    mock_dense.embed_documents.side_effect = lambda texts: [[0.1] for _ in texts]
    mock_dense.model_short_name.return_value = "dense"
    mock_sparse = mocker.MagicMock()
    mock_sparse.embed_documents.side_effect = lambda texts: [[0.2] for _ in texts]
    mock_sparse.model_short_name.return_value = "sparse"
    mocker.patch("vector_search.utils.dense_encoder", return_value=mock_dense)
    mocker.patch("vector_search.utils.sparse_encoder", return_value=mock_sparse)

    runless_doc = {
        "content": "# Marketing page\n\nSome marketing content",
        "file_type": "marketing_page",
        "file_extension": ".md",
        "platform": {"code": "xpro"},
        "resource_readable_id": "program-v1:xPRO+Test",
        "key": "https://xpro.mit.edu/programs/program-v1:xPRO+Test/",
        "checksum": "abc",
    }
    run_doc = {
        "content": "Some plain text content",
        "file_type": "page",
        "file_extension": ".html",
        "platform": {"code": "x"},
        "resource_readable_id": "r1",
        "run_readable_id": "run1",
        "key": "k1",
        "checksum": "def",
    }

    points = list(_generate_content_file_points([runless_doc, run_doc], {}))

    runless_payloads = [
        point.payload for point in points if point.payload["key"] == runless_doc["key"]
    ]
    run_payloads = [point.payload for point in points if point.payload["key"] == "k1"]
    assert runless_payloads
    assert run_payloads
    assert all(
        payload["run_readable_id"] == "program-v1:xPRO+Test"
        for payload in runless_payloads
    )
    assert all(payload["run_readable_id"] == "run1" for payload in run_payloads)


def test_update_payload_content_file_runless_backfills_run_readable_id(mocker):
    """
    Payload refresh for a run-less content file writes the resource readable_id
    into run_readable_id (healing pre-fix points without re-embedding), while
    the point lookup keeps using the raw document so points stored without the
    field are still found.
    """
    resource = LearningResourceFactory.create(is_program=True)
    content_file = ContentFileFactory.create(
        learning_resource=resource, content="Test content"
    )
    serialized = next(iter(serialize_bulk_content_files([content_file.id])))
    assert "run_readable_id" not in serialized

    mock_qdrant = mocker.MagicMock()
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    mock_point = mocker.MagicMock()
    mock_point.id = "test-point-id"
    retrieve_mock = mocker.patch(
        "vector_search.utils.retrieve_points_matching_params", return_value=[mock_point]
    )

    update_content_file_payload(serialized)

    assert "run_readable_id" not in retrieve_mock.call_args[0][0]
    payload = mock_qdrant.set_payload.call_args[1]["payload"]
    assert payload["run_readable_id"] == resource.readable_id


def test_content_file_vector_hits_hydrates_runless_files():
    """
    Search hits for run-less content files (e.g. marketing pages) are hydrated
    with the serialized DB record, matched via the resource readable_id their
    payloads carry in run_readable_id.
    """
    resource = LearningResourceFactory.create(is_program=True)
    content_file = ContentFileFactory.create(
        learning_resource=resource,
        content="marketing content",
        file_type="marketing_page",
    )
    run_content_file = ContentFileFactory.create(content="run file content")
    hits = [
        PointStruct(
            id=1,
            payload={
                "run_readable_id": resource.readable_id,
                "key": content_file.key,
                "chunk_content": "marketing content",
            },
            vector=[],
        ),
        PointStruct(
            id=2,
            payload={
                "run_readable_id": run_content_file.run.run_id,
                "key": run_content_file.key,
                "chunk_content": "run file content",
            },
            vector=[],
        ),
    ]

    results = _content_file_vector_hits(hits)

    assert results[0]["id"] == content_file.id
    assert results[0]["resource_readable_id"] == resource.readable_id
    assert "content" not in results[0]
    assert results[1]["id"] == run_content_file.id


@pytest.mark.django_db
def test_embed_learning_resources_summarizes_only_contentfiles_with_summary(mocker):
    """
    Test that embedding overwrites don't overwrite existing summaries.
    """
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mock_qdrant.retrieve.return_value = []
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    mocker.patch("vector_search.utils.create_qdrant_collections")
    mocker.patch("vector_search.utils.remove_qdrant_records")

    learning_resource = LearningResourceFactory.create(
        resource_type="video", create_video=False, create_runs=False
    )
    # Create ContentFiles, some with summary, some without
    contentfiles_with_summary = ContentFileFactory.create_batch(
        2,
        content="abc",
        learning_resource=learning_resource,
        summary="summary text",
    )
    contentfiles_without_summary = ContentFileFactory.create_batch(
        3, content="def", learning_resource=learning_resource, summary=""
    )
    all_contentfiles = contentfiles_with_summary + contentfiles_without_summary

    # Patch serialize_bulk_content_files to return dicts with/without summary
    serialized = []
    for cf in all_contentfiles:
        d = {
            "id": cf.id,
            "resource_readable_id": getattr(cf, "resource_readable_id", "resid"),
            "run_id": cf.id,
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
    summarize_mock.assert_called_once_with(expected_ids, overwrite=False)


@pytest.mark.django_db
def test_embed_learning_resources_overwrites_summaries_for_changed_content(mocker):
    """Embedding overwrites regenerate summaries only when content changed."""
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    mocker.patch("vector_search.utils.create_qdrant_collections")
    mocker.patch("vector_search.utils.remove_qdrant_records")

    learning_resource = LearningResourceFactory.create(
        resource_type="video", create_video=False, create_runs=False
    )
    unchanged_content_file = ContentFileFactory.create(
        content="unchanged content",
        learning_resource=learning_resource,
        summary="summary text",
    )
    changed_content_file = ContentFileFactory.create(
        content="changed content",
        learning_resource=learning_resource,
        summary="old summary text",
    )
    all_contentfiles = [unchanged_content_file, changed_content_file]

    serialized = [
        {
            "id": cf.id,
            "resource_readable_id": "resid",
            "run_id": cf.id,
            "run_readable_id": "runid",
            "key": cf.key,
            "summary": cf.summary,
            "content": cf.content,
            "checksum": f"current-{cf.id}",
        }
        for cf in all_contentfiles
    ]

    mocker.patch(
        "vector_search.utils.serialize_bulk_content_files", return_value=serialized
    )
    # The unchanged file takes the payload-only path (covered by its own tests)
    mocker.patch("vector_search.utils.update_content_file_payload")
    # Stored Qdrant checksum matches for the unchanged file, differs for the changed
    mock_qdrant.retrieve.return_value = [
        mocker.MagicMock(
            id=vector_point_id(
                vector_point_key(doc, chunk_number=0, document_type="content_file")
            ),
            payload={
                "checksum": doc["checksum"]
                if doc["id"] == unchanged_content_file.id
                else "stale-checksum"
            },
        )
        for doc in serialized
    ]

    summarize_mock = mocker.patch(
        "learning_resources.content_summarizer.ContentSummarizer.summarize_content_files_by_ids"
    )

    def summarize_before_upsert(content_file_ids, *, overwrite):
        mock_qdrant.batch_update_points.assert_not_called()
        return [
            f"Summarization succeeded for CONTENT_FILE_ID: {content_file_id}"
            for content_file_id in content_file_ids
        ]

    summarize_mock.side_effect = summarize_before_upsert
    embed_learning_resources(
        [cf.id for cf in all_contentfiles], "content_file", overwrite=True
    )

    assert summarize_mock.mock_calls == [
        mocker.call([unchanged_content_file.id], overwrite=False),
        mocker.call([changed_content_file.id], overwrite=True),
    ]


@pytest.mark.django_db
def test_embed_learning_resources_keeps_old_checksum_when_summary_fails(mocker):
    """A failed changed-content summary should be retried on the next embedding run."""
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch("vector_search.utils.qdrant_client", return_value=mock_qdrant)
    mocker.patch("vector_search.utils.create_qdrant_collections")

    learning_resource = LearningResourceFactory.create(
        resource_type="video", create_video=False, create_runs=False
    )
    content_file = ContentFileFactory.create(
        content="changed content",
        learning_resource=learning_resource,
        summary="old summary text",
    )
    serialized = [
        {
            "id": content_file.id,
            "resource_readable_id": "resid",
            "run_id": content_file.id,
            "run_readable_id": "runid",
            "key": content_file.key,
            "summary": content_file.summary,
            "content": content_file.content,
            "checksum": "current-checksum",
        }
    ]
    mocker.patch(
        "vector_search.utils.serialize_bulk_content_files", return_value=serialized
    )
    # Stored Qdrant checksum differs, so the summary must be regenerated
    mock_qdrant.retrieve.return_value = [
        mocker.MagicMock(
            id=vector_point_id(
                vector_point_key(
                    serialized[0], chunk_number=0, document_type="content_file"
                )
            ),
            payload={"checksum": "previous-checksum"},
        )
    ]
    summarize_mock = mocker.patch(
        "learning_resources.content_summarizer.ContentSummarizer.summarize_content_files_by_ids",
        return_value=[
            f"Summary generation failed for CONTENT_FILE_ID: {content_file.id}"
        ],
    )

    embed_learning_resources([content_file.id], "content_file", overwrite=True)

    summarize_mock.assert_called_once_with([content_file.id], overwrite=True)
    mock_qdrant.batch_update_points.assert_not_called()


@pytest.mark.django_db(transaction=True)
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

    assert sparse_prefetch.prefetch[0].using == "sparse-test-encoder"
    assert isinstance(sparse_prefetch.prefetch[0].query, models.SparseVector)
    assert sparse_prefetch.prefetch[0].query.indices == [1, 2]
    assert sparse_prefetch.prefetch[0].query.values == [0.5, 0.6]
    assert dense_prefetch.prefetch[0].using == "dense-test-encoder"
    assert dense_prefetch.prefetch[0].query == [0.1, 0.2, 0.3]


@pytest.mark.parametrize("use_group_by", [True, False])
@pytest.mark.django_db(transaction=True)
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
    user = django_user_model.objects.create()
    group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
    group.user_set.add(user)
    client.force_login(user)

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
    resources = LearningResourceFactory.create_batch(4)
    resources.append(LearningResourceFactory.create(platform=None))
    # Shuffle to create a non-alphabetical, non-pk order (simulating qdrant ranking)
    shuffled = random.sample(resources, len(resources))

    # Build mock ScoredPoints with readable_ids in the shuffled order
    search_result = [
        MagicMock(
            payload={
                "readable_id": r.readable_id,
                "platform": {"code": r.platform.code} if r.platform else None,
            }
        )
        for r in shuffled
    ]

    result = _resource_vector_hits(search_result)

    expected_readable_ids = [r.readable_id for r in shuffled]
    actual_readable_ids = [r["readable_id"] for r in result]
    assert actual_readable_ids == expected_readable_ids


def test_resource_vector_hits_duplicate_readable_ids_different_platforms():
    """
    Ensure results with duplicate readable_ids but different platform codes
    get aligned or discarded appropriately.
    """
    platform_xpro = LearningResourcePlatformFactory.create(code="xpro")
    platform_ocw = LearningResourcePlatformFactory.create(code="ocw")

    # Create two resources with the SAME readable_id but DIFFERENT platforms
    r_xpro = LearningResourceFactory.create(
        readable_id="duplicate-id", platform=platform_xpro
    )
    r_ocw = LearningResourceFactory.create(
        readable_id="duplicate-id", platform=platform_ocw
    )

    # And a third resource that is completely separate
    r_other = LearningResourceFactory.create(
        readable_id="other-id", platform=platform_ocw
    )

    # Case 1: Search results return only the xpro platform for the duplicate id
    search_result_1 = [
        MagicMock(
            payload={
                "readable_id": "duplicate-id",
                "platform": {"code": "xpro"},
            }
        ),
        MagicMock(
            payload={
                "readable_id": "other-id",
                "platform": {"code": "ocw"},
            }
        ),
    ]

    result_1 = _resource_vector_hits(search_result_1)
    # It should match the xpro resource and the other resource, and discard the OCW resource with "duplicate-id"
    assert len(result_1) == 2
    assert result_1[0]["id"] == r_xpro.id
    assert result_1[0]["platform"]["code"] == "xpro"
    assert result_1[1]["id"] == r_other.id

    # Case 2: Search results return both platforms for the duplicate id
    search_result_2 = [
        MagicMock(
            payload={
                "readable_id": "duplicate-id",
                "platform": {"code": "ocw"},
            }
        ),
        MagicMock(
            payload={
                "readable_id": "duplicate-id",
                "platform": {"code": "xpro"},
            }
        ),
    ]

    result_2 = _resource_vector_hits(search_result_2)
    # It should match and return both in the correct ranking order
    assert len(result_2) == 2
    assert result_2[0]["id"] == r_ocw.id
    assert result_2[0]["platform"]["code"] == "ocw"
    assert r_xpro.id == result_2[1]["id"]
    assert result_2[1]["platform"]["code"] == "xpro"


def test_resources_payload_selector_excludes_indexing_fields(settings):
    """The selector should ask for the whole payload minus indexing-only keys"""
    settings.VECTOR_SEARCH_RESOURCES_FROM_PAYLOAD = True
    selector = resources_payload_selector()
    assert isinstance(selector, models.PayloadSelectorExclude)
    assert selector.exclude == RESOURCES_PAYLOAD_EXCLUDE


def test_resources_payload_selector_kill_switch(settings):
    """With payload hits disabled we only fetch the DB hydration lookup fields"""
    settings.VECTOR_SEARCH_RESOURCES_FROM_PAYLOAD = False
    assert resources_payload_selector() == RESOURCES_RETRIEVE_PAYLOAD


def test_resource_payload_hits_preserves_order_and_dedupes():
    """Hits come straight from the payloads, in Qdrant order, deduped by platform:id"""
    search_result = [
        MagicMock(
            payload={
                "readable_id": "course-2",
                "platform": {"code": "ocw"},
                "title": "Second",
            }
        ),
        MagicMock(
            payload={
                "readable_id": "course-1",
                "platform": {"code": "ocw"},
                "title": "First",
            }
        ),
        # same readable_id as the first hit, different platform: kept
        MagicMock(
            payload={
                "readable_id": "course-2",
                "platform": {"code": "xpro"},
                "title": "Second on xpro",
            }
        ),
        # exact duplicate of the first hit: dropped
        MagicMock(
            payload={
                "readable_id": "course-2",
                "platform": {"code": "ocw"},
                "title": "Second",
            }
        ),
        # unusable without a readable_id: dropped
        MagicMock(payload={"platform": {"code": "ocw"}, "title": "No readable id"}),
    ]

    hits = _resource_payload_hits(search_result)

    assert [(hit["readable_id"], hit["platform"]["code"]) for hit in hits] == [
        ("course-2", "ocw"),
        ("course-1", "ocw"),
        ("course-2", "xpro"),
    ]
    assert hits[0]["title"] == "Second"


def test_resource_payload_hits_handles_null_platform():
    """A resource indexed without a platform should still produce a hit"""
    hits = _resource_payload_hits(
        [MagicMock(payload={"readable_id": "course-1", "platform": None})]
    )
    assert [hit["readable_id"] for hit in hits] == ["course-1"]


def test_resource_payload_hits_trims_indexing_only_course_number_fields():
    """
    Qdrant payload selectors cannot descend into lists of objects, so the extra
    course number fields the indexing serializer adds are trimmed in Python.
    """
    payload = {
        "readable_id": "course-1",
        "platform": {"code": "ocw"},
        "course": {
            "course_numbers": [
                {
                    "value": "6.006",
                    "listing_type": "Primary",
                    "department": {"department_id": "6"},
                    "primary": True,
                    "sort_coursenum": "06.006",
                }
            ]
        },
    }

    hits = _resource_payload_hits([MagicMock(payload=payload)])

    assert hits[0]["course"]["course_numbers"] == [
        {
            "value": "6.006",
            "listing_type": "Primary",
            "department": {"department_id": "6"},
        }
    ]
    # the payload dict Qdrant handed us is not mutated
    assert "sort_coursenum" in payload["course"]["course_numbers"][0]


@pytest.mark.parametrize(
    "course",
    [None, {}, {"course_numbers": None}],
)
def test_resource_payload_hits_tolerates_missing_course_numbers(course):
    """Non-course resources pass through the course number trim untouched"""
    hits = _resource_payload_hits(
        [MagicMock(payload={"readable_id": "video-1", "course": course})]
    )
    assert hits[0]["course"] == course


def _add_direct_content_files(resource, count=2, **kwargs):
    """
    Attach the direct content files that video/document responses nest.

    ContentFileFactory._create always fills in run or learning_resource, but the
    model's check constraint requires a direct content file to have neither, so
    the foreign key is moved after creation.
    """
    content_files = ContentFileFactory.create_batch(
        count, learning_resource=resource, **kwargs
    )
    ContentFile.objects.filter(id__in=[cf.id for cf in content_files]).update(
        learning_resource=None, direct_learning_resource=resource
    )
    return content_files


def _payload_as_search_sees_it(resource_id):
    """
    Return the indexed payload minus what PayloadSelectorExclude strips,
    i.e. exactly what _resource_payload_hits receives from a search.
    """
    payload = next(iter(serialize_bulk_learning_resources([resource_id])))
    for excluded in RESOURCES_PAYLOAD_EXCLUDE:
        top_level, _, nested = excluded.partition(".")
        if nested:
            if isinstance(payload.get(top_level), dict):
                payload[top_level].pop(nested, None)
        else:
            payload.pop(top_level, None)
    return payload


def test_content_files_is_not_excluded_from_the_payload():
    """
    content_files must stay in the payload: document and video responses declare
    it, and search cards fall back to content_files[0].image_src for the
    thumbnail. Its large text fields are trimmed in Python instead, because a
    Qdrant payload selector cannot descend into a list of objects.
    """
    assert "content_files" not in RESOURCES_PAYLOAD_EXCLUDE


@pytest.mark.parametrize(
    ("factory_kwargs", "has_content_files"),
    [
        ({"is_course": True}, False),
        ({"is_video": True}, True),
        ({"resource_type": LearningResourceType.document.name}, True),
    ],
)
def test_resource_payload_hits_matches_hydrated_hits(factory_kwargs, has_content_files):
    """
    The payload path should return what the database hydration path returns,
    modulo the fields the indexing serializer adds on top of the API shape --
    including the nested content_files that document and video responses
    declare.
    """
    resource = LearningResourceFactory.create(**factory_kwargs)
    if has_content_files:
        _add_direct_content_files(
            resource, image_src="https://img.youtube.com/thumb.jpg"
        )

    payload = _payload_as_search_sees_it(resource.id)
    hydrated = _resource_vector_hits(
        [
            MagicMock(
                payload={
                    "readable_id": resource.readable_id,
                    "platform": {
                        "code": resource.platform.code if resource.platform else ""
                    },
                }
            )
        ]
    )
    from_payload = _resource_payload_hits([MagicMock(payload=payload)])

    assert len(from_payload) == 1
    assert set(from_payload[0]) == set(hydrated[0])

    if has_content_files:
        # the nested field must carry the API's shape, not the indexing shape
        assert from_payload[0]["content_files"]
        assert {frozenset(cf) for cf in from_payload[0]["content_files"]} == {
            frozenset(cf) for cf in hydrated[0]["content_files"]
        }


@pytest.mark.parametrize(
    "resource_type",
    [LearningResourceType.video.name, LearningResourceType.document.name],
)
def test_resource_payload_hits_keeps_content_files_thumbnail_fallback(resource_type):
    """
    Search cards use content_files[0].image_src as the thumbnail when the
    resource has no image, so the payload path must keep the nested content
    files -- minus the large text the indexing serializer re-adds.
    """
    payload = {
        "readable_id": f"{resource_type}-1",
        "platform": {"code": "youtube"},
        "resource_type": resource_type,
        "image": None,
        "content_files": [
            {
                "id": 1,
                "key": "lecture.pdf",
                "title": "Lecture",
                "image_src": "https://img.youtube.com/thumb.jpg",
                "content": "the full extracted text, many kilobytes of it",
                "summary": "a generated summary",
                "flashcards": [{"question": "q", "answer": "a"}],
            }
        ],
    }

    hits = _resource_payload_hits([MagicMock(payload=payload)])
    content_file = hits[0]["content_files"][0]

    assert content_file["image_src"] == "https://img.youtube.com/thumb.jpg"
    assert content_file["key"] == "lecture.pdf"
    assert content_file["title"] == "Lecture"
    assert set(CONTENT_FILE_LARGE_FIELDS).isdisjoint(content_file)
    # the payload dict Qdrant handed us is not mutated
    assert "content" in payload["content_files"][0]


@pytest.mark.parametrize("content_files", [None, [], "not-a-list"])
def test_resource_payload_hits_tolerates_odd_content_files(content_files):
    """Resources without nested content files pass through untouched"""
    hits = _resource_payload_hits(
        [MagicMock(payload={"readable_id": "c-1", "content_files": content_files})]
    )
    assert hits[0]["content_files"] == content_files


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


def test_custom_score_formula_empty(mocker):
    """
    If there are no score_params for the collection in VECTOR_SEARCH_SCORE_BOOST,
    custom_score_formula must return an empty list.
    """

    mocker.patch("vector_search.utils.VECTOR_SEARCH_SCORE_BOOST", {})
    assert custom_score_formula("non_existent_collection") == []


def test_custom_score_formula_with_boosts(mocker):
    """
    custom_score_formula must boost scores based on VECTOR_SEARCH_SCORE_BOOST
    and append a GaussDecayExpression at the end.
    """

    mock_boosts = {
        RESOURCES_COLLECTION_NAME: [
            {"boost": 0.5, "params": {"resource_type": ["course"]}},
            {"boost": 0.2, "params": {"offered_by": ["ocw"]}},
        ]
    }
    mocker.patch("vector_search.utils.VECTOR_SEARCH_SCORE_BOOST", mock_boosts)

    results = custom_score_formula(RESOURCES_COLLECTION_NAME)

    # We expect 3 expressions: 2 MultExpressions and 1 GaussDecayExpression
    assert len(results) == 2

    # Check first boost expression
    assert isinstance(results[0], models.MultExpression)
    assert results[0].mult[0] == 0.5
    # The second element in mult should be the Filter for resource_type=course
    filter_1 = results[0].mult[1]
    assert isinstance(filter_1, models.Filter)
    assert any(
        isinstance(c, models.FieldCondition)
        and c.key == "resource_type"
        and isinstance(c.match, models.MatchAny)
        and c.match.any == ["course"]
        for c in filter_1.must
    )

    # Check second boost expression
    assert isinstance(results[1], models.MultExpression)
    assert results[1].mult[0] == 0.2
    filter_2 = results[1].mult[1]
    assert isinstance(filter_2, models.Filter)
    assert any(
        isinstance(c, models.FieldCondition)
        and c.key == "offered_by.code"
        and isinstance(c.match, models.MatchAny)
        and c.match.any == ["ocw"]
        for c in filter_2.must
    )

    # Check GaussDecayExpression decay expression at the end
    assert isinstance(results[0].mult[2], models.GaussDecayExpression)
    assert isinstance(results[1].mult[2], models.GaussDecayExpression)


def test_custom_score_formula_defaults(mocker):
    """
    If the boost key is missing, custom_score_formula should default the boost amount to 0.
    """

    mock_boosts = {
        RESOURCES_COLLECTION_NAME: [{"params": {"resource_type": ["course"]}}]
    }
    mocker.patch("vector_search.utils.VECTOR_SEARCH_SCORE_BOOST", mock_boosts)

    results = custom_score_formula(RESOURCES_COLLECTION_NAME)

    assert len(results) == 1

    assert isinstance(results[0], models.MultExpression)
    assert results[0].mult[0] == 0
    assert isinstance(results[0].mult[1], models.Filter)

    assert isinstance(results[0].mult[2], models.GaussDecayExpression)


def test_completeness_penalty_expression(settings):
    """The penalty subtracts weight * (1 - completeness) from the score."""
    settings.VECTOR_SEARCH_INCOMPLETENESS_PENALTY_WEIGHT = 0.05

    expression = completeness_penalty_expression(RESOURCES_COLLECTION_NAME)

    assert isinstance(expression, models.NegExpression)
    weight, incompleteness = expression.neg.mult
    assert weight == 0.05
    # 1 - completeness
    assert incompleteness.sum[0] == 1
    assert incompleteness.sum[1].neg == COMPLETENESS_PAYLOAD_KEY


@pytest.mark.parametrize("weight", [0, None, -1])
def test_completeness_penalty_expression_disabled(settings, weight):
    """A weight of 0, unset, or negative leaves scores alone."""
    settings.VECTOR_SEARCH_INCOMPLETENESS_PENALTY_WEIGHT = weight

    assert completeness_penalty_expression(RESOURCES_COLLECTION_NAME) is None


def test_completeness_penalty_expression_other_collections(settings):
    """Only resource payloads carry completeness, so only they are penalized."""
    settings.VECTOR_SEARCH_INCOMPLETENESS_PENALTY_WEIGHT = 0.05

    assert completeness_penalty_expression(CONTENT_FILES_COLLECTION_NAME) is None


def test_score_formula_query_combines_boosts_and_penalty(mocker, settings):
    """Boosts add to the score and the penalty subtracts from it."""
    settings.VECTOR_SEARCH_INCOMPLETENESS_PENALTY_WEIGHT = 0.05
    settings.VECTOR_SEARCH_STALENESS_PENALTY_WEIGHT = 0
    mocker.patch(
        "vector_search.utils.VECTOR_SEARCH_SCORE_BOOST",
        {RESOURCES_COLLECTION_NAME: [{"boost": 0.15, "params": {"free": True}}]},
    )

    formula_query = score_formula_query(RESOURCES_COLLECTION_NAME)

    assert formula_query.defaults == {COMPLETENESS_PAYLOAD_KEY: 1.0}
    score, boost, penalty = formula_query.formula.sum
    assert score == "$score"
    assert isinstance(boost, models.MultExpression)
    assert penalty == completeness_penalty_expression(RESOURCES_COLLECTION_NAME)


def test_score_formula_query_penalty_only(mocker, settings):
    """With no boosts configured the formula is the score minus the penalty."""
    settings.VECTOR_SEARCH_INCOMPLETENESS_PENALTY_WEIGHT = 0.05
    settings.VECTOR_SEARCH_STALENESS_PENALTY_WEIGHT = 0
    mocker.patch("vector_search.utils.VECTOR_SEARCH_SCORE_BOOST", {})

    formula_query = score_formula_query(RESOURCES_COLLECTION_NAME)

    score, penalty = formula_query.formula.sum
    assert score == "$score"
    assert penalty == completeness_penalty_expression(RESOURCES_COLLECTION_NAME)


def test_score_formula_query_boosts_only(mocker, settings):
    """With the penalty disabled the formula keeps the boosts and no defaults."""
    settings.VECTOR_SEARCH_INCOMPLETENESS_PENALTY_WEIGHT = 0
    settings.VECTOR_SEARCH_STALENESS_PENALTY_WEIGHT = 0
    mocker.patch(
        "vector_search.utils.VECTOR_SEARCH_SCORE_BOOST",
        {RESOURCES_COLLECTION_NAME: [{"boost": 0.15, "params": {"free": True}}]},
    )

    formula_query = score_formula_query(RESOURCES_COLLECTION_NAME)

    assert not formula_query.defaults
    score, boost = formula_query.formula.sum
    assert score == "$score"
    assert isinstance(boost, models.MultExpression)


def test_staleness_penalty_expression(settings):
    """The penalty decays linearly over resource_age_date, from now."""
    settings.VECTOR_SEARCH_STALENESS_PENALTY_WEIGHT = 0.05
    settings.VECTOR_SEARCH_STALENESS_HORIZON_YEARS = 20
    now = datetime(2026, 1, 1, tzinfo=UTC)

    expression = staleness_penalty_expression(RESOURCES_COLLECTION_NAME, now)

    assert isinstance(expression, models.NegExpression)
    weight, staleness = expression.neg.mult
    assert weight == 0.05
    # 1 - decay
    assert staleness.sum[0] == 1
    decay = staleness.sum[1].neg.lin_decay
    assert decay.x.datetime_key == RESOURCE_AGE_DATE_PAYLOAD_KEY
    assert decay.target.datetime == now.isoformat()
    # Qdrant rejects a midpoint of 0, so the horizon is expressed as the default
    # midpoint over half the scale -- the same line, bottoming out at the horizon
    # rather than halfway to it.
    assert decay.scale == 20 * SECONDS_PER_YEAR / 2
    assert decay.midpoint == 0.5
    assert 0 < decay.midpoint < 1


@pytest.mark.parametrize("age_years", [0, 5, 20, 40])
def test_staleness_penalty_ramps_linearly_to_the_horizon(settings, age_years):
    """
    The emitted decay params subtract weight * age / horizon, saturating at the
    weight once a resource is at least a horizon old.
    """
    settings.VECTOR_SEARCH_STALENESS_PENALTY_WEIGHT = 0.05
    settings.VECTOR_SEARCH_STALENESS_HORIZON_YEARS = 20
    now = datetime(2026, 1, 1, tzinfo=UTC)

    expression = staleness_penalty_expression(RESOURCES_COLLECTION_NAME, now)
    weight, staleness = expression.neg.mult
    decay_params = staleness.sum[1].neg.lin_decay

    # Qdrant's linear decay, evaluated for a resource of this age
    age_seconds = age_years * SECONDS_PER_YEAR
    decay = max(0, 1 - (1 - decay_params.midpoint) * age_seconds / decay_params.scale)
    penalty = weight * (1 - decay)

    assert penalty == pytest.approx(0.05 * min(age_years / 20, 1))


@pytest.mark.parametrize("weight", [0, None, -1])
def test_staleness_penalty_expression_disabled(settings, weight):
    """A weight of 0, unset, or negative leaves scores alone."""
    settings.VECTOR_SEARCH_STALENESS_PENALTY_WEIGHT = weight

    assert (
        staleness_penalty_expression(RESOURCES_COLLECTION_NAME, datetime.now(tz=UTC))
        is None
    )


@pytest.mark.parametrize("horizon_years", [0, None, -1])
def test_staleness_penalty_expression_without_horizon(settings, horizon_years):
    """A horizon of 0, unset, or negative has no ramp to penalize along."""
    settings.VECTOR_SEARCH_STALENESS_PENALTY_WEIGHT = 0.05
    settings.VECTOR_SEARCH_STALENESS_HORIZON_YEARS = horizon_years

    assert (
        staleness_penalty_expression(RESOURCES_COLLECTION_NAME, datetime.now(tz=UTC))
        is None
    )


def test_staleness_penalty_expression_other_collections(settings):
    """Only resource payloads carry an age date, so only they are penalized."""
    settings.VECTOR_SEARCH_STALENESS_PENALTY_WEIGHT = 0.05

    assert (
        staleness_penalty_expression(
            CONTENT_FILES_COLLECTION_NAME, datetime.now(tz=UTC)
        )
        is None
    )


def test_score_formula_query_combines_both_penalties(mocker, settings):
    """Incompleteness and staleness both subtract from the score."""
    settings.VECTOR_SEARCH_INCOMPLETENESS_PENALTY_WEIGHT = 0.05
    settings.VECTOR_SEARCH_STALENESS_PENALTY_WEIGHT = 0.05
    mocker.patch("vector_search.utils.VECTOR_SEARCH_SCORE_BOOST", {})
    now = datetime(2026, 1, 1, tzinfo=UTC)

    with freeze_time(now):
        formula_query = score_formula_query(RESOURCES_COLLECTION_NAME)

    score, completeness_penalty, staleness = formula_query.formula.sum
    assert score == "$score"
    assert completeness_penalty == completeness_penalty_expression(
        RESOURCES_COLLECTION_NAME
    )
    assert staleness == staleness_penalty_expression(RESOURCES_COLLECTION_NAME, now)
    # a resource with no age date is not stale, and scores as if published now
    assert formula_query.defaults == {
        COMPLETENESS_PAYLOAD_KEY: 1.0,
        RESOURCE_AGE_DATE_PAYLOAD_KEY: now.isoformat(),
    }


def test_score_formula_query_staleness_penalty_only(mocker, settings):
    """With incompleteness disabled, only the age date needs a default."""
    settings.VECTOR_SEARCH_INCOMPLETENESS_PENALTY_WEIGHT = 0
    settings.VECTOR_SEARCH_STALENESS_PENALTY_WEIGHT = 0.05
    mocker.patch("vector_search.utils.VECTOR_SEARCH_SCORE_BOOST", {})

    formula_query = score_formula_query(RESOURCES_COLLECTION_NAME)

    assert list(formula_query.defaults) == [RESOURCE_AGE_DATE_PAYLOAD_KEY]
    score, staleness = formula_query.formula.sum
    assert score == "$score"
    assert isinstance(staleness.neg.mult[1].sum[1].neg, models.LinDecayExpression)


def test_score_formula_query_nothing_to_apply(mocker, settings):
    """Nothing to boost and nothing to penalize means no rescoring stage."""
    settings.VECTOR_SEARCH_INCOMPLETENESS_PENALTY_WEIGHT = 0.05
    mocker.patch("vector_search.utils.VECTOR_SEARCH_SCORE_BOOST", {})

    assert score_formula_query(CONTENT_FILES_COLLECTION_NAME) is None


@pytest.mark.django_db
def test_best_run_ids_for_resources_non_test_mode():
    """A normal course resolves to only its best run's run_id."""
    from datetime import timedelta

    from django.utils import timezone

    from vector_search.utils import best_run_ids_for_resources

    course = LearningResourceFactory.create(is_course=True, test_mode=False)
    course.runs.all().delete()
    LearningResourceRunFactory.create(
        learning_resource=course,
        run_id="OLD_RUN",
        published=True,
        start_date=timezone.now() - timedelta(days=60),
        enrollment_start=None,
        enrollment_end=None,
        end_date=None,
    )
    best = LearningResourceRunFactory.create(
        learning_resource=course,
        run_id="NEW_RUN",
        published=True,
        start_date=timezone.now() - timedelta(days=10),
        enrollment_start=None,
        enrollment_end=None,
        end_date=None,
    )
    # best_run falls back to the latest start_date among published runs
    assert course.best_run.run_id == best.run_id

    run_ids = best_run_ids_for_resources([course.readable_id])

    assert run_ids == [best.run_id]


@pytest.mark.django_db
def test_best_run_ids_for_resources_test_mode_returns_all_published():
    """A test_mode course resolves to every published run_id."""
    from vector_search.utils import best_run_ids_for_resources

    course = LearningResourceFactory.create(is_course=True, test_mode=True)
    course.runs.all().delete()
    run_a = LearningResourceRunFactory.create(
        learning_resource=course, run_id="RUN_A", published=True
    )
    run_b = LearningResourceRunFactory.create(
        learning_resource=course, run_id="RUN_B", published=True
    )
    LearningResourceRunFactory.create(
        learning_resource=course, run_id="RUN_UNPUB", published=False
    )

    run_ids = best_run_ids_for_resources([course.readable_id])

    assert set(run_ids) == {run_a.run_id, run_b.run_id}


@pytest.mark.django_db
def test_best_run_ids_for_resources_union_across_resources():
    """Multiple resources yield the union of their resolved run_ids."""
    from datetime import timedelta

    from django.utils import timezone

    from vector_search.utils import best_run_ids_for_resources

    course1 = LearningResourceFactory.create(is_course=True, test_mode=False)
    course1.runs.all().delete()
    best1 = LearningResourceRunFactory.create(
        learning_resource=course1,
        run_id="C1_BEST",
        published=True,
        start_date=timezone.now() - timedelta(days=10),
        enrollment_start=None,
        enrollment_end=None,
        end_date=None,
    )
    course2 = LearningResourceFactory.create(is_course=True, test_mode=False)
    course2.runs.all().delete()
    best2 = LearningResourceRunFactory.create(
        learning_resource=course2,
        run_id="C2_BEST",
        published=True,
        start_date=timezone.now() - timedelta(days=10),
        enrollment_start=None,
        enrollment_end=None,
        end_date=None,
    )

    run_ids = best_run_ids_for_resources([course1.readable_id, course2.readable_id])

    assert set(run_ids) == {best1.run_id, best2.run_id}


@pytest.mark.django_db
def test_best_run_ids_for_resources_no_published_run():
    """A course with no published run contributes nothing (no error)."""
    from vector_search.utils import best_run_ids_for_resources

    course = LearningResourceFactory.create(is_course=True, test_mode=False)
    course.runs.all().delete()
    LearningResourceRunFactory.create(
        learning_resource=course, run_id="UNPUB", published=False
    )

    assert best_run_ids_for_resources([course.readable_id]) == []


def test_ensure_qdrant_collections_runs_once(mocker):
    create = mocker.patch("vector_search.utils.create_qdrant_collections")
    vs_utils.ensure_qdrant_collections()
    vs_utils.ensure_qdrant_collections()
    create.assert_called_once_with(force_recreate=False)


def test_embed_learning_resources_uses_collection_guard(mocker):
    """embed_learning_resources delegates collection-ensuring to the guard
    (not a direct create_qdrant_collections call).
    """
    ensure = mocker.patch("vector_search.utils.ensure_qdrant_collections")
    mocker.patch("vector_search.utils.qdrant_client")
    mocker.patch("vector_search.utils.serialize_bulk_content_files", return_value=[])
    vs_utils.embed_learning_resources([1], CONTENT_FILE_TYPE, overwrite=True)
    ensure.assert_called_once()


@pytest.mark.django_db
def test_check_missing_content_file_ids_not_in_db(mocker):
    """An edx_module_id with no ContentFile row is logged not_in_db."""
    absent_id = "block-v1:MITx+6.00x+2T2020+type@problem+block@absent"
    mock_log = mocker.patch("vector_search.utils.log_missing_content_file")
    mock_client = mocker.AsyncMock()
    mock_client.count = mocker.AsyncMock(return_value=CountResult(count=5))
    mocker.patch("vector_search.utils.async_qdrant_client", return_value=mock_client)

    async_to_sync(check_missing_content_file_ids)(
        [absent_id], CONTENT_FILES_COLLECTION_NAME
    )

    mock_log.assert_called_once_with(
        absent_id, reason="not_in_db", source="vector_content_files_search"
    )
    mock_client.count.assert_not_called()


@pytest.mark.django_db
def test_check_missing_content_file_ids_trims_edge_whitespace(mocker):
    """Edge whitespace is trimmed before probing, and the trimmed id is logged."""
    absent_id = "block-v1:MITx+6.00x+2T2020+type@problem+block@absent"
    mock_log = mocker.patch("vector_search.utils.log_missing_content_file")
    mock_client = mocker.AsyncMock()
    mock_client.count = mocker.AsyncMock(return_value=CountResult(count=5))
    mocker.patch("vector_search.utils.async_qdrant_client", return_value=mock_client)

    async_to_sync(check_missing_content_file_ids)(
        [f" {absent_id} "], CONTENT_FILES_COLLECTION_NAME
    )

    mock_log.assert_called_once_with(
        absent_id, reason="not_in_db", source="vector_content_files_search"
    )


@pytest.mark.django_db
def test_check_missing_content_file_ids_not_in_index(mocker):
    """An edx_module_id present in the DB but with zero Qdrant points -> not_in_index."""
    present_id = "block-v1:MITx+6.00x+2T2020+type@problem+block@present"
    ContentFileFactory.create(edx_module_id=present_id)
    mock_log = mocker.patch("vector_search.utils.log_missing_content_file")
    mock_client = mocker.AsyncMock()
    mock_client.count = mocker.AsyncMock(return_value=CountResult(count=0))
    mocker.patch("vector_search.utils.async_qdrant_client", return_value=mock_client)

    async_to_sync(check_missing_content_file_ids)(
        [present_id], CONTENT_FILES_COLLECTION_NAME
    )

    mock_log.assert_called_once_with(
        present_id, reason="not_in_index", source="vector_content_files_search"
    )
    assert mock_client.count.call_args.kwargs["exact"] is True


@pytest.mark.django_db
def test_check_missing_content_file_ids_present_and_indexed_silent(mocker):
    """An id present in DB and present in Qdrant logs nothing."""
    present_id = "block-v1:MITx+6.00x+2T2020+type@problem+block@ok"
    ContentFileFactory.create(edx_module_id=present_id)
    mock_log = mocker.patch("vector_search.utils.log_missing_content_file")
    mock_client = mocker.AsyncMock()
    mock_client.count = mocker.AsyncMock(return_value=CountResult(count=3))
    mocker.patch("vector_search.utils.async_qdrant_client", return_value=mock_client)

    async_to_sync(check_missing_content_file_ids)(
        [present_id], CONTENT_FILES_COLLECTION_NAME
    )

    mock_log.assert_not_called()


@pytest.mark.django_db
def test_check_missing_content_file_ids_skips_unimportant_block_types(mocker):
    """Unimportant block types are filtered out before any DB or Qdrant probe."""
    mock_present = mocker.patch("vector_search.utils.present_edx_module_ids")
    mock_log = mocker.patch("vector_search.utils.log_missing_content_file")
    mock_client = mocker.AsyncMock()
    mock_client.count = mocker.AsyncMock(return_value=CountResult(count=0))
    mocker.patch("vector_search.utils.async_qdrant_client", return_value=mock_client)

    async_to_sync(check_missing_content_file_ids)(
        [
            "block-v1:MITx+6.00x+2T2020+type@discussion+block@abc",
            "does-not-exist",
        ],
        CONTENT_FILES_COLLECTION_NAME,
    )

    mock_present.assert_not_called()
    mock_client.count.assert_not_called()
    mock_log.assert_not_called()
