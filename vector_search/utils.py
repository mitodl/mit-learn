import gc
import logging
import uuid
from functools import cache

from django.conf import settings
from django.db.models import Q
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_experimental.text_splitter import SemanticChunker
from qdrant_client import QdrantClient, models

from learning_resources.content_summarizer import ContentSummarizer
from learning_resources.models import (
    ContentFile,
    LearningResource,
    LearningResourceTopic,
)
from learning_resources.serializers import (
    ContentFileSerializer,
    LearningResourceMetadataDisplaySerializer,
    LearningResourceSerializer,
)
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
    LEARNING_RESOURCE_TYPES,
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
    QDRANT_TOPIC_INDEXES,
    QDRANT_TOPICS_PARAM_MAP,
    RESOURCES_COLLECTION_NAME,
    TOPICS_COLLECTION_NAME,
)
from vector_search.encoders.utils import dense_encoder

logger = logging.getLogger(__name__)


@cache
def qdrant_client():
    return QdrantClient(
        url=settings.QDRANT_HOST,
        api_key=settings.QDRANT_API_KEY,
        grpc_port=6334,
        prefer_grpc=True,
        timeout=settings.QDRANT_CLIENT_TIMEOUT,
    )


def points_generator(
    ids,
    metadata,
    encoded_docs,
    vector_name,
):
    """
    Get a generator for embedding points to store in Qdrant

    Args:
        ids (list): list of unique point ids
        metadata (list): list of metadata dictionaries
        encoded_docs (list): list of vectorized documents
        vector_name (str): name of the vector in qdrant
    Returns:
        generator:
            A generator of PointStruct objects
    """
    if ids is None:
        ids = iter(lambda: uuid.uuid4().hex, None)
    if metadata is None:
        metadata = iter(dict, None)
    for idx, meta, vector in zip(ids, metadata, encoded_docs):
        payload = meta
        point_data = {"id": idx, "payload": payload}
        if any(vector):
            point_vector: dict[str, models.Vector] = {vector_name: vector}
            point_data["vector"] = point_vector
        yield models.PointStruct(**point_data)


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


