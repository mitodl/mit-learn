import asyncio
import gc
import logging
import uuid
from functools import cache

from asgiref.sync import sync_to_async
from django.conf import settings
from django.db.models import Prefetch, Q
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)
from qdrant_client import AsyncQdrantClient, QdrantClient, models

from learning_resources.constants import (
    PROGRAM_COURSE_CACHE_KEY_TEST_MODE,
)
from learning_resources.content_summarizer import ContentSummarizer
from learning_resources.models import (
    ContentFile,
    LearningResource,
    LearningResourceRun,
    LearningResourceTopic,
)
from learning_resources.serializers import (
    ContentFileSerializer,
    LearningResourceMetadataDisplaySerializer,
    LearningResourceSerializer,
)
from learning_resources.utils import (
    is_loggable_missing_content_id,
    log_missing_content_file,
    present_edx_module_ids,
)
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
    LEARNING_RESOURCE_TYPES,
)
from learning_resources_search.serializers import (
    serialize_bulk_content_files,
    serialize_bulk_learning_resources,
)
from main.utils import checksum_for_content, chunks
from vector_search.constants import (
    COLLECTION_PARAM_MAP,
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
    QDRANT_TOPIC_INDEXES,
    RESOURCES_COLLECTION_NAME,
    TOPICS_COLLECTION_NAME,
    VECTOR_SEARCH_SCORE_BOOST,
)
from vector_search.encoders.utils import (
    dense_encoder,
    sparse_encoder,
    truncate_to_model_limit,
)

logger = logging.getLogger(__name__)

MARKDOWN_HEADERS_TO_SPLIT_ON = [
    ("#", "Header 1"),
    ("##", "Header 2"),
    ("###", "Header 3"),
    ("####", "Header 4"),
]


@cache
def qdrant_client():
    enable_cloud_inference = (
        dense_encoder().requires_cloud_inferencing
        or sparse_encoder().requires_cloud_inferencing
    )

    return QdrantClient(
        url=settings.QDRANT_HOST,
        api_key=settings.QDRANT_API_KEY,
        grpc_port=6334,
        prefer_grpc=True,
        cloud_inference=enable_cloud_inference,
        timeout=settings.QDRANT_CLIENT_TIMEOUT,
    )


@cache
def async_qdrant_client():
    enable_cloud_inference = (
        dense_encoder().requires_cloud_inferencing
        or sparse_encoder().requires_cloud_inferencing
    )

    return AsyncQdrantClient(
        url=settings.QDRANT_HOST,
        api_key=settings.QDRANT_API_KEY,
        grpc_port=6334,
        prefer_grpc=True,
        cloud_inference=enable_cloud_inference,
        timeout=settings.QDRANT_CLIENT_TIMEOUT,
    )


def points_generator(
    ids,
    metadata,
    dense_encoded_docs,
    sparse_encoded_docs,
):
    """
    Get a generator for embedding points to store in Qdrant

    Args:
        ids (list): list of unique point ids
        metadata (list): list of metadata dictionaries
        dense_encoded_docs (list): list of vectorized documents
        sparse_encoded_docs
    Returns:
        generator:
            A generator of PointStruct objects
    """
    dense_vector_name = dense_encoder().model_short_name()
    sparse_vector_name = sparse_encoder().model_short_name()
    if ids is None:
        ids = iter(lambda: uuid.uuid4().hex, None)
    if metadata is None:
        metadata = iter(dict, None)
    for idx, meta, dense_vector, sparse_vector in zip(
        ids, metadata, dense_encoded_docs, sparse_encoded_docs
    ):
        payload = meta
        point_data = {"id": idx, "payload": payload}
        if any(dense_vector):
            point_vector: dict[str, models.Vector] = {
                dense_vector_name: dense_vector,
                sparse_vector_name: sparse_vector,
            }
            point_data["vector"] = point_vector
        yield models.PointStruct(**point_data)


