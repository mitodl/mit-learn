from vector_search.constants import MAX_RESULT_WINDOW
from vector_search.serializers import (
    ContentFileVectorSearchRequestSerializer,
    LearningResourcesSearchFiltersSerializer,
    LearningResourcesVectorSearchRequestSerializer,
)


def test_filter_serializer_accepts_resource_type():
    s = LearningResourcesSearchFiltersSerializer(
        data={"resource_type": ["video_playlist"]}
    )
    assert s.is_valid(), s.errors
    assert s.validated_data["resource_type"] == ["video_playlist"]


def test_filter_serializer_accepts_resource_category():
    """Resource category is a shared learning resource search filter."""
    s = LearningResourcesSearchFiltersSerializer(
        data={"resource_category": ["Course", "Practice & Assignment"]}
    )
    assert s.is_valid(), s.errors
    assert s.validated_data["resource_category"] == [
        "Course",
        "Practice & Assignment",
    ]


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
    assert "resource_category" in fields
    assert "platform" in fields
    assert "q" in fields
    assert "hybrid_search" in fields


def test_vector_search_result_window_validation():
    """Test that the result window (offset + limit) is validated."""
    # Valid window
    data = {"offset": 10, "limit": 10}
    s = LearningResourcesVectorSearchRequestSerializer(data=data)
    assert s.is_valid(), s.errors

    # Invalid window: offset + limit > MAX_RESULT_WINDOW
    data = {"offset": MAX_RESULT_WINDOW, "limit": 1}
    s = LearningResourcesVectorSearchRequestSerializer(data=data)
    assert not s.is_valid()
    assert (
        f"offset + limit must not exceed {MAX_RESULT_WINDOW}"
        in s.errors["non_field_errors"][0]
    )

    # Boundary case: offset + limit == MAX_RESULT_WINDOW
    data = {"offset": MAX_RESULT_WINDOW - 10, "limit": 10}
    s = LearningResourcesVectorSearchRequestSerializer(data=data)
    assert s.is_valid(), s.errors


def test_content_file_vector_search_result_window_validation():
    """Test that the result window (offset + limit) is validated for content files."""
    # Valid window
    data = {"offset": 10, "limit": 10}
    s = ContentFileVectorSearchRequestSerializer(data=data)
    assert s.is_valid(), s.errors

    # Invalid window: offset + limit > MAX_RESULT_WINDOW
    data = {"offset": MAX_RESULT_WINDOW, "limit": 1}
    s = ContentFileVectorSearchRequestSerializer(data=data)
    assert not s.is_valid()
    assert (
        f"offset + limit must not exceed {MAX_RESULT_WINDOW}"
        in s.errors["non_field_errors"][0]
    )

    # Boundary case: offset + limit == MAX_RESULT_WINDOW
    data = {"offset": MAX_RESULT_WINDOW - 10, "limit": 10}
    s = ContentFileVectorSearchRequestSerializer(data=data)
    assert s.is_valid(), s.errors


def test_content_file_vector_search_serializer_strips_invalid_edx_module_ids():
    """Invalid edx_module_ids are stripped; valid ones survive; absent stays absent."""
    valid_id = "block-v1:MITx+6.00x+2T2020+type@problem+block@abc"

    serializer = ContentFileVectorSearchRequestSerializer(
        data={
            "q": "test",
            "edx_module_id": [
                valid_id,
                "block-v1:X+type@discussion+block@y",
                "block_xpro",
            ],
        }
    )
    assert serializer.is_valid()
    assert serializer.validated_data["edx_module_id"] == [valid_id]

    all_invalid = ContentFileVectorSearchRequestSerializer(
        data={"q": "test", "edx_module_id": ["block_xpro"]}
    )
    assert all_invalid.is_valid()
    assert all_invalid.validated_data["edx_module_id"] == []

    not_sent = ContentFileVectorSearchRequestSerializer(data={"q": "test"})
    assert not_sent.is_valid()
    assert "edx_module_id" not in not_sent.validated_data
