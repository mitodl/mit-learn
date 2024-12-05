import pytest
from qdrant_client.models import PointStruct

from learning_resources.factories import ContentFileFactory, LearningResourceFactory
from learning_resources_search.serializers import serialize_bulk_content_files
from vector_search.utils import (
    embed_learning_resources,
    filter_existing_qdrant_points,
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

    assert sorted(
        [p.id for p in mock_qdrant.upload_points.mock_calls[0].kwargs["points"]]
    ) == sorted(point_ids)


def test_filter_existing_qdrant_points(mocker):
    """
    Test that filter_existing_qdrant_points filters out
    resources that are already embedded in Qdrant
    """
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    resources = LearningResourceFactory.create_batch(10)
    already_embedded = resources[:3]
    mock_qdrant.scroll.return_value = [
        [
            PointStruct(
                id=resource.id,
                payload={"readable_id": resource.readable_id},
                vector=[0, 0, 0, 0],
            )
            for resource in already_embedded
        ],
    ]
    filtered_resources = filter_existing_qdrant_points(resources)
    assert sorted(filtered_resources.values_list("id", flat=True)) == sorted(
        [res.id for res in already_embedded]
    )