def compute_optimizer_settings(point_count: int, shard_number: int):
    points_per_shard = max(point_count // shard_number, 1)

    # Determine target segment size
    if points_per_shard < QDRANT_OPTIMIZER_THRESHOLD_SMALL:
        target_segment = QDRANT_OPTIMIZER_SEGMENT_SMALL
        flush_interval = QDRANT_OPTIMIZER_FLUSH_INTERVAL_SMALL
    elif points_per_shard < QDRANT_OPTIMIZER_THRESHOLD_MEDIUM:
        target_segment = QDRANT_OPTIMIZER_SEGMENT_MEDIUM
        flush_interval = QDRANT_OPTIMIZER_FLUSH_INTERVAL_MEDIUM
    elif points_per_shard < QDRANT_OPTIMIZER_THRESHOLD_LARGE:
        target_segment = QDRANT_OPTIMIZER_SEGMENT_LARGE
        flush_interval = QDRANT_OPTIMIZER_FLUSH_INTERVAL_LARGE
    else:
        target_segment = QDRANT_OPTIMIZER_SEGMENT_XLARGE
        flush_interval = QDRANT_OPTIMIZER_FLUSH_INTERVAL_XLARGE

    indexing_threshold = int(target_segment * QDRANT_OPTIMIZER_INDEXING_THRESHOLD_RATIO)

    return {
        "indexing_threshold": indexing_threshold,
        "flush_interval_sec": flush_interval,
    }


def tune_collection(client, collection_name):
    info = client.get_collection(collection_name)
    point_count = info.points_count
    shard_number = info.config.params.shard_number
    desired = compute_optimizer_settings(point_count, shard_number)
    current = info.config.optimizer_config
    if (
        current.indexing_threshold == desired["indexing_threshold"]
        and current.flush_interval_sec == desired["flush_interval_sec"]
    ):
        return
    client.update_collection(
        collection_name=collection_name,
        optimizer_config=models.OptimizersConfigDiff(**desired),
    )


@cache
def ensure_qdrant_collections() -> None:
    """Ensure Qdrant collections exist, at most once per worker process."""
    create_qdrant_collections(force_recreate=False)


def create_qdrant_collections(force_recreate):
    """
    Create or recreate QDrant collections

    Args:
        force_recreate (bool): Whether to recreate the collections
        even if they already exist
    """

    collections = [
        RESOURCES_COLLECTION_NAME,
        CONTENT_FILES_COLLECTION_NAME,
        TOPICS_COLLECTION_NAME,
    ]
    for collection_name in collections:
        create_qdrant_collection(collection_name, force_recreate)

    update_qdrant_indexes()


def tune_qdrant_collections():
    """Tune optimizer settings for Qdrant collections."""
    if not all([settings.QDRANT_HOST, settings.QDRANT_BASE_COLLECTION_NAME]):
        logger.warning(
            "Skipping Qdrant collection tuning: "
            "QDRANT_HOST and QDRANT_BASE_COLLECTION_NAME must be set"
        )
        return

    client = qdrant_client()
    collections = [
        RESOURCES_COLLECTION_NAME,
        CONTENT_FILES_COLLECTION_NAME,
        TOPICS_COLLECTION_NAME,
    ]
    for collection_name in collections:
        if not client.collection_exists(collection_name=collection_name):
            continue
        tune_collection(client, collection_name)


def create_qdrant_collection(collection_name, force_recreate):
    """
    Create or recreate a QDrant collection
    """
    client = qdrant_client()
    encoder_dense = dense_encoder()
    encoder_sparse = sparse_encoder()
    # True if either of the collections were recreated
    if not client.collection_exists(collection_name=collection_name) or force_recreate:
        client.delete_collection(collection_name)
        client.recreate_collection(
            collection_name=collection_name,
            on_disk_payload=True,
            vectors_config={
                encoder_dense.model_short_name(): models.VectorParams(
                    size=encoder_dense.dim(), distance=models.Distance.COSINE
                ),
            },
            sparse_vectors_config={
                encoder_sparse.model_short_name(): models.SparseVectorParams(
                    index=models.SparseIndexParams(on_disk=True),
                )
            },
            replication_factor=2,
            shard_number=6,
            strict_mode_config=models.StrictModeConfig(
                enabled=True,
                unindexed_filtering_retrieve=False,
                unindexed_filtering_update=False,
            ),
            optimizers_config=models.OptimizersConfigDiff(
                default_segment_number=2, prevent_unoptimized=True
            ),
            quantization_config=models.BinaryQuantization(
                binary=models.BinaryQuantizationConfig(
                    always_ram=True,
                ),
            ),
            hnsw_config=models.HnswConfigDiff(on_disk=False),
        )


def update_qdrant_indexes():
    """
    Create or update Qdrant indexes based on mapping in constants
    """
    client = qdrant_client()

    for index in [
        (QDRANT_LEARNING_RESOURCE_INDEXES, RESOURCES_COLLECTION_NAME),
        (QDRANT_CONTENT_FILE_INDEXES, CONTENT_FILES_COLLECTION_NAME),
        (QDRANT_TOPIC_INDEXES, TOPICS_COLLECTION_NAME),
    ]:
        indexes = index[0]
        collection_name = index[1]
        collection = client.get_collection(collection_name=collection_name)
        for index_field in indexes:
            if (
                index_field not in collection.payload_schema
                or indexes[index_field]
                != collection.payload_schema[index_field].dict()["data_type"]
            ):
                client.create_payload_index(
                    collection_name=collection_name,
                    field_name=index_field,
                    field_schema=indexes[index_field],
                )


def vector_point_id(readable_id):
    """
    Generate a consistent unique id for a learning resource

    Args:
        readable_id (str): Readable id of learning resource
    Returns:
        str:
            A unique id (UUID5) for the learning resource
    """
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, readable_id))


def embed_topics():
    """
    Embed and store new (sub)topics and remove non-existent ones from Qdrant
    """
    client = qdrant_client()
    create_qdrant_collections(force_recreate=False)
    indexed_count = client.count(collection_name=TOPICS_COLLECTION_NAME).count

    topic_names = set(
        LearningResourceTopic.objects.filter(
            Q(parent=None) | Q(parent__isnull=False)
        ).values_list("name", flat=True)
    )

    if indexed_count > 0:
        existing_points = []
        next_page_offset = None
        while True:
            points, next_page_offset = client.scroll(
                collection_name=TOPICS_COLLECTION_NAME,
                offset=next_page_offset,
            )
            existing_points.extend(points)
            if not next_page_offset:
                break
        indexed_topic_names = {point.payload["name"] for point in existing_points}
    else:
        indexed_topic_names = set()

    new_topics = topic_names - indexed_topic_names
    remove_topics = indexed_topic_names - topic_names
    for remove_topic in remove_topics:
        remove_points_matching_params(
            {"name": remove_topic}, collection_name=TOPICS_COLLECTION_NAME
        )

    docs = []
    metadata = []
    ids = []

    filtered_topics = LearningResourceTopic.objects.filter(name__in=new_topics)

    for topic in filtered_topics:
        docs.append(topic.name)
        metadata.append(
            {
                "name": topic.name,
            }
        )
        ids.append(str(topic.topic_uuid))
    if len(docs) > 0:
        encoder_dense = dense_encoder()
        encoder_sparse = sparse_encoder()
        embeddings = encoder_dense.embed_documents(docs)
        sparse_embeddings = encoder_sparse.embed_documents(docs)

        points = points_generator(
            ids,
            metadata,
            dense_encoded_docs=embeddings,
            sparse_encoded_docs=sparse_embeddings,
        )
        client.upload_points(TOPICS_COLLECTION_NAME, points=points, wait=False)


