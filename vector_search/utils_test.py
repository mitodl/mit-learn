import pytest

from learning_resources.factories import ContentFileFactory, LearningResourceFactory
from learning_resources_search.serializers import serialize_bulk_content_files
from vector_search.utils import (
    embed_learning_resources,
    vector_point_id,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("content_type", ["learning_resource", "content_file"])
def test_vector_point_id_used_for_embed(mocker, content_type):
    # test the vector ids we generate for embedding resources and files
    if content_type == "learning_resource":
        resources = LearningResourceFactory.create_batch(5)
    else:
        resources = ContentFileFactory.create_batch(5)
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mock_qdrant.query.return_value = []
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )

    embed_learning_resources([resource.id for resource in resources], content_type)

    if content_type == "learning_resource":
        point_ids = [vector_point_id(resource.readable_id) for resource in resources]
    else:
        point_ids = [
            vector_point_id(
                f"{resource['key']}.{resource['run_readable_id']}.{resource['resource_readable_id']}"
            )
            for resource in serialize_bulk_content_files([r.id for r in resources])
        ]
    assert sorted(mock_qdrant.add.mock_calls[0].kwargs["ids"]) == sorted(point_ids)
