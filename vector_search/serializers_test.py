import pytest

from vector_search.serializers import (
    LearningResourcesSearchFiltersSerializer,
    LearningResourcesVectorSearchRequestSerializer,
)

pytestmark = pytest.mark.django_db


def test_filter_serializer_accepts_resource_type():
    s = LearningResourcesSearchFiltersSerializer(
        data={"resource_type": ["video_playlist"]}
    )
    assert s.is_valid(), s.errors
    assert s.validated_data["resource_type"] == ["video_playlist"]


def test_filter_serializer_rejects_invalid_resource_type():
    s = LearningResourcesSearchFiltersSerializer(data={"resource_type": ["not_a_type"]})
    assert not s.is_valid()
    assert "resource_type" in s.errors


def test_filter_serializer_has_no_search_fields():
    fields = LearningResourcesSearchFiltersSerializer().fields
    assert "q" not in fields
    assert "offset" not in fields
    assert "limit" not in fields
    assert "hybrid_search" not in fields
    assert "readable_id" not in fields
    # isnull filters are Qdrant-only and must not be in the shared base,
    # since generate_filter_clauses (OpenSearch) doesn't support them
    assert "url__isnull" not in fields
    assert "title__isnull" not in fields


def test_vector_search_request_serializer_inherits_filter_fields():
    fields = LearningResourcesVectorSearchRequestSerializer().fields
    assert "resource_type" in fields
    assert "platform" in fields
    assert "q" in fields
    assert "hybrid_search" in fields
