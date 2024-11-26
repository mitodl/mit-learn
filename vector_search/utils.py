import uuid

from django.conf import settings
from qdrant_client import QdrantClient, models

from learning_resources.models import LearningResource
from learning_resources_search.constants import CONTENT_FILE_TYPE
from learning_resources_search.serializers import (
    serialize_bulk_content_files,
    serialize_bulk_learning_resources,
)


def qdrant_client():
    return QdrantClient(
        url=settings.QDRANT_HOST,
        api_key=settings.QDRANT_API_KEY,
        grpc_port=6334,
        prefer_grpc=True,
    )


def create_qdrand_collections(force_recreate):
    client = qdrant_client()
    resources_collection_name = f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources"
    content_files_collection_name = (
        f"{settings.QDRANT_BASE_COLLECTION_NAME}.content_files"
    )
    if (
        not client.collection_exists(collection_name=resources_collection_name)
        or force_recreate
    ):
        client.delete_collection(resources_collection_name)
        client.recreate_collection(
            collection_name=resources_collection_name,
            on_disk_payload=True,
            vectors_config=client.get_fastembed_vector_params(),
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
            vectors_config=client.get_fastembed_vector_params(),
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
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, readable_id))


def embed_learning_resources(ids, resource_type):
    # update embeddings
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
    client.add(
        collection_name=collection_name,
        ids=ids,
        documents=docs,
        metadata=metadata,
    )


def vector_search(
    query_string: str,
    limit: int = 10,
    offset: int = 10,
):
    if query_string:
        client = qdrant_client()

        search_result = client.query(
            collection_name=f"{settings.QDRANT_BASE_COLLECTION_NAME}.resources",
            query_text=query_string,
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
        # Select and return metadata
        hits = [
            {
                "id": hit.metadata["id"],
                "readable_id": hit.metadata["readable_id"],
                "resource_type": hit.metadata["resource_type"],
                "title": hit.metadata["title"],
                "description": hit.metadata["description"],
                "platform": hit.metadata["platform"],
            }
            for hit in search_result
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
