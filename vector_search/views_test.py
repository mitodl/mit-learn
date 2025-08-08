import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from qdrant_client import models
from qdrant_client.http.models.models import CountResult
from rest_framework.exceptions import NotAuthenticated, PermissionDenied

from learning_resources.constants import GROUP_CONTENT_FILE_CONTENT_VIEWERS


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
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
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
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
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
        ]
    )


@pytest.mark.parametrize(
    "user_role",
    [
        "anonymous",
        "normal",
        "admin",
        "group_content_file_content_viewer",
    ],
)
def test_content_file_vector_search_filters(
    mocker, client, django_user_model, user_role
):
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

    if user_role == "admin":
        admin_user = django_user_model.objects.create_superuser(
            "admin", "admin@example.com", "pass"
        )
        client.force_login(admin_user)
    elif user_role == "group_content_file_content_viewer":
        user = django_user_model.objects.create()
        group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
        group.user_set.add(user)
        client.force_login(user)
    elif user_role == "normal":
        user = django_user_model.objects.create()
        client.force_login(user)

    if user_role in ["admin", "group_content_file_content_viewer"]:
        client.get(reverse("vector_search:v0:vector_content_files_search"), data=params)
        assert all(
            condition
            in mock_qdrant.query_points.mock_calls[0].kwargs["query_filter"].must
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
                    key="content_feature_type",
                    match=models.MatchAny(any=["test_feature"]),
                ),
                models.FieldCondition(
                    key="resource_readable_id",
                    match=models.MatchAny(
                        any=["test_resource_id_1", "test_resource_id_2"]
                    ),
                ),
            ]
        )

    elif user_role == "anonymous":
        with pytest.raises(NotAuthenticated):
            client.get(
                reverse("vector_search:v0:vector_content_files_search"), data=params
            )
    elif user_role == "normal":
        with pytest.raises(PermissionDenied):
            client.get(
                reverse("vector_search:v0:vector_content_files_search"), data=params
            )


def test_content_file_vector_search_filters_empty_query(
    mocker, client, django_user_model
):
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

    user = django_user_model.objects.create()
    group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
    group.user_set.add(user)
    client.force_login(user)

    client.get(reverse("vector_search:v0:vector_content_files_search"), data=params)
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


def test_content_file_vector_search_filters_custom_collection(
    mocker, client, django_user_model
):
    """Test content file vector search uses custom collection if specified"""

    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    custom_collection_name = "foo_bar_collection"
    mock_qdrant.scroll.return_value = [[]]
    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.count.return_value = CountResult(count=10)

    params = {
        "offered_by": ["ocw"],
        "platform": ["edx"],
        "key": ["testfilename.pdf"],
        "course_number": ["test"],
        "content_feature_type": ["test_feature"],
        "run_readable_id": ["test_run_id"],
        "resource_readable_id": ["test_resource_id_1", "test_resource_id_2"],
        "collection_name": custom_collection_name,
    }

    user = django_user_model.objects.create()
    group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
    group.user_set.add(user)
    client.force_login(user)

    response = client.get(
        reverse("vector_search:v0:vector_content_files_search"), data=params
    )

    assert response.status_code == 200
    assert (
        mock_qdrant.scroll.mock_calls[0]
        .kwargs["collection_name"]
        .endswith(custom_collection_name)
    )


def test_content_file_vector_search_group_parameters(mocker, client, django_user_model):
    """Test content file vector search uses custom collection if specified"""

    mock_qdrant = mocker.patch("qdrant_client.QdrantClient")
    custom_collection_name = "foo_bar_collection"

    mocker.patch(
        "vector_search.utils.qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.count.return_value = CountResult(count=10)
    contentfile_keys = ["somefile.pdf", "trest.csv", "newfile.txt", "presentation.pptx"]

    mock_groups = []

    for i in range(4):
        mock_group = mocker.MagicMock()
        hits = []
        key = contentfile_keys[i % len(contentfile_keys)]
        for j in range(i + 1):
            mock_point = mocker.MagicMock()
            mock_point.payload = {
                "key": key,
                "course_number": f"course-{j}",
                "common_attribute_1": "common",
                "common_attribute_2": "common2",
                "common_attribute_different_value": f"different-{j}",
                "chunk_content": "test",
                "content_feature_type": "test_feature",
                "run_readable_id": f"run-{j}",
                "resource_readable_id": f"resource-{j}",
            }
            hits.append(mock_point)
        mock_group.hits = hits
        mock_groups.append(mock_group)
    mock_group_result = mocker.MagicMock()
    mock_group_result.groups = mock_groups
    mock_qdrant.query_points_groups.return_value = mock_group_result
    params = {
        "group_by": "key",
        "resource_readable_id": ["test_resource_id_1", "test_resource_id_2"],
        "collection_name": custom_collection_name,
        "q": "test",
    }
    user = django_user_model.objects.create()
    group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
    group.user_set.add(user)
    client.force_login(user)

    response = client.get(
        reverse("vector_search:v0:vector_content_files_search"), data=params
    )
    response_json = response.json()

    assert response.status_code == 200
    for i in range(len(response_json["results"])):
        result = response_json["results"][i]
        assert result["key"] in contentfile_keys
        assert result["common_attribute_1"] == "common"
        assert result["common_attribute_2"] == "common2"
        assert len(result["chunks"]) == i + 1
        if i > 1:
            assert "common_attribute_different_value" not in result
    assert len(response_json["results"]) == len(contentfile_keys)
    assert (
        mock_qdrant.query_points_groups.mock_calls[0]
        .kwargs["collection_name"]
        .endswith(custom_collection_name)
    )