@cache
def _get_text_splitter(**kwargs):
    if settings.LITELLM_TOKEN_ENCODING_NAME:
        kwargs["encoding_name"] = settings.LITELLM_TOKEN_ENCODING_NAME
        return RecursiveCharacterTextSplitter.from_tiktoken_encoder(**kwargs)
    return RecursiveCharacterTextSplitter(**kwargs)


def _chunk_documents(texts, metadatas):
    # chunk the documents
    chunk_params = {
        "chunk_overlap": settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP,
    }

    if settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE:
        chunk_params["chunk_size"] = settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE

    recursive_splitter = _get_text_splitter(**chunk_params)
    return recursive_splitter.create_documents(texts=texts, metadatas=metadatas)


def _is_markdown_content(doc):
    """Check if a content file document is markdown content."""
    return (
        doc.get("file_type") == "marketing_page" or doc.get("file_extension") == ".md"
    )


def _chunk_markdown_documents(text, metadata):
    """Chunk markdown text using header-aware splitting.

    First splits by markdown headers to preserve section context,
    then sub-splits with RecursiveCharacterTextSplitter to stay
    within chunk size limits. After sub-splitting, any chunk that
    lost its heading is prepended with the header context from
    metadata so every chunk's page_content is self-describing
    for embedding.
    """
    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=MARKDOWN_HEADERS_TO_SPLIT_ON,
        strip_headers=False,
    )
    header_docs = header_splitter.split_text(text)

    chunk_params = {
        "chunk_overlap": settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP,
    }
    if settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE:
        chunk_params["chunk_size"] = settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE

    recursive_splitter = _get_text_splitter(**chunk_params)
    split_docs = recursive_splitter.split_documents(header_docs)

    # Prepend header context to sub-chunks that lost their heading
    # after recursive splitting, using metadata from the header split.
    # Build a map from metadata key to markdown prefix (e.g. "Header 2" -> "##")
    header_prefix_map = {key: prefix for prefix, key in MARKDOWN_HEADERS_TO_SPLIT_ON}
    for doc in split_docs:
        header_parts = [
            doc.metadata[key]
            for key in header_prefix_map
            if key in doc.metadata
            and not doc.page_content.startswith(
                f"{header_prefix_map[key]} {doc.metadata[key]}"
            )
        ]
        if header_parts:
            prefix = " > ".join(header_parts)
            doc.page_content = f"{prefix}\n\n{doc.page_content}"

    # Merge the original content file metadata into each chunk
    for doc in split_docs:
        doc.metadata.update(metadata)

    return split_docs


def _learning_resource_embedding_context(document):
    """
    Get the embedding context for a learning resource

    Content from any attached content files is folded in, mirroring the
    OpenSearch text query which matches against the content of all of a
    resource's content files regardless of resource type. The combined
    context is truncated to the embedding model's input limit.
    """
    context = (
        f"{document.get('title')} "
        f"{document.get('description')} {document.get('full_description')}"
    )
    content = "\n\n".join(
        content_file["content"]
        for content_file in document.get("content_files") or []
        if content_file.get("content")
    )
    if content:
        encoder = dense_encoder()
        context = truncate_to_model_limit(
            f"{context}\n\n# Content\n{content}",
            encoder.model_name,
            token_encoding_name=getattr(encoder, "token_encoding_name", None),
        )
    return context


def _content_file_embedding_context(document):
    """
    Get the embedding context for a content file
    """
    return document.get("content", "")


def _process_resource_embeddings(serialized_resources):
    docs = []
    metadata = []
    ids = []
    encoder_dense = dense_encoder()
    encoder_sparse = sparse_encoder()

    for doc in serialized_resources:
        if not should_generate_resource_embeddings(doc):
            update_learning_resource_payload(doc)
            continue
        metadata.append(doc)
        ids.append(vector_point_id(vector_point_key(doc)))
        docs.append(_learning_resource_embedding_context(doc))
    if len(docs) > 0:
        embeddings = encoder_dense.embed_documents(docs)
        sparse_embeddings = encoder_sparse.embed_documents(docs)
        return points_generator(
            ids,
            metadata,
            dense_encoded_docs=embeddings,
            sparse_encoded_docs=sparse_embeddings,
        )
    return None


def update_learning_resource_payload(serialized_document):
    """
    Refresh a resource's Qdrant payload without re-embedding.
    """
    point_id = vector_point_id(vector_point_key(serialized_document))
    qdrant_client().overwrite_payload(
        collection_name=RESOURCES_COLLECTION_NAME,
        payload=serialized_document,
        points=[point_id],
        wait=False,
    )


def update_content_file_payload(serialized_document):
    search_keys = ["resource_readable_id", "key", "run_readable_id"]
    params = {}
    for key in search_keys:
        if key in serialized_document:
            params[key] = serialized_document[key]
    if not params:
        return
    points = [
        point.id
        for point in retrieve_points_matching_params(
            params,
            collection_name=CONTENT_FILES_COLLECTION_NAME,
        )
    ]

    _set_payload(
        points,
        serialized_document,
        param_map=QDRANT_CONTENT_FILE_PARAM_MAP,
        collection_name=CONTENT_FILES_COLLECTION_NAME,
    )


