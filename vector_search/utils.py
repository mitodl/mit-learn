import uuid

from django.conf import settings
from langchain.text_splitter import RecursiveCharacterTextSplitter, TokenTextSplitter
from qdrant_client import QdrantClient, models

from learning_resources.models import LearningResource
from learning_resources.serializers import LearningResourceSerializer
from learning_resources_search.constants import CONTENT_FILE_TYPE
from learning_resources_search.serializers import (
    serialize_bulk_content_files,
    serialize_bulk_learning_resources,
)
from vector_search.encoders.utils import dense_encoder

QDRANT_PARAM_MAP = {
    "readable_id": "readable_id",
    "resource_type": "resource_type",
    "certification": "certification",
    "certification_type": "certification_type.code",
    "professional": "professional",
    "free": "free",
    "course_feature": "course_feature",
    "content_feature_type": "content_feature_type",
    "topic": "topics[].name",
    "ocw_topic": "ocw_topics",
    "level": "runs[].level.code",
    "department": "departments.department_id",
    "platform": "platform.code",
    "offered_by": "offered_by.code",
    "delivery": "delivery[].code",
    "resource_category": "resource_category",
}


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


def create_qdrand_collections(force_recreate):
    """
    Create or recreate QDrant collections

    Args:
        force_recreate (bool): Whether to recreate the collections
        even if they already exist
    """
    client = qdrant_client()
    resources_collection_name = f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources"
    content_files_collection_name = (
        f"{settings.QDRANT_BASE_COLLECTION_NAME}.content_files"
    )

    encoder = dense_encoder()
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


def _process_resource_embeddings(serialized_resources):
    docs = []
    metadata = []
    ids = []
    encoder = dense_encoder()
    vector_name = encoder.model_short_name()
    for doc in serialized_resources:
        vector_point_key = doc["readable_id"]
        metadata.append(doc)
        ids.append(vector_point_id(vector_point_key))
        docs.append(
            f'{doc.get("title")} {doc.get("description")} '
            f'{doc.get("full_description")} {doc.get("content")}'
        )
    embeddings = encoder.encode_batch(docs)
    return points_generator(ids, metadata, embeddings, vector_name)


def _get_text_splitter(encoder):
    """
    Get the text splitter to use based on the encoder
    """
    if hasattr(encoder, "token_encoding_name") and encoder.token_encoding_name:
        # leverage tiktoken to ensure we stay within token limits
        return TokenTextSplitter(encoding_name=encoder.token_encoding_name)
    else:
        # default for use with fastembed
        return RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=0)


def _process_content_embeddings(serialized_content):
    embeddings = []
    metadata = []
    ids = []
    resource_points = []
    client = qdrant_client()
    encoder = dense_encoder()
    vector_name = encoder.model_short_name()
    text_splitter = _get_text_splitter(encoder)
    for doc in serialized_content:
        if not doc.get("content"):
            continue
        split_docs = text_splitter.create_documents(
            texts=[doc.get("content")], metadatas=[doc]
        )
        split_texts = [d.page_content for d in split_docs]
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
                        "content_type",
                        "content_feature_type",
                        "course_number",
                        "file_type",
                        "description",
                        "key",
                        "run_title",
                        "_id",
                    ]
                },
            }
            for chunk_id, d in enumerate(split_docs)
        ]
        split_ids = [
            vector_point_id(
                f'{doc['resource_readable_id']}.{doc['run_readable_id']}.{doc['key']}.{md["chunk_number"]}'
            )
            for md in split_metadatas
        ]
        split_embeddings = list(encoder.encode_batch(split_texts))
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
        client.update_vectors(
            collection_name=f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources",
            points=resource_points,
        )
    return points_generator(ids, metadata, embeddings, vector_name)


def embed_learning_resources(ids, resource_type):
    """
    Embed learning resources

    Args:
        ids (list of int): Ids of learning resources to embed
        resource_type (str): Type of learning resource to embed
    """

    client = qdrant_client()
    resources_collection_name = f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources"
    content_files_collection_name = (
        f"{settings.QDRANT_BASE_COLLECTION_NAME}.content_files"
    )

    create_qdrand_collections(force_recreate=False)
    if resource_type != CONTENT_FILE_TYPE:
        serialized_resources = serialize_bulk_learning_resources(ids)
        collection_name = resources_collection_name
        points = _process_resource_embeddings(serialized_resources)
    else:
        serialized_resources = serialize_bulk_content_files(ids)
        collection_name = content_files_collection_name
        points = _process_content_embeddings(serialized_resources)

    client.upload_points(collection_name, points=points, wait=False)


def vector_search(
    query_string: str,
    params: dict,
    limit: int = 10,
    offset: int = 10,
):
    """
    Perform a vector search given a query string

    Args:
        query_string (str): Query string to search
        params (dict): Additional search filters
        limit (int): Max number of results to return
        offset (int): Offset to start from
    Returns:
        dict:
            Response dict containing "hits" with search results
            and "total" with total count
    """
    client = qdrant_client()
    qdrant_conditions = qdrant_query_conditions(params)
    search_filter = models.Filter(
        must=[
            *qdrant_conditions,
            models.FieldCondition(key="published", match=models.MatchValue(value=True)),
        ],
    )
    if query_string:
        encoder = dense_encoder()
        search_result = client.query_points(
            collection_name=f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources",
            using=encoder.model_short_name(),
            query=encoder.encode(query_string),
            query_filter=search_filter,
            limit=limit,
            offset=offset,
        ).points
    else:
        search_result = client.scroll(
            collection_name=f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources",
            scroll_filter=search_filter,
            limit=limit,
            offset=offset,
        )[0]
    hits = [hit.payload["readable_id"] for hit in search_result]
    count_result = client.count(
        collection_name=f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources",
        count_filter=search_filter,
        exact=True,
    )

    """
    Always lookup learning resources by readable_id for portability
    in case we load points from external systems
    """
    return {
        "hits": LearningResourceSerializer(
            LearningResource.objects.for_serialization().filter(readable_id__in=hits),
            many=True,
        ).data,
        "total": {"value": count_result.count},
    }


def qdrant_query_conditions(params):
    """
    Generate Qdrant query conditions from query params
    Args:
        params (dict): Query params
    Returns:
        FieldCondition[]:
            List of Qdrant FieldCondition objects
    """
    conditions = []
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


def filter_existing_qdrant_points(learning_resources):
    """
    Filter learning resources that already have embeddings
    Args:
        learning_resources (QuerySet): Learning resources to check
    Returns:
        Queryset of learning resources that do not have embeddings in Qdrant

    """
    readable_ids = [
        learning_resource.readable_id for learning_resource in learning_resources
    ]
    client = qdrant_client()
    results = client.scroll(
        collection_name=f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources",
        scroll_filter=models.Filter(
            must=models.FieldCondition(
                key="readable_id", match=models.MatchAny(any=readable_ids)
            )
        ),
    )
    next_page_offset = results[1]
    existing_readable_ids = [point.payload["readable_id"] for point in results[0]]
    # go page by page to fetch all existing readable ids
    while next_page_offset:
        results = client.scroll(
            collection_name=f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources",
            scroll_filter=models.Filter(
                must=models.FieldCondition(
                    key="readable_id", match=models.MatchAny(any=readable_ids)
                )
            ),
            offset=next_page_offset,
        )
        existing_readable_ids.extend(
            [point.payload["readable_id"] for point in results[0]]
        )
        next_page_offset = results[1]
    return LearningResource.objects.filter(
        readable_id__in=[
            readable_id
            for readable_id in readable_ids
            if readable_id not in existing_readable_ids
        ]
    )