def create_qdrant_collection(collection_name, force_recreate):
    """
    Create or recreate a QDrant collection
    """
    client = qdrant_client()
    encoder = dense_encoder()
    # True if either of the collections were recreated
    if not client.collection_exists(collection_name=collection_name) or force_recreate:
        client.delete_collection(collection_name)
        client.recreate_collection(
            collection_name=collection_name,
            on_disk_payload=True,
            vectors_config={
                encoder.model_short_name(): models.VectorParams(
                    size=encoder.dim(), distance=models.Distance.COSINE
                ),
            },
            replication_factor=2,
            shard_number=6,
            strict_mode_config=models.StrictModeConfig(
                enabled=True,
                unindexed_filtering_retrieve=False,
                unindexed_filtering_update=False,
            ),
            sparse_vectors_config=client.get_fastembed_sparse_vector_params(),
            optimizers_config=models.OptimizersConfigDiff(default_segment_number=2),
            quantization_config=models.BinaryQuantization(
                binary=models.BinaryQuantizationConfig(
                    always_ram=True,
                ),
            ),
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
        for index_field in indexes:
            collection = client.get_collection(collection_name=collection_name)
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
        existing = vector_search(
            query_string="",
            params={},
            search_collection=TOPICS_COLLECTION_NAME,
            limit=indexed_count,
        )
        indexed_topic_names = {hit["name"] for hit in existing["hits"]}
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
        encoder = dense_encoder()
        embeddings = encoder.embed_documents(docs)
        vector_name = encoder.model_short_name()
        points = points_generator(ids, metadata, embeddings, vector_name)
        client.upload_points(TOPICS_COLLECTION_NAME, points=points, wait=False)


@cache
def _get_text_splitter(**kwargs):
    if settings.LITELLM_TOKEN_ENCODING_NAME:
        kwargs["encoding_name"] = settings.LITELLM_TOKEN_ENCODING_NAME
        return RecursiveCharacterTextSplitter.from_tiktoken_encoder(**kwargs)
    return RecursiveCharacterTextSplitter(**kwargs)


def _chunk_documents(encoder, texts, metadatas):
    # chunk the documents. use semantic chunking if enabled
    chunk_params = {
        "chunk_overlap": settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP,
    }

    if settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE:
        chunk_params["chunk_size"] = settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE

    recursive_splitter = _get_text_splitter(**chunk_params)

    if settings.CONTENT_FILE_EMBEDDING_SEMANTIC_CHUNKING_ENABLED:
        """
        If semantic chunking is enabled,
        use the semantic chunker then recursive splitter
        to stay within chunk size limits
        """
        return recursive_splitter.split_documents(
            SemanticChunker(
                encoder, **settings.SEMANTIC_CHUNKING_CONFIG
            ).create_documents(texts=texts, metadatas=metadatas)
        )
    return recursive_splitter.create_documents(texts=texts, metadatas=metadatas)


def _learning_resource_embedding_context(document):
    """
    Get the embedding context for a learning resource
    """
    return (
        f"{document.get('title')} "
        f"{document.get('description')} {document.get('full_description')}"
    )


def _content_file_embedding_context(document):
    """
    Get the embedding context for a content file
    """
    return document.get("content", "")


def _process_resource_embeddings(serialized_resources):
    docs = []
    metadata = []
    ids = []
    encoder = dense_encoder()
    vector_name = encoder.model_short_name()
    for doc in serialized_resources:
        if not should_generate_resource_embeddings(doc):
            update_learning_resource_payload(doc)
            continue
        metadata.append(doc)
        ids.append(vector_point_id(vector_point_key(doc)))
        docs.append(_learning_resource_embedding_context(doc))
    if len(docs) > 0:
        embeddings = encoder.embed_documents(docs)
        return points_generator(ids, metadata, embeddings, vector_name)
    return None


def update_learning_resource_payload(serialized_document):
    points = [vector_point_id(vector_point_key(serialized_document))]
    _set_payload(
        points,
        serialized_document,
        param_map=QDRANT_RESOURCE_PARAM_MAP,
        collection_name=RESOURCES_COLLECTION_NAME,
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


def should_generate_content_embeddings(
    serialized_document: dict, point_id: str | None = None
) -> bool:
    """
    Determine if we should generate embeddings for a content file
    """
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
        qdrant_checksum = response[0].payload.get("checksum")
        if qdrant_checksum == serialized_document["checksum"]:
            return False
    return True


def _embed_course_metadata_as_contentfile(serialized_resources):
    """
    Embed general course info as a document in the contentfile collection
    """
    client = qdrant_client()
    encoder = dense_encoder()
    vector_name = encoder.model_short_name()
    metadata = []
    ids = []
    docs = []
    for doc in serialized_resources:
        resource_vector_point_id = str(vector_point_id(vector_point_key(doc)))
        serializer = LearningResourceMetadataDisplaySerializer(doc)
        serialized_document = serializer.render_document()
        checksum = checksum_for_content(str(serialized_document))
        key = f"{doc['readable_id']}.course_metadata"
        serialized_document["checksum"] = checksum
        serialized_document["key"] = key
        document_point_id = vector_point_id(
            vector_point_key(serialized_document, document_type="course_information")
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
                    serialized_document,
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
        embeddings = encoder.embed_documents(docs)
        points = points_generator(ids, metadata, embeddings, vector_name)
        client.upload_points(CONTENT_FILES_COLLECTION_NAME, points=points, wait=False)


def _generate_content_file_points(serialized_content):
    """
    Chunk and embed content file documents, yielding PointStructs
    """
    encoder = dense_encoder()
    vector_name = encoder.model_short_name()

    """
    Break up requests according to chunk size to stay under openai limits
    300,000 tokens per request
    max array size: 2048
    see: https://platform.openai.com/docs/guides/rate-limits
    """
    request_chunk_size = int(
        300000 / settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE
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
        }
        if doc.get("run_readable_id"):
            remove_params["run_readable_id"] = doc["run_readable_id"]

        remove_points_matching_params(
            remove_params, collection_name=CONTENT_FILES_COLLECTION_NAME
        )

        split_docs = _chunk_documents(encoder, [embedding_context], [doc])

        # Identify non-empty chunks and their original indices
        valid_chunks = [(i, d) for i, d in enumerate(split_docs) if d.page_content]

        if not valid_chunks:
            continue

        split_texts = [d.page_content for _, d in valid_chunks]
        resource_vector_point_id = vector_point_id(vector_point_key(doc))

        for i in range(0, len(split_texts), request_chunk_size):
            chunk_texts = split_texts[i : i + request_chunk_size]
            chunk_embeddings = encoder.embed_documents(chunk_texts)

            for j, embedding in enumerate(chunk_embeddings):
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
                    id=point_id, payload=metadata, vector={vector_name: embedding}
                )
            # Explicitly free memory for large chunks
            del chunk_texts
            del chunk_embeddings
            gc.collect()


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
    create_qdrant_collections(force_recreate=False)
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
        serialized_resources = serialize_bulk_content_files(ids)

        # populated/modified by reference in process_batch
        summary_content_ids = []

        # Batching parameters
        current_batch_docs = []
        current_batch_size = 0

        collection_name = CONTENT_FILES_COLLECTION_NAME

        def process_batch(docs_batch, summaries_list):
            """Process a batch of documents"""
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
                    summaries_list.append(resource["id"])

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
                process_batch(current_batch_docs, summary_content_ids)
                current_batch_docs = []
                current_batch_size = 0
                gc.collect()

        # Process remaining
        if current_batch_docs:
            process_batch(current_batch_docs, summary_content_ids)
            current_batch_docs = []
            gc.collect()

        if summary_content_ids:
            ContentSummarizer().summarize_content_files_by_ids(
                summary_content_ids, overwrite
            )

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
    hits = [hit.payload["readable_id"] for hit in search_result]
    """
     Always lookup learning resources by readable_id for portability
     in case we load points from external systems
     """
    return LearningResourceSerializer(
        LearningResource.objects.for_serialization().filter(readable_id__in=hits),
        many=True,
    ).data


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
    if document_type == "learning_resource":
        return f"{serialized_document['readable_id']}"
    elif document_type == "course_information":
        return f"{serialized_document['readable_id']}.course_information.{chunk_number}"
    elif document_type == "content_file":
        return (
            f"{serialized_document['resource_readable_id']}."
            f"{serialized_document.get('run_readable_id', '')}."
            f"{serialized_document['key']}."
            f"{chunk_number}"
        )
    else:
        msg = "Invalid document type for vector point key"
        raise ValueError(msg)


def vector_search(
    query_string: str,
    params: dict,
    limit: int = 10,
    offset: int = 10,
    search_collection=RESOURCES_COLLECTION_NAME,
):
    """
    Perform a vector search given a query string

    Args:
        query_string (str): Query string to search
        params (dict): Additional search filters
        limit (int): Max number of results to return
        offset (int): Offset to start from
        search_collection (str): name of the collection to search
    Returns:
        dict:
            Response dict containing "hits" with search results
            and "total" with total count
    """

    client = qdrant_client()
    encoder = dense_encoder()
    qdrant_conditions = qdrant_query_conditions(
        params, collection_name=search_collection
    )

    search_filter = models.Filter(
        must=[
            *qdrant_conditions,
        ]
    )
    if query_string:
        search_params = {
            "collection_name": search_collection,
            "using": encoder.model_short_name(),
            "query": encoder.embed_query(query_string),
            "query_filter": search_filter,
            "search_params": models.SearchParams(indexed_only=True),
            "limit": limit,
        }
        if "group_by" in params:
            search_params["group_by"] = params.get("group_by")
            search_params["group_size"] = params.get("group_size", 1)
            group_result = client.query_points_groups(**search_params)
            search_result = []
            for group in group_result.groups:
                payloads = [hit.payload for hit in group.hits]
                response_hit = _merge_dicts(payloads)
                chunks = [payload.get("chunk_content") for payload in payloads]
                response_hit["chunk_content"] = None
                response_hit["chunks"] = chunks
                response_row = {
                    "id": response_hit[search_params["group_by"]],
                    "payload": response_hit,
                    "vector": [],
                }
                search_result.append(models.PointStruct(**response_row))

        else:
            search_params["offset"] = offset
            search_result = client.query_points(**search_params).points
    else:
        search_result = client.scroll(
            collection_name=search_collection,
            scroll_filter=search_filter,
            limit=limit,
            offset=offset,
        )[0]

    if search_collection == RESOURCES_COLLECTION_NAME:
        hits = _resource_vector_hits(search_result)
    else:
        hits = _content_file_vector_hits(search_result)
    count_result = client.count(
        collection_name=search_collection,
        count_filter=search_filter,
        exact=True,
    )

    return {
        "hits": hits,
        "total": {"value": count_result.count},
    }


def document_exists(document, collection_name=RESOURCES_COLLECTION_NAME):
    client = qdrant_client()
    count_result = client.count(
        collection_name=collection_name,
        count_filter=models.Filter(
            must=qdrant_query_conditions(document, collection_name=collection_name)
        ),
    )
    return count_result.count > 0


def qdrant_query_conditions(params, collection_name=RESOURCES_COLLECTION_NAME):
    """
    Generate Qdrant query conditions from query params
    Args:
        params (dict): Query params
    Returns:
        FieldCondition[]:
            List of Qdrant FieldCondition objects
    """
    conditions = []
    if collection_name == RESOURCES_COLLECTION_NAME:
        QDRANT_PARAM_MAP = QDRANT_RESOURCE_PARAM_MAP
    elif collection_name == TOPICS_COLLECTION_NAME:
        QDRANT_PARAM_MAP = QDRANT_TOPICS_PARAM_MAP
    else:
        QDRANT_PARAM_MAP = QDRANT_CONTENT_FILE_PARAM_MAP
    if not params:
        return conditions
    for param in params:
        if param in QDRANT_PARAM_MAP and params[param] is not None:
            if type(params[param]) is list:
                """
                Account for array wrapped booleans which should only match value
                We can also use MatchValue for arrays with a single item
                """
                if len(params[param]) == 1 and type(params[param][0]) is bool:
                    match_condition = models.MatchValue(value=params[param][0])
                else:
                    match_condition = models.MatchAny(any=params[param])
            else:
                match_condition = models.MatchValue(value=params[param])
            conditions.append(
                models.FieldCondition(
                    key=QDRANT_PARAM_MAP[param], match=match_condition
                )
            )
    return conditions


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
        lookup_keys = ["readable_id"]
    else:
        serialized_documents = serialize_bulk_content_files(ids)
        collection_name = CONTENT_FILES_COLLECTION_NAME
        lookup_keys = ["run_readable_id", "resource_readable_id", "key"]
    for doc in serialized_documents:
        params = {}
        for key in lookup_keys:
            if key in doc:
                params[key] = doc[key]
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
                filter=models.Filter(
                    must=[
                        *qdrant_conditions,
                    ]
                )
            ),
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
    qdrant_conditions = qdrant_query_conditions(params, collection_name=collection_name)
    if not qdrant_conditions:
        return

    search_filter = models.Filter(must=qdrant_conditions)

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