def _set_payload(points, document, param_map, collection_name):
    """
    Set the payload for a list of points in Qdrant
    Args:
        points (list): List of point ids
        document (dict): Document to set the payload for
        param_map (dict): Mapping of document fields to Qdrant payload fields
        collection_name (str): Name of the Qdrant collection
    """
    client = qdrant_client()
    payload = {}
    for key in param_map:
        if key in document:
            payload[param_map[key]] = document[key]
    if not all([points, payload]):
        return
    for point_batch in [
        points[i : i + settings.QDRANT_POINT_UPLOAD_BATCH_SIZE]
        for i in range(0, len(points), settings.QDRANT_POINT_UPLOAD_BATCH_SIZE)
    ]:
        client.set_payload(
            collection_name=collection_name,
            payload=payload,
            points=point_batch,
            wait=False,
        )


def should_generate_resource_embeddings(serialized_document):
    """
    Determine if we should generate embeddings for a learning resource
    """
    client = qdrant_client()
    point_id = vector_point_id(vector_point_key(serialized_document))
    response = client.retrieve(
        collection_name=RESOURCES_COLLECTION_NAME,
        ids=[point_id],
    )
    if len(response) > 0:
        resource_payload = response[0].payload
        stored_embedding_content = _learning_resource_embedding_context(
            resource_payload
        )
        current_embedding_content = _learning_resource_embedding_context(
            serialized_document
        )
        if stored_embedding_content == current_embedding_content:
            return False
    return True


def _retrieve_content_file_point(
    serialized_document: dict, point_id: str | None = None
):
    client = qdrant_client()
    if not point_id:
        # we just need metadata from the first chunk
        point_id = vector_point_id(
            vector_point_key(
                serialized_document, chunk_number=0, document_type="content_file"
            )
        )
    response = client.retrieve(
        collection_name=CONTENT_FILES_COLLECTION_NAME,
        ids=[point_id],
    )
    if len(response) > 0:
        return response[0]
    return None


def _content_file_stored_checksum_changed(serialized_document: dict) -> bool:
    point = _retrieve_content_file_point(serialized_document)
    if not point:
        return False
    stored_checksum = (point.payload or {}).get("checksum")
    # Missing checksums should not force an expensive summary rewrite by themselves.
    # should_generate_content_embeddings still treats them as changed so embeddings
    # can repair older Qdrant points without overwriting existing summaries.
    return stored_checksum is not None and stored_checksum != serialized_document.get(
        "checksum"
    )


def should_generate_content_embeddings(
    serialized_document: dict, point_id: str | None = None
) -> bool:
    """
    Determine if we should generate embeddings for a content file
    """
    point = _retrieve_content_file_point(serialized_document, point_id=point_id)
    if not point:
        return True
    qdrant_checksum = (point.payload or {}).get("checksum")
    return qdrant_checksum != serialized_document["checksum"]


def _embed_course_metadata_as_contentfile(serialized_resources):
    """
    Embed general course info as a document in the contentfile collection
    """
    client = qdrant_client()
    encoder_dense = dense_encoder()
    encoder_sparse = sparse_encoder()
    serializer_context = {
        PROGRAM_COURSE_CACHE_KEY_TEST_MODE: {},
        "include_test_mode_children": True,
    }
    metadata = []
    ids = []
    docs = []
    for doc in serialized_resources:
        resource_vector_point_id = str(vector_point_id(vector_point_key(doc)))
        serializer = LearningResourceMetadataDisplaySerializer(
            doc, context=serializer_context
        )
        serialized_document = serializer.render_document()
        checksum = checksum_for_content(str(serialized_document))
        key = (
            f"{(doc.get('platform') or {}).get('code', '')}."
            f"{doc['readable_id']}.course_metadata"
        )
        serialized_document["checksum"] = checksum
        serialized_document["key"] = key
        document_point_id = vector_point_id(
            vector_point_key(doc, document_type="course_information")
        )
        if not should_generate_content_embeddings(
            serialized_document, document_point_id
        ):
            continue

        # remove existing course info docs
        remove_points_matching_params(
            {"key": key}, collection_name=CONTENT_FILES_COLLECTION_NAME
        )
        split_texts = serializer.render_chunks()
        split_metadatas = [
            {
                "resource_point_id": str(resource_vector_point_id),
                "chunk_number": chunk_id,
                "chunk_content": chunk_content,
                "resource_readable_id": doc["readable_id"],
                "run_readable_id": doc["readable_id"],
                "file_extension": ".txt",
                "file_type": "course_metadata",
                "key": key,
                "checksum": checksum,
                **{key: doc[key] for key in ["offered_by", "platform", "url"]},
            }
            for chunk_id, chunk_content in enumerate(split_texts)
        ]
        split_ids = [
            vector_point_id(
                vector_point_key(
                    doc,
                    document_type="course_information",
                    chunk_number=md["chunk_number"],
                )
            )
            for md in split_metadatas
        ]
        metadata.extend(split_metadatas)
        docs.extend(split_texts)
        ids.extend(split_ids)
    if len(docs) > 0:
        embeddings = encoder_dense.embed_documents(docs)
        sparse_embeddings = encoder_sparse.embed_documents(docs)
        points = points_generator(
            ids,
            metadata,
            dense_encoded_docs=embeddings,
            sparse_encoded_docs=sparse_embeddings,
        )
        client.upload_points(CONTENT_FILES_COLLECTION_NAME, points=points, wait=False)


