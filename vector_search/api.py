from hashlib import md5

import requests

from learning_resources.etl.constants import ETLSource
from learning_resources.models import LearningResource
from learning_resources_search.serializers import serialize_learning_resource_for_update
from vector_search.constants import (
    CONTENT_FILES_COLLECTION_NAME,
)
from vector_search.encoders.utils import dense_encoder
from vector_search.utils import (
    chunk_html_documents,
    chunk_json_documents,
    chunk_text_documents,
    create_qdrant_collections,
    embeddings_for_documents,
    points_generator,
    qdrant_client,
    vector_point_id,
)


def external_content_chunks(serialized_resource, url):
    encoder = dense_encoder()
    response = requests.get(url, timeout=60)
    content_type = response.headers.get("Content-Type", "text/html")
    if content_type == "text/html":
        split_docs = chunk_html_documents([response.text], [serialized_resource])
    elif content_type == "application/json":
        split_docs = chunk_json_documents([response.json()], [serialized_resource])
    else:
        split_docs = chunk_text_documents(
            encoder, [response.text], [serialized_resource]
        )
    return split_docs


def _metadata_for_documents(split_docs):
    return [
        {
            "resource_point_id": str(vector_point_id(d.metadata["readable_id"])),
            "chunk_number": chunk_id,
            "chunk_content": d.page_content,
            "resource_readable_id": d.metadata["readable_id"],
            **{
                key: d.metadata[key]
                for key in ["offered_by", "platform"]
                if key in d.metadata
            },
        }
        for chunk_id, d in enumerate(split_docs)
        if d.page_content
    ]


def external_urls_for_resource(resource):
    if resource.offered_by.code in [ETLSource.mitpe.value, ETLSource.see.value]:
        return [resource.url]
    return []


def embed_external_content_for_resource(resource_id):
    client = qdrant_client()
    encoder = dense_encoder()
    vector_name = encoder.model_short_name()
    create_qdrant_collections(force_recreate=False)
    resource = LearningResource.objects.for_search_serialization().get(id=resource_id)
    external_urls = external_urls_for_resource(resource)
    serialized = serialize_learning_resource_for_update(resource)

    for url in external_urls:
        url_hash = md5(url.encode()).hexdigest()  # noqa: S324
        split_docs = external_content_chunks(serialized, url)
        split_texts = [d.page_content for d in split_docs if d.page_content]
        metadata = _metadata_for_documents(split_docs)
        embeddings = embeddings_for_documents(split_texts)

        ids = [
            vector_point_id(
                f"{serialized['readable_id']}.{url_hash}.{md['chunk_number']}"
            )
            for md in metadata
        ]
        points = points_generator(ids, metadata, embeddings, vector_name)
        if points:
            client.upload_points(
                CONTENT_FILES_COLLECTION_NAME, points=points, wait=False
            )
