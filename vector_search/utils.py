import uuid

from django.conf import settings
from qdrant_client import QdrantClient, models

from learning_resources.models import LearningResource
from learning_resources_search.constants import CONTENT_FILE_TYPE
from learning_resources_search.serializers import (
    serialize_bulk_content_files,
    serialize_bulk_learning_resources,
)
from vector_search.encoders.utils import dense_encoder


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
                )
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
                )
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
    if resource_type == CONTENT_FILE_TYPE:
        serialized_resources = serialize_bulk_content_files(ids)
    else:
        serialized_resources = serialize_bulk_learning_resources(ids)
    create_qdrand_collections(force_recreate=False)
    if resource_type != CONTENT_FILE_TYPE:
        collection_name = resources_collection_name
    else:
        collection_name = content_files_collection_name
    docs = []
    metadata = []
    ids = []
    for doc in serialized_resources:
        docs.append(
            f'{doc.get("title")} {doc.get("description")} '
            f'{doc.get("full_description")} {doc.get("content")}'
        )
        metadata.append(doc)
        if resource_type != CONTENT_FILE_TYPE:
            vector_point_key = doc["readable_id"]
        else:
            vector_point_key = (
                f"{doc['key']}.{doc['run_readable_id']}.{doc['resource_readable_id']}"
            )
        ids.append(vector_point_id(vector_point_key))
    encoder = dense_encoder()
    embeddings = encoder.encode_batch(docs)
    vector_name = encoder.model_short_name()
    points = points_generator(ids, metadata, embeddings, vector_name)
    client.upload_points(collection_name, points=points, wait=False)


def vector_search(
    query_string: str,
    limit: int = 10,
    offset: int = 10,
):
    """
    Perform a vector search given a query string

    Args:
        query_string (str): Query string to search
        limit (int): Max number of results to return
        offset (int): Offset to start from
    Returns:
        dict:
            Response dict containing "hits" with search results
            and "total" with total count
    """
    if query_string:
        client = qdrant_client()
        encoder = dense_encoder()
        search_result = client.query_points(
            collection_name=f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources",
            using=encoder.model_short_name(),
            query=encoder.encode(query_string),
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="published", match=models.MatchValue(value=True)
                    )
                ]
            ),
            limit=limit,
            offset=offset,
        )
        hits = [
            {
                "id": hit.payload["id"],
                "readable_id": hit.payload["readable_id"],
                "resource_type": hit.payload["resource_type"],
                "title": hit.payload["title"],
                "description": hit.payload["description"],
                "platform": hit.payload["platform"],
            }
            for hit in search_result.points
        ]
    else:
        results = serialize_bulk_learning_resources(
            LearningResource.objects.all()[offset : offset + limit].values_list(
                "id", flat=True
            )
        )

        hits = [
            {
                "id": resource["id"],
                "readable_id": resource["readable_id"],
                "resource_type": resource["resource_type"],
                "title": resource["title"],
                "description": resource["description"],
                "platform": resource["platform"],
            }
            for resource in results
        ]
    return {"hits": hits, "total": {"value": 10000}}


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
    existing_readable_ids = [point.payload["readable_id"] for point in results[0]]
    return LearningResource.objects.filter(
        readable_id__in=[
            readable_id
            for readable_id in readable_ids
            if readable_id not in existing_readable_ids
        ]
    )
