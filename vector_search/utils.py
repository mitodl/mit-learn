import logging
import uuid
from typing import Optional

from django.conf import settings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_experimental.text_splitter import SemanticChunker
from qdrant_client import QdrantClient, models

from learning_resources.content_summarizer import ContentSummarizer
from learning_resources.models import ContentFile, LearningResource
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
    RESOURCES_COLLECTION_NAME,
)
from vector_search.encoders.utils import dense_encoder

logger = logging.getLogger(__name__)


def qdrant_client():
    return QdrantClient(
        url=settings.QDRANT_HOST,
        api_key=settings.QDRANT_API_KEY,
        grpc_port=6334,
        prefer_grpc=True,
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
    client = qdrant_client()
    resources_collection_name = RESOURCES_COLLECTION_NAME
    content_files_collection_name = CONTENT_FILES_COLLECTION_NAME
    encoder = dense_encoder()
    # True if either of the collections were recreated

    if (
        not client.collection_exists(collection_name=resources_collection_name)
        or force_recreate
    ):
        client.delete_collection(resources_collection_name)
        client.recreate_collection(
            collection_name=resources_collection_name,
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

    if (
        not client.collection_exists(collection_name=content_files_collection_name)
        or force_recreate
    ):
        client.delete_collection(content_files_collection_name)
        client.recreate_collection(
            collection_name=content_files_collection_name,
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
    update_qdrant_indexes()


def update_qdrant_indexes():
    """
    Create or update Qdrant indexes based on mapping in constants
    """
    client = qdrant_client()
    for index_field in QDRANT_LEARNING_RESOURCE_INDEXES:
        collection_name = RESOURCES_COLLECTION_NAME
        collection = client.get_collection(collection_name=collection_name)
        if index_field not in collection.payload_schema:
            client.create_payload_index(
                collection_name=collection_name,
                field_name=index_field,
                field_schema=QDRANT_LEARNING_RESOURCE_INDEXES[index_field],
            )
    for index_field in QDRANT_CONTENT_FILE_INDEXES:
        collection_name = CONTENT_FILES_COLLECTION_NAME
        collection = client.get_collection(collection_name=collection_name)
        if index_field not in collection.payload_schema:
            client.create_payload_index(
                collection_name=collection_name,
                field_name=index_field,
                field_schema=QDRANT_CONTENT_FILE_INDEXES[index_field],
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


def _chunk_documents(encoder, texts, metadatas):
    # chunk the documents. use semantic chunking if enabled
    chunk_params = {
        "chunk_overlap": settings.CONTENT_FILE_EMBEDDING_CHUNK_OVERLAP,
    }

    if settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE:
        chunk_params["chunk_size"] = settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE
    if settings.LITELLM_TOKEN_ENCODING_NAME:
        """
        If we have a specific model encoding
        we can use that to stay within token limits
        """
        chunk_params["encoding_name"] = settings.LITELLM_TOKEN_ENCODING_NAME
        recursive_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            **chunk_params
        )
    else:
        recursive_splitter = RecursiveCharacterTextSplitter(**chunk_params)

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
        vector_point_key = doc["readable_id"]
        metadata.append(doc)
        ids.append(vector_point_id(vector_point_key))
        docs.append(_learning_resource_embedding_context(doc))
    if len(docs) > 0:
        embeddings = encoder.embed_documents(docs)
        return points_generator(ids, metadata, embeddings, vector_name)
    return None


def update_learning_resource_payload(serialized_document):
    points = [vector_point_id(serialized_document["readable_id"])]
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
    client.set_payload(
        collection_name=collection_name,
        payload=payload,
        points=points,
    )


def should_generate_resource_embeddings(serialized_document):
    """
    Determine if we should generate embeddings for a learning resource
    """
    client = qdrant_client()
    point_id = vector_point_id(serialized_document["readable_id"])
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
    serialized_document: dict, point_id: Optional[str] = None
) -> bool:
    """
    Determine if we should generate embeddings for a content file
    """
    client = qdrant_client()
    if not point_id:
        # we just need metadata from the first chunk
        point_id = vector_point_id(
            f"{serialized_document['resource_readable_id']}."
            f"{serialized_document.get('run_readable_id', '')}."
            f"{serialized_document['key']}.0"
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
        readable_id = doc["readable_id"]
        resource_vector_point_id = str(vector_point_id(readable_id))
        serializer = LearningResourceMetadataDisplaySerializer(doc)
        serialized_document = serializer.render_document()
        checksum = checksum_for_content(str(serialized_document))
        key = f"{doc['readable_id']}.course_metadata"
        serialized_document["checksum"] = checksum
        serialized_document["key"] = key
        document_point_id = vector_point_id(
            f"{doc['readable_id']}.course_information.0"
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
                f"{doc['readable_id']}.course_information.{md['chunk_number']}"
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


def _process_content_embeddings(serialized_content):
    """
    Chunk and embed content file documents
    """
    embeddings = []
    metadata = []
    ids = []
    encoder = dense_encoder()
    vector_name = encoder.model_short_name()
    remove_docs = []
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
        remove_docs.append(doc["id"])
        split_docs = _chunk_documents(encoder, [embedding_context], [doc])
        split_texts = [d.page_content for d in split_docs if d.page_content]
        resource_vector_point_id = vector_point_id(doc["resource_readable_id"])
        split_metadatas = [
            {
                "resource_point_id": str(resource_vector_point_id),
                "chunk_number": chunk_id,
                "chunk_content": d.page_content,
                **{
                    key: d.metadata[key]
                    for key in QDRANT_CONTENT_FILE_PARAM_MAP
                    if key in d.metadata
                },
            }
            for chunk_id, d in enumerate(split_docs)
            if d.page_content
        ]

        split_ids = [
            vector_point_id(
                f"{doc['resource_readable_id']}."
                f"{doc.get('run_readable_id', '')}."
                f"{doc['key']}.{md['chunk_number']}"
            )
            for md in split_metadatas
        ]
        split_embeddings = []
        """
        Break up requests according to chunk size to stay under openai limits
        600,000 tokens per request
        max array size: 2048
        see: https://platform.openai.com/docs/guides/rate-limits
        """
        request_chunk_size = int(
            600000 / settings.CONTENT_FILE_EMBEDDING_CHUNK_SIZE_OVERRIDE
        )
        for i in range(0, len(split_texts), request_chunk_size):
            split_chunk = split_texts[i : i + request_chunk_size]
            split_embeddings.extend(list(encoder.embed_documents(split_chunk)))
        embeddings.extend(split_embeddings)
        metadata.extend(split_metadatas)
        ids.extend(split_ids)
    if remove_docs:
        remove_qdrant_records(remove_docs, CONTENT_FILE_TYPE)
    if ids:
        return points_generator(ids, metadata, embeddings, vector_name)
    return None


def embed_learning_resources(ids, resource_type, overwrite):
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
            (vector_point_id(serialized["readable_id"]), serialized)
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
        serialized_resources = list(serialize_bulk_content_files(ids))
        # TODO: Pass actual Ids when we want scheduled content file summarization  # noqa: FIX002, TD002, TD003 E501
        # Currently we only want to summarize content that either already has a summary
        # OR is in a course where atleast one other content file has a summary
        summary_content_ids = [
            resource["id"]
            for resource in serialized_resources
            if resource.get("summary")
            or resource.get("require_summaries")
            or ContentFile.objects.exclude(summary="")
            .filter(run__id=resource.get("run_id"))
            .exists()
        ]
        ContentSummarizer().summarize_content_files_by_ids(
            summary_content_ids, overwrite
        )

        collection_name = CONTENT_FILES_COLLECTION_NAME
        points = [
            (
                vector_point_id(
                    f"{doc['resource_readable_id']}."
                    f"{doc.get('run_readable_id', '')}."
                    f"{doc['key']}.0"
                ),
                doc,
            )
            for doc in serialized_resources
        ]
        if not overwrite:
            filtered_point_ids = filter_existing_qdrant_points_by_ids(
                [point[0] for point in points],
                collection_name=CONTENT_FILES_COLLECTION_NAME,
            )
            serialized_resources = [
                point[1] for point in points if point[0] in filtered_point_ids
            ]
        points = _process_content_embeddings(serialized_resources)
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
        )
        points, next_page_offset = results

        yield from points

        if not next_page_offset:
            break
