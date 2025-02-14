import datetime
import logging
import uuid

from django.conf import settings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_experimental.text_splitter import SemanticChunker
from qdrant_client import QdrantClient, models

from learning_resources.models import LearningResource
from learning_resources.serializers import LearningResourceSerializer
from learning_resources_search.constants import CONTENT_FILE_TYPE
from learning_resources_search.serializers import (
    serialize_bulk_content_files,
    serialize_bulk_learning_resources,
)
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

encoder = dense_encoder()


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
        point_vector: dict[str, models.Vector] = {vector_name: vector}
        yield models.PointStruct(id=idx, payload=payload, vector=point_vector)


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
                f"{encoder.model_short_name()}_content": models.VectorParams(
                    size=encoder.dim(),
                    distance=models.Distance.COSINE,
                    multivector_config=models.MultiVectorConfig(
                        comparator=models.MultiVectorComparator.MAX_SIM
                    ),
                ),
            },
            sparse_vectors_config=client.get_fastembed_sparse_vector_params(),
            optimizers_config=models.OptimizersConfigDiff(default_segment_number=2),
            quantization_config=models.ScalarQuantization(
                scalar=models.ScalarQuantizationConfig(
                    type=models.ScalarType.INT8,
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
            sparse_vectors_config=client.get_fastembed_sparse_vector_params(),
            optimizers_config=models.OptimizersConfigDiff(default_segment_number=2),
            quantization_config=models.ScalarQuantization(
                scalar=models.ScalarQuantizationConfig(
                    type=models.ScalarType.INT8,
                    always_ram=True,
                ),
            ),
        )
    if force_recreate:
        create_qdrant_indexes()


def create_qdrant_indexes():
    client = qdrant_client()
    for index_field in QDRANT_LEARNING_RESOURCE_INDEXES:
        client.create_payload_index(
            collection_name=RESOURCES_COLLECTION_NAME,
            field_name=index_field,
            field_schema=QDRANT_LEARNING_RESOURCE_INDEXES[index_field],
        )
    for index_field in QDRANT_CONTENT_FILE_INDEXES:
        client.create_payload_index(
            collection_name=CONTENT_FILES_COLLECTION_NAME,
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


def _process_resource_embeddings(serialized_resources):
    docs = []
    metadata = []
    ids = []

    vector_name = encoder.model_short_name()
    for doc in serialized_resources:
        vector_point_key = doc["readable_id"]
        metadata.append(doc)
        ids.append(vector_point_id(vector_point_key))
        docs.append(
            f"{doc.get('title')} {doc.get('description')} {doc.get('full_description')}"
        )
    if len(docs) > 0:
        embeddings = encoder.embed_documents(docs)
        return points_generator(ids, metadata, embeddings, vector_name)
    return None


def generate_metadata_document(serialized_resource):
    """
    Generate a plaint-text info document to embed in the contentfile collection
    """
    title = serialized_resource.get("title", "Unknown Course")
    description = serialized_resource.get("description", "No description available.")
    offered_by = serialized_resource.get("offered_by", {}).get(
        "name", "Unknown Institution"
    )
    price = (
        f"${serialized_resource['prices'][0]}"
        if serialized_resource.get("prices")
        else "Free"
    )
    certification = serialized_resource.get("certification_type", {}).get(
        "name", "No certification"
    )
    topics = (
        ", ".join(topic["name"] for topic in serialized_resource.get("topics", []))
        or "Not specified"
    )
    # process course runs
    runs = []
    for run in serialized_resource.get("runs", []):
        start_date = run.get("start_date")
        formatted_date = (
            datetime.datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%SZ")
            .replace(tzinfo=datetime.UTC)
            .strftime("%B %d, %Y")
            if start_date
            else "Unknown start date"
        )
        location = run.get("location") or "Online"
        duration = run.get("duration", "Unknown duration")
        delivery_modes = (
            ", ".join(delivery["name"] for delivery in run.get("delivery", []))
            or "Not specified"
        )
        instructors = ", ".join(
            instructor["full_name"]
            for instructor in run.get("instructors", [])
            if "full_name" in instructor
        )
        instructors = instructors if instructors else "Not specified"
        runs.append(
            f" - Start Date: {formatted_date}, Location: {location}, "
            f"Duration: {duration}, Format: {delivery_modes},"
            f" Instructors: {instructors}"
        )
    runs_text = "\n".join(runs) if runs else "No upcoming runs available."
    # Extract languages
    languages = []
    for run in serialized_resource.get("runs", []):
        if run.get("languages"):
            languages.extend(run["languages"])
    unique_languages = ", ".join(set(languages)) if languages else "Not specified"
    # Extract levels
    levels = []
    for run in serialized_resource.get("runs", []):
        if run.get("level"):
            levels.extend(lvl["name"] for lvl in run["level"])
    unique_levels = ", ".join(set(levels)) if levels else "Not specified"
    display_info = {
        "Course Title": title,
        "Description": description,
        "Offered By": offered_by,
        "Price": price,
        "Certification": certification,
        "Topics": topics,
        "Level": unique_levels,
        "Languages": unique_languages,
        "Course Runs": runs_text,
    }
    rendered_info = "\n".join(
        [f"### {section}:\n{display_info[section]}" for section in display_info]
    )
    return f"# Course Details\n{rendered_info}"


def _embed_course_metadata_as_contentfile(serialized_resources):
    client = qdrant_client()
    vector_name = encoder.model_short_name()
    metadata = []
    ids = []
    docs = []
    for doc in serialized_resources:
        readable_id = doc["readable_id"]
        resource_vector_point_id = str(vector_point_id(readable_id))
        ids.append(resource_vector_point_id)
        course_info_document = generate_metadata_document(doc)
        metadata.append(
            {
                "resource_point_id": resource_vector_point_id,
                "resource_readable_id": readable_id,
                "chunk_number": 0,
                "chunk_content": course_info_document,
                **{
                    key: doc[key]
                    for key in [
                        "platform",
                        "offered_by",
                    ]
                },
            }
        )
        docs.extend(course_info_document)
    if len(docs) > 0:
        embeddings = encoder.embed_documents(docs)
        points = points_generator(ids, metadata, embeddings, vector_name)
        client.upload_points(CONTENT_FILES_COLLECTION_NAME, points=points, wait=False)


def _process_content_embeddings(serialized_content):
    embeddings = []
    metadata = []
    ids = []
    resource_points = []
    client = qdrant_client()
    vector_name = encoder.model_short_name()
    for doc in serialized_content:
        if not doc.get("content"):
            continue
        split_docs = _chunk_documents(encoder, [doc.get("content")], [doc])
        split_texts = [d.page_content for d in split_docs if d.page_content]
        resource_vector_point_id = vector_point_id(doc["resource_readable_id"])
        split_metadatas = [
            {
                "resource_point_id": str(resource_vector_point_id),
                "chunk_number": chunk_id,
                "chunk_content": d.page_content,
                **{
                    key: d.metadata[key]
                    for key in [
                        "run_title",
                        "platform",
                        "offered_by",
                        "run_readable_id",
                        "resource_readable_id",
                        "content_type",
                        "file_extension",
                        "content_feature_type",
                        "course_number",
                        "file_type",
                        "description",
                        "key",
                        "url",
                    ]
                },
            }
            for chunk_id, d in enumerate(split_docs)
            if d.page_content
        ]

        split_ids = [
            vector_point_id(
                f"{doc['resource_readable_id']}.{doc['run_readable_id']}.{doc['key']}.{md['chunk_number']}"
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
        if len(split_embeddings) > 0:
            resource_points.append(
                models.PointVectors(
                    id=resource_vector_point_id,
                    vector={f"{vector_name}_content": split_embeddings},
                )
            )
        embeddings.extend(split_embeddings)
        metadata.extend(split_metadatas)
        ids.extend(split_ids)
    if len(resource_points) > 0:
        try:
            # sometimes we can't update the multi-vector if max size is exceeded

            client.update_vectors(
                collection_name=RESOURCES_COLLECTION_NAME,
                points=resource_points,
            )
        except Exception as e:  # noqa: BLE001
            msg = f"Exceeded multi-vector max size: {e}"
            logger.warning(msg)
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
        _embed_course_metadata_as_contentfile(serialized_resources)
        points = _process_resource_embeddings(serialized_resources)

    else:
        serialized_resources = list(serialize_bulk_content_files(ids))
        collection_name = CONTENT_FILES_COLLECTION_NAME
        points = [
            (
                vector_point_id(
                    f"{doc['resource_readable_id']}.{doc['run_readable_id']}.{doc['key']}.0"
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
        client.upload_points(collection_name, points=points, wait=False)


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
    return [hit.payload for hit in search_result]


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

    qdrant_conditions = qdrant_query_conditions(
        params, collection_name=search_collection
    )

    search_filter = models.Filter(
        must=[
            *qdrant_conditions,
        ]
    )
    if query_string:
        search_result = client.query_points(
            collection_name=search_collection,
            using=encoder.model_short_name(),
            query=encoder.embed_query(query_string),
            query_filter=search_filter,
            limit=limit,
            offset=offset,
        ).points
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
