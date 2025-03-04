from hashlib import md5

import requests

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


def embed_external_content_for_resource(resource_id, url):
    client = qdrant_client()
    encoder = dense_encoder()
    vector_name = encoder.model_short_name()
    create_qdrant_collections(force_recreate=False)

    resource = LearningResource.objects.for_search_serialization().get(id=resource_id)
    serialized = serialize_learning_resource_for_update(resource)
    url_hash = md5(url.encode()).hexdigest()  # noqa: S324
    resource_vector_point_id = vector_point_id(serialized["readable_id"])

    response = requests.get(url, timeout=60)
    content_type = response.headers.get("Content-Type", "text/html")

    if content_type == "text/html":
        split_docs = chunk_html_documents([response.text], [serialized])
    elif content_type == "application/json":
        split_docs = chunk_json_documents([response.json()], [serialized])
    else:
        split_docs = chunk_text_documents(encoder, [response.text], [serialized])

    split_texts = [d.page_content for d in split_docs if d.page_content]

    metadata = [
        {
            "resource_point_id": str(resource_vector_point_id),
            "chunk_number": chunk_id,
            "chunk_content": d.page_content,
            "resource_readable_id": serialized["readable_id"],
            **{
                key: d.metadata[key]
                for key in ["offered_by", "platform"]
                if key in d.metadata
            },
        }
        for chunk_id, d in enumerate(split_docs)
        if d.page_content
    ]

    embeddings = embeddings_for_documents(split_texts, encoder)

    ids = [
        vector_point_id(f"{serialized['readable_id']}.{url_hash}.{md['chunk_number']}")
        for md in metadata
    ]

    points = points_generator(ids, metadata, embeddings, vector_name)
    if points:
        client.upload_points(CONTENT_FILES_COLLECTION_NAME, points=points, wait=False)
