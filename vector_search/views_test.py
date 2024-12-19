from django.urls import reverse
from qdrant_client import models
from qdrant_client.http.models.models import CountResult


def test_vector_search_filters(mocker, client):
    """Test vector search with query uses query filters"""

    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mock_qdrant.scroll.return_value = [[]]
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.count.return_value = CountResult(count=10)
    params = {
        "q": "test",
        "topic": ["test"],
        "offered_by": ["ocw"],
        "platform": ["edx"],
        "resource_type": ["course"],
        "free": True,
        "department": ["6", "7"],
    }

    client.get(
        reverse("vector_search:v0:learning_resources_vector_search"), data=params
    )

    assert all(
        condition in mock_qdrant.query_points.mock_calls[0].kwargs["query_filter"].must
        for condition in [
            models.FieldCondition(
                key="offered_by.code", match=models.MatchAny(any=["ocw"])
            ),
            models.FieldCondition(
                key="platform.code", match=models.MatchAny(any=["edx"])
            ),
            models.FieldCondition(
                key="resource_type", match=models.MatchAny(any=["course"])
            ),
            models.FieldCondition(key="free", match=models.MatchValue(value=True)),
            models.FieldCondition(
                key="departments.department_id",
                match=models.MatchAny(any=["6", "7"]),
            ),
            models.FieldCondition(key="published", match=models.MatchValue(value=True)),
        ]
    )


def test_vector_search_filters_empty_query(mocker, client):
    """Test vector search filters with empty query uses scroll filters"""

    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mock_qdrant.scroll.return_value = [[]]
    mock_qdrant.count.return_value = CountResult(count=10)
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )

    params = {
        "q": "",
        "topic": ["test"],
        "offered_by": ["ocw"],
        "platform": ["edx"],
        "resource_type": ["course"],
        "free": True,
        "department": ["6", "7"],
    }

    client.get(
        reverse("vector_search:v0:learning_resources_vector_search"), data=params
    )

    assert all(
        condition in mock_qdrant.scroll.mock_calls[0].kwargs["scroll_filter"].must
        for condition in [
            models.FieldCondition(
                key="offered_by.code", match=models.MatchAny(any=["ocw"])
            ),
            models.FieldCondition(
                key="platform.code", match=models.MatchAny(any=["edx"])
            ),
            models.FieldCondition(
                key="resource_type", match=models.MatchAny(any=["course"])
            ),
            models.FieldCondition(key="free", match=models.MatchValue(value=True)),
            models.FieldCondition(
                key="departments.department_id",
                match=models.MatchAny(any=["6", "7"]),
            ),
            models.FieldCondition(key="published", match=models.MatchValue(value=True)),
        ]
    )


def test_content_file_vector_search_filters(mocker, client):
    """Test content file vector search with query uses query filters"""

    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mock_qdrant.scroll.return_value = [[]]
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.count.return_value = CountResult(count=10)
    params = {
        "q": "test",
        "offered_by": ["ocw"],
        "platform": ["edx"],
        "key": ["testfilename.pdf"],
        "course_number": ["test"],
        "content_feature_type": ["test_feature"],
        "run_readable_id": ["test_run_id"],
        "resource_readable_id": ["test_resource_id_1", "test_resource_id_2"],
    }

    client.get(reverse("vector_search:v0:content_files_vector_search"), data=params)
    assert all(
        condition in mock_qdrant.query_points.mock_calls[0].kwargs["query_filter"].must
        for condition in [
            models.FieldCondition(
                key="offered_by.code", match=models.MatchAny(any=["ocw"])
            ),
            models.FieldCondition(
                key="platform.code", match=models.MatchAny(any=["edx"])
            ),
            models.FieldCondition(
                key="course_number", match=models.MatchAny(any=["test"])
            ),
            models.FieldCondition(
                key="run_readable_id", match=models.MatchAny(any=["test_run_id"])
            ),
            models.FieldCondition(
                key="content_feature_type", match=models.MatchAny(any=["test_feature"])
            ),
            models.FieldCondition(
                key="resource_readable_id",
                match=models.MatchAny(any=["test_resource_id_1", "test_resource_id_2"]),
            ),
        ]
    )


def test_content_file_vector_search_filters_empty_query(mocker, client):
    """Test content file vector search with query uses query filters"""

    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    mock_qdrant.scroll.return_value = [[]]
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.count.return_value = CountResult(count=10)
    # omit the q param
    params = {
        "offered_by": ["ocw"],
        "platform": ["edx"],
        "key": ["testfilename.pdf"],
        "course_number": ["test"],
        "content_feature_type": ["test_feature"],
        "run_readable_id": ["test_run_id"],
        "resource_readable_id": ["test_resource_id_1", "test_resource_id_2"],
    }

    client.get(reverse("vector_search:v0:content_files_vector_search"), data=params)
    assert all(
        condition in mock_qdrant.scroll.mock_calls[0].kwargs["scroll_filter"].must
        for condition in [
            models.FieldCondition(
                key="offered_by.code", match=models.MatchAny(any=["ocw"])
            ),
            models.FieldCondition(
                key="platform.code", match=models.MatchAny(any=["edx"])
            ),
            models.FieldCondition(
                key="course_number", match=models.MatchAny(any=["test"])
            ),
            models.FieldCondition(
                key="run_readable_id", match=models.MatchAny(any=["test_run_id"])
            ),
            models.FieldCondition(
                key="content_feature_type", match=models.MatchAny(any=["test_feature"])
            ),
            models.FieldCondition(
                key="resource_readable_id",
                match=models.MatchAny(any=["test_resource_id_1", "test_resource_id_2"]),
            ),
        ]
    )