def _generate_content_file_points(serialized_content):
    """
    Chunk and embed content file documents, yielding PointStructs
    """
    encoder_dense = dense_encoder()
    encoder_sparse = sparse_encoder()

    """
    Break up requests according to chunk size to stay under openai limits
    300,000 tokens per request
    max array size: 2048
    see: https://platform.openai.com/docs/guides/rate-limits

    The 0.9 factor leaves headroom: markdown header prefixes are prepended
    after the chunk-size split, so real chunks can exceed the nominal size.
    """
    request_chunk_size = max(
        1,
        min(
            2048,
            int(300000 * 0.9 / settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE),
        ),
    )

    for doc in serialized_content:
        embedding_context = _content_file_embedding_context(doc)
        if not embedding_context:
            continue
        should_generate = should_generate_content_embeddings(doc)
        if not should_generate:
            """
            Just update the payload and continue
            """
            update_content_file_payload(doc)
            continue
        """
        if we are generating embeddings then
        the content and number of chunk have changed
        so we need to remove all old points
        """
        # Remove old points directly to prevent re-fetching content
        remove_params = {
            "key": doc["key"],
            "resource_readable_id": doc["resource_readable_id"],
            "platform": (doc.get("platform") or {}).get("code"),
        }
        if doc.get("run_readable_id"):
            remove_params["run_readable_id"] = doc["run_readable_id"]

        remove_points_matching_params(
            remove_params, collection_name=CONTENT_FILES_COLLECTION_NAME
        )

        if _is_markdown_content(doc):
            split_docs = _chunk_markdown_documents(embedding_context, doc)
        else:
            split_docs = _chunk_documents([embedding_context], [doc])

        # Identify non-empty chunks and their original indices
        valid_chunks = [(i, d) for i, d in enumerate(split_docs) if d.page_content]

        if not valid_chunks:
            continue

        split_texts = [d.page_content for _, d in valid_chunks]
        resource_vector_point_id = vector_point_id(vector_point_key(doc))

        for i in range(0, len(split_texts), request_chunk_size):
            chunk_texts = split_texts[i : i + request_chunk_size]
            dense_chunk_embeddings = encoder_dense.embed_documents(chunk_texts)
            sparse_chunk_embeddings = encoder_sparse.embed_documents(chunk_texts)

            for j, dense_embedding in enumerate(dense_chunk_embeddings):
                # Map back to the original valid_chunk index
                relative_index = i + j
                if relative_index >= len(valid_chunks):
                    break
                chunk_id, split_doc = valid_chunks[relative_index]

                metadata = {
                    "resource_point_id": str(resource_vector_point_id),
                    "chunk_number": chunk_id,
                    "chunk_content": split_doc.page_content,
                    **{
                        key: split_doc.metadata[key]
                        for key in QDRANT_CONTENT_FILE_PARAM_MAP
                        if key in split_doc.metadata
                    },
                }

                point_id = vector_point_id(
                    vector_point_key(
                        doc, chunk_number=chunk_id, document_type="content_file"
                    )
                )

                yield models.PointStruct(
                    id=point_id,
                    payload=metadata,
                    vector={
                        encoder_dense.model_short_name(): dense_embedding,
                        encoder_sparse.model_short_name(): sparse_chunk_embeddings[j],
                    },
                )
            # Explicitly free memory for large chunks
            del chunk_texts
            del dense_chunk_embeddings
            del sparse_chunk_embeddings
            gc.collect()


def _iter_serialized_content_files(ids):
    for id_batch in chunks(
        ids, chunk_size=settings.QDRANT_CONTENT_FILE_SERIALIZATION_CHUNK_SIZE
    ):
        yield from serialize_bulk_content_files(id_batch)


def _summarize_content_files_for_embedding(
    docs_batch, fill_summary_content_ids, changed_summary_content_ids
):
    if not fill_summary_content_ids and not changed_summary_content_ids:
        return docs_batch

    summarizer = ContentSummarizer()
    if fill_summary_content_ids:
        summarizer.summarize_content_files_by_ids(
            fill_summary_content_ids, overwrite=False
        )

    failed_changed_ids = set()
    if changed_summary_content_ids:
        statuses = summarizer.summarize_content_files_by_ids(
            changed_summary_content_ids, overwrite=True
        )
        failed_changed_ids = {
            content_file_id
            for content_file_id, status in zip(
                changed_summary_content_ids, statuses or []
            )
            if "failed" in str(status).lower()
        }

    refreshed_docs = list(
        _iter_serialized_content_files([doc["id"] for doc in docs_batch])
    )
    if failed_changed_ids:
        # Keep the old Qdrant checksum so the next run retries summary generation.
        refreshed_docs = [
            doc for doc in refreshed_docs if doc["id"] not in failed_changed_ids
        ]
    return refreshed_docs


