from django.conf import settings
from django.urls import reverse

from learning_resources.factories import (
    LearningResourceFactory,
)
from learning_resources.models import LearningResource


def test_vector_search_returns_all_resources_for_empty_query(mocker, client):
    """Test vector search endpoint returns all resources when 'q' is empty"""
    settings.QDRANT_ENCODER = "vector_search.encoders.dummy.DummyEmbedEncoder"
    LearningResourceFactory.create_batch(5)
    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mock_qdrant.query.return_value = []
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    params = {"q": "", "limit": LearningResource.objects.count() + 10}
    resp = client.get(
        reverse("vector_search:v0:learning_resources_vector_search"), data=params
    )
    results = resp.json()["results"]
    assert len(results) == LearningResource.objects.count()
    params = {"q": "test"}
    resp = client.get(
        reverse("vector_search:v0:learning_resources_vector_search"), data=params
    )
    results = resp.json()["results"]
    assert len(results) == 0