def embed_learning_resources(ids, resource_type, overwrite):  # noqa: PLR0915, C901
    """
    Embed learning resources

    Args:
        ids (list of int): Ids of learning resources to embed
        resource_type (str): Type of learning resource to embed
    """

    if (
        resource_type not in LEARNING_RESOURCE_TYPES
        and resource_type != CONTENT_FILE_TYPE
    ):
        return

    client = qdrant_client()
    ensure_qdrant_collections()
    if resource_type != CONTENT_FILE_TYPE:
        serialized_resources = list(serialize_bulk_learning_resources(ids))
        points = [
            (vector_point_id(vector_point_key(serialized)), serialized)
            for serialized in serialized_resources
        ]
        if not overwrite:
            filtered_point_ids = filter_existing_qdrant_points_by_ids(
                [point[0] for point in points],
                collection_name=RESOURCES_COLLECTION_NAME,
            )
            serialized_resources = [
                point[1] for point in points if point[0] in filtered_point_ids
            ]

        collection_name = RESOURCES_COLLECTION_NAME

        points = _process_resource_embeddings(serialized_resources)
        _embed_course_metadata_as_contentfile(serialized_resources)
    else:
        serialized_resources = _iter_serialized_content_files(ids)

        # Batching parameters
        current_batch_docs = []
        current_batch_size = 0

        collection_name = CONTENT_FILES_COLLECTION_NAME

        def process_batch(docs_batch):
            """Process a batch of documents"""
            fill_summary_content_ids = []
            changed_summary_content_ids = []

            # Collect IDs for summarization
            contentfile_points = [
                (
                    vector_point_id(
                        vector_point_key(
                            doc, chunk_number=0, document_type="content_file"
                        )
                    ),
                    doc,
                )
                for doc in docs_batch
            ]
            if not overwrite:
                filtered_point_ids = filter_existing_qdrant_points_by_ids(
                    [point[0] for point in contentfile_points],
                    collection_name=collection_name,
                )
                docs_batch = [
                    point[1]
                    for point in contentfile_points
                    if point[0] in filtered_point_ids
                ]
            for resource in docs_batch:
                if (
                    resource.get("summary")
                    or resource.get("require_summaries")
                    or ContentFile.objects.exclude(summary="")
                    .filter(run__id=resource.get("run_id"))
                    .exists()
                ):
                    if overwrite and _content_file_stored_checksum_changed(resource):
                        changed_summary_content_ids.append(resource["id"])
                    else:
                        fill_summary_content_ids.append(resource["id"])

            docs_batch = _summarize_content_files_for_embedding(
                docs_batch,
                fill_summary_content_ids,
                changed_summary_content_ids,
            )

            points_generator_iter = _generate_content_file_points(docs_batch)
            points_upload_batch = []

            for point in points_generator_iter:
                points_upload_batch.append(point)
                if len(points_upload_batch) >= settings.QDRANT_POINT_UPLOAD_BATCH_SIZE:
                    client.batch_update_points(
                        collection_name=collection_name,
                        update_operations=[
                            models.UpsertOperation(
                                upsert=models.PointsList(
                                    points=points_upload_batch,
                                )
                            ),
                        ],
                        wait=False,
                    )
                    points_upload_batch = []

            if points_upload_batch:
                client.batch_update_points(
                    collection_name=collection_name,
                    update_operations=[
                        models.UpsertOperation(
                            upsert=models.PointsList(
                                points=points_upload_batch,
                            )
                        ),
                    ],
                    wait=False,
                )

            # Explicit deletions to help GC
            del points_generator_iter
            del points_upload_batch

        # We don't delete docs_batch here because it's a reference passed in,
        # but the caller clears the list.

        for doc in serialized_resources:
            current_batch_docs.append(doc)
            current_batch_size += len(doc.get("content", "") or "")

            if current_batch_size >= settings.QDRANT_BATCH_SIZE_BYTES:
                process_batch(current_batch_docs)
                current_batch_docs = []
                current_batch_size = 0
                gc.collect()

        # Process remaining
        if current_batch_docs:
            process_batch(current_batch_docs)
            current_batch_docs = []
            gc.collect()

        points = None  # Handled inside the loop
    if points:
        client.batch_update_points(
            collection_name=collection_name,
            update_operations=[
                models.UpsertOperation(
                    upsert=models.PointsList(
                        points=points,
                    )
                ),
            ],
            wait=False,
        )


def _resource_vector_hits(search_result):
    readable_ids = [
        hit.payload.get("readable_id")
        for hit in search_result
        if hit.payload.get("readable_id")
    ]
    keys = [
        key
        for key in (
            f"{(hit.payload.get('platform') or {}).get('code', '')}:"
            f"{hit.payload.get('readable_id')}"
            for hit in search_result
        )
        if key
    ]
    hits = list(dict.fromkeys(keys))
    """
    Always lookup learning resources by readable_id for portability
    in case we load points from external systems
    """
    resources_by_id = {
        f"{(r.platform.code if r.platform else '')}:{r.readable_id}": r
        for r in LearningResource.objects.for_serialization().filter(
            readable_id__in=readable_ids
        )
    }
    # Re-order to match the Qdrant ranking
    ordered_resources = [resources_by_id[rid] for rid in hits if rid in resources_by_id]

    return LearningResourceSerializer(ordered_resources, many=True).data


async def check_missing_content_file_ids(edx_module_ids, collection_name):
    """
    Log requested edx_module_ids missing from the DB (not_in_db) or present in
    the DB but absent from the Qdrant index (not_in_index). Probes existence
    directly, independent of q/other request filters.
    """
    # Trim edge whitespace so the exact-match DB/Qdrant probes below can't
    # produce false misses for ids that differ only by transport junk.
    edx_module_ids = [
        eid
        for eid in ((eid or "").strip() for eid in edx_module_ids)
        if is_loggable_missing_content_id(eid)
    ]
    if not edx_module_ids:
        return
    present = await sync_to_async(present_edx_module_ids)(edx_module_ids)
    for missing in set(edx_module_ids) - present:
        log_missing_content_file(
            missing, reason="not_in_db", source="vector_content_files_search"
        )
    if not present:
        return
    client = async_qdrant_client()

    async def _check_index(edx_module_id):
        count_filter = qdrant_query_conditions(
            {"edx_module_id": [edx_module_id]}, collection_name=collection_name
        )
        if count_filter is None:
            # Can't scope a count to this id on this collection (e.g. a
            # collection_name override) -> skip rather than count the whole
            # collection, which would mask a real not_in_index gap.
            return
        # exact=True: an approximate 0 would create a false not_in_index alert.
        result = await client.count(
            collection_name=collection_name, count_filter=count_filter, exact=True
        )
        if result.count == 0:
            log_missing_content_file(
                edx_module_id,
                reason="not_in_index",
                source="vector_content_files_search",
            )

    await asyncio.gather(*(_check_index(eid) for eid in present))


def _content_file_vector_hits(search_result):
    run_readable_ids = [hit.payload.get("run_readable_id") for hit in search_result]
    keys = [hit.payload.get("key") for hit in search_result]

    serialized_content_files = ContentFileSerializer(
        ContentFile.objects.for_serialization().filter(
            run__run_id__in=run_readable_ids, key__in=keys
        ),
        many=True,
    ).data
    results = []
    contentfiles_dict = {}
    [
        contentfiles_dict.update({(cf["run_readable_id"], cf["key"]): cf})
        for cf in serialized_content_files
    ]
    results = []
    for hit in search_result:
        payload = hit.payload
        serialized = contentfiles_dict.get(
            (payload.get("run_readable_id"), payload.get("key"))
        )
        if serialized:
            if "content" in serialized:
                serialized.pop("content")
            payload.update(serialized)
        results.append(payload)
    return results


def _merge_dicts(dicts):
    """
    Return a dictionary with keys and values that are common across all input dicts
    """
    if not dicts:
        return {}
    common_keys = set.intersection(*(set(d.keys()) for d in dicts))
    result = {}
    for key in common_keys:
        values = [d[key] for d in dicts]
        if all(v == values[0] for v in values):
            result[key] = values[0]
    return result


def vector_point_key(
    serialized_document, chunk_number=0, document_type="learning_resource"
):
    """
    Generate a consistent unique id for a vector point based on the document type

    Args:
        serialized_document (dict): The serialized document
        to generate the key for
        chunk_number (int): The chunk number for content files
        document_type (str): The type of document
    Returns:
        str: A unique key for the vector point
    """
    platform = (serialized_document.get("platform") or {}).get("code", "")
    if document_type == "learning_resource":
        readable_id = serialized_document.get("readable_id") or serialized_document.get(
            "resource_readable_id"
        )
        return f"{platform}.{readable_id}"
    elif document_type == "course_information":
        return (
            f"{platform}."
            f"{serialized_document['readable_id']}."
            f"course_information.{chunk_number}"
        )
    elif document_type == "content_file":
        return (
            f"{platform}."
            f"{serialized_document['resource_readable_id']}."
            f"{serialized_document.get('run_readable_id', '')}."
            f"{serialized_document['key']}."
            f"{chunk_number}"
        )
    else:
        msg = "Invalid document type for vector point key"
        raise ValueError(msg)


def document_exists(document, collection_name=RESOURCES_COLLECTION_NAME):
    client = qdrant_client()
    count_result = client.count(
        collection_name=collection_name,
        count_filter=qdrant_query_conditions(document, collection_name=collection_name),
    )
    return count_result.count > 0


async def async_qdrant_aggregations(
    aggregation_keys: list,
    params: dict,
    collection_name: str = RESOURCES_COLLECTION_NAME,
) -> dict:
    """
    Compute facet aggregations from Qdrant for each requested field.
    Issues one concurrent facet query per aggregation key and returns results
    in the same shape used by the OpenSearch aggregation API:
    ``{"delivery": [{"key": "online", "doc_count": 24}, ...], ...}``
    Args:
        aggregation_keys: list of aggregation parameter names.
            Must be valid keys in the collection's param map
            (e.g. ``QDRANT_RESOURCE_PARAM_MAP``).
        params: dict of all search parameters, which are used to construct
            a Qdrant ``models.Filter`` for each facet query.
        collection_name: name of the Qdrant collection to query.
    Returns:
        dict mapping each requested aggregation name to a list of
        ``{"key": str, "doc_count": int}`` dicts sorted by
        ``doc_count`` descending.
    """
    if not aggregation_keys:
        return {}

    param_map = COLLECTION_PARAM_MAP.get(collection_name, QDRANT_RESOURCE_PARAM_MAP)
    client = async_qdrant_client()

    async def _get_facet(agg_key: str):
        qdrant_field = param_map.get(agg_key)
        if not qdrant_field:
            return agg_key, []

        filtered_params = {
            k: v for k, v in params.items() if k.partition("__")[0] != agg_key
        }
        facet_filter = qdrant_query_conditions(
            filtered_params, collection_name=collection_name
        )

        result = await client.facet(
            collection_name=collection_name,
            key=qdrant_field,
            facet_filter=facet_filter,
            limit=100,
        )
        hits = [
            {
                "key": str(hit.value).lower()
                if isinstance(hit.value, bool)
                else str(hit.value),
                "doc_count": hit.count,
            }
            for hit in result.hits
        ]
        hits.sort(key=lambda x: x["doc_count"], reverse=True)
        return agg_key, hits

    results = await asyncio.gather(*[_get_facet(key) for key in aggregation_keys])
    return dict(results)


def best_run_ids_for_resources(readable_ids):
    """
    Resolve the run_id values a resource_readable_id content-file query should
    be restricted to.

    Non-test_mode course -> its best run only.
    test_mode course     -> all its published runs (matches OpenSearch indexing).
    Course with no published run -> contributes nothing.

    Args:
        readable_ids (list[str]): resource readable_id values from the request

    Returns:
        list[str]: LearningResourceRun.run_id values to filter on
    """
    # Prefetch published runs into _published_runs so both best_run and the
    # test_mode branch resolve without a per-resource query (avoids an N+1).
    resources = LearningResource.objects.filter(
        readable_id__in=readable_ids
    ).prefetch_related(
        Prefetch(
            "runs",
            queryset=LearningResourceRun.objects.filter(published=True).order_by(
                "start_date", "enrollment_start", "id"
            ),
            to_attr="_published_runs",
        )
    )
    run_ids = []
    for resource in resources:
        if resource.test_mode:
            run_ids.extend(run.run_id for run in resource.published_runs)
        elif resource.best_run:
            run_ids.append(resource.best_run.run_id)
    return run_ids


def qdrant_query_conditions(params, collection_name=RESOURCES_COLLECTION_NAME):
    """
    Return a list of Qdrant FieldCondition objects based on params
    """

    qdrant_param_map = COLLECTION_PARAM_MAP.get(collection_name)
    if not params or not qdrant_param_map:
        return None
    must = []
    must_not = []

    for param, value in params.items():
        if value is None:
            continue

        base_param, _, lookup = param.partition("__")

        if base_param not in qdrant_param_map:
            continue

        qdrant_key = qdrant_param_map[base_param]

        if lookup == "isnull":
            condition = models.IsNullCondition(
                is_null=models.PayloadField(key=qdrant_key)
            )
            (must if value is True else must_not).append(condition)

        elif lookup == "isempty":
            key = qdrant_key.replace("[].name", "")
            condition = models.IsEmptyCondition(is_empty=models.PayloadField(key=key))
            (must if value is True else must_not).append(condition)

        elif isinstance(value, list):
            # Single-item bool lists must use MatchValue; all others use MatchAny
            match_condition = (
                models.MatchValue(value=value[0])
                if len(value) == 1 and isinstance(value[0], bool)
                else models.MatchAny(any=value)
            )
            must.append(models.FieldCondition(key=qdrant_key, match=match_condition))

        else:
            must.append(
                models.FieldCondition(
                    key=qdrant_key, match=models.MatchValue(value=value)
                )
            )

    if must or must_not:
        return models.Filter(must=must, must_not=must_not)

    return None


def filter_existing_qdrant_points_by_ids(
    point_ids, collection_name=RESOURCES_COLLECTION_NAME
):
    """
    Return only points that dont exist in qdrant
    """
    client = qdrant_client()
    response = client.retrieve(
        collection_name=collection_name,
        ids=point_ids,
    )
    existing = [record.id for record in response]
    return [point_id for point_id in point_ids if point_id not in existing]


def filter_existing_qdrant_points(
    values,
    lookup_field="readable_id",
    collection_name=RESOURCES_COLLECTION_NAME,
):
    """
    Return only values that dont exist in qdrant
    """
    client = qdrant_client()
    results = client.scroll(
        collection_name=collection_name,
        scroll_filter=models.Filter(
            must=models.FieldCondition(
                key=lookup_field, match=models.MatchAny(any=values)
            )
        ),
    )
    next_page_offset = results[1]
    existing_values = [point.payload[lookup_field] for point in results[0]]
    # go page by page to fetch all existing readable ids
    while next_page_offset:
        results = client.scroll(
            collection_name=collection_name,
            scroll_filter=models.Filter(
                must=models.FieldCondition(
                    key=lookup_field, match=models.MatchAny(any=values)
                )
            ),
            offset=next_page_offset,
        )
        existing_values.extend([point.payload[lookup_field] for point in results[0]])
        next_page_offset = results[1]
    return [value for value in values if value not in existing_values]


def remove_qdrant_records(ids, resource_type):
    if resource_type != CONTENT_FILE_TYPE:
        serialized_documents = serialize_bulk_learning_resources(ids)
        collection_name = RESOURCES_COLLECTION_NAME
        lookup_keys = ["readable_id", "platform"]
    else:
        serialized_documents = serialize_bulk_content_files(ids)
        collection_name = CONTENT_FILES_COLLECTION_NAME
        lookup_keys = ["platform", "run_readable_id", "resource_readable_id", "key"]
    for doc in serialized_documents:
        params = {}
        for key in lookup_keys:
            if key in doc:
                value = doc[key]
                if key == "platform" and isinstance(value, dict):
                    value = value.get("code")
                if value is not None:
                    params[key] = value
        if params:
            remove_points_matching_params(params, collection_name=collection_name)


def remove_points_matching_params(
    params,
    collection_name=RESOURCES_COLLECTION_NAME,
):
    """
    Delete points from Qdrant matching the provided params
    """
    client = qdrant_client()
    qdrant_conditions = qdrant_query_conditions(params, collection_name=collection_name)
    if qdrant_conditions:
        """
        Make sure the conditions have at least one
        condition otherwise all records are dropped
        """
        client.delete(
            collection_name=collection_name,
            points_selector=models.FilterSelector(
                filter=qdrant_conditions,
            ),
            wait=False,
        )


def retrieve_points_matching_params(
    params,
    collection_name=RESOURCES_COLLECTION_NAME,
    *,
    with_vectors=False,
):
    """
    Retrieve points from Qdrant matching params and yield them one by one.
    """
    client = qdrant_client()
    search_filter = qdrant_query_conditions(params, collection_name=collection_name)
    if not search_filter:
        return

    next_page_offset = None

    while True:
        results = client.scroll(
            collection_name=collection_name,
            scroll_filter=search_filter,
            offset=next_page_offset,
            with_vectors=with_vectors,
        )
        points, next_page_offset = results

        yield from points

        if not next_page_offset:
            break


def custom_score_formula(collection_name: str) -> list[models.MultExpression]:
    """
    Boost scores based on params defined in VECTOR_SEARCH_SCORE_BOOST
    """
    score_params = VECTOR_SEARCH_SCORE_BOOST.get(collection_name)
    score_expressions = []
    if score_params:
        for score_param in score_params:
            amount = score_param.get("boost", 0)
            conditions = qdrant_query_conditions(
                score_param.get("params"), collection_name=collection_name
            )
            if conditions is None:
                continue
            score_expressions.append(
                models.MultExpression(
                    mult=[
                        amount,
                        conditions,
                        # add a decay based on score to normalize
                        models.GaussDecayExpression(
                            gauss_decay=models.DecayParamsExpression(
                                x="$score",  # decay over the relevance score itself
                                target=0.4,  # full boost at this target
                                scale=0.2,
                                midpoint=0.2,
                            )
                        ),
                    ]
                )
            )
    return score_expressions
