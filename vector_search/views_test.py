import asyncio

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from qdrant_client import models
from qdrant_client.http.models.models import CountResult
from rest_framework.exceptions import NotAuthenticated, PermissionDenied

from learning_resources.constants import GROUP_CONTENT_FILE_CONTENT_VIEWERS
from vector_search.views import QdrantView


def test_vector_search_filters(mocker, client):
    """Test vector search with query uses query filters"""

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.query_points_groups = mocker.AsyncMock()
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
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
                key="departments[].department_id",
                match=models.MatchAny(any=["6", "7"]),
            ),
        ]
    )


def test_vector_search_filters_empty_query(mocker, client):
    """Test vector search filters with empty query uses scroll filters"""

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.query_points_groups = mocker.AsyncMock()
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
    mocker.patch(
        "vector_search.views.async_qdrant_client",
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
                key="departments[].department_id",
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

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.query_points_groups = mocker.AsyncMock()
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
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
                    key="run_readable_id", match=models.MatchAny(any=["test_run_id"])
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

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.query_points_groups = mocker.AsyncMock()
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
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
                key="run_readable_id", match=models.MatchAny(any=["test_run_id"])
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

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    custom_collection_name = "foo_bar_collection"
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.query_points_groups = mocker.AsyncMock()
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))

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

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    custom_collection_name = "foo_bar_collection"

    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.query_points_groups = mocker.AsyncMock()
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
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
    mock_qdrant.query_points_groups = mocker.AsyncMock(return_value=mock_group_result)
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


def test_qdrant_view_format_order_by():
    view = QdrantView()

    order_by = view._format_order_by("views")  # noqa: SLF001
    assert order_by.key == "views"
    assert order_by.direction == models.Direction.ASC

    order_by = view._format_order_by("-views")  # noqa: SLF001
    assert order_by.key == "views"
    assert order_by.direction == models.Direction.DESC

    order_by = view._format_order_by("-")  # noqa: SLF001
    assert order_by.key == "-"
    assert order_by.direction == models.Direction.ASC


@pytest.mark.parametrize("query_string", ["", "test"])
@pytest.mark.parametrize("hybrid_search", [True, False])
def test_vector_search_sortby_parameter(mocker, client, query_string, hybrid_search):
    """Test vector search properly passes sortby parameter to qdrant client"""

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    params = {
        "q": query_string,
        "sortby": "-views",
        "hybrid_search": hybrid_search,
    }

    client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    if query_string:
        call_kwargs = mock_qdrant.query_points.mock_calls[0].kwargs
        assert isinstance(call_kwargs["query"], models.OrderByQuery)
        assert call_kwargs["query"].order_by.key == "views"
        assert call_kwargs["query"].order_by.direction == models.Direction.DESC
    else:
        call_kwargs = mock_qdrant.scroll.mock_calls[0].kwargs
        assert "order_by" in call_kwargs
        assert call_kwargs["order_by"].key == "views"
        assert call_kwargs["order_by"].direction == models.Direction.DESC


def test_vector_search_sortby_pagination(mocker, client):
    """Test that sortby with offset uses client-side slicing instead of Qdrant offset.

    Qdrant's query_points does not support offset with OrderByQuery, so
    we must fetch offset+limit results and slice on the client side.
    """

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()

    # Create 80 mock points to simulate a large result set
    mock_points = []
    for i in range(80):
        mock_point = mocker.MagicMock()
        mock_point.payload = {"readable_id": f"resource-{i}"}
        mock_points.append(mock_point)

    mock_result = mocker.MagicMock()
    mock_result.points = mock_points
    mock_qdrant.query_points = mocker.AsyncMock(return_value=mock_result)
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=100))
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    params = {
        "q": "test",
        "sortby": "-created_on",
        "limit": 20,
        "offset": 60,
    }

    client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    call_kwargs = mock_qdrant.query_points.mock_calls[0].kwargs

    # Should request offset+limit results, not just limit
    assert call_kwargs["limit"] == 80  # 60 + 20

    # Should NOT pass offset to Qdrant when using OrderByQuery
    assert "offset" not in call_kwargs


def test_vector_search_with_score_cutoff_fetches_all_results(mocker, client):
    """A query with a score cutoff should bypass request pagination."""

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()

    mock_result = mocker.MagicMock()
    mock_result.points = []
    mock_qdrant.query_points = mocker.AsyncMock(return_value=mock_result)
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=42))
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    params = {
        "q": "test",
        "limit": 10,
        "offset": 20,
        "score_cutoff": 0.5,
    }

    client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    call_kwargs = mock_qdrant.query_points.mock_calls[0].kwargs
    assert call_kwargs["limit"] == 42
    assert call_kwargs["offset"] == 0
    assert call_kwargs["score_threshold"] == 0.5


def test_vector_search_sortby_scroll_pagination(mocker, client):
    """Test that sortby with offset on scroll (no query) uses client-side slicing.

    Qdrant disables scroll pagination (next_page_offset) when order_by
    is used.  We must fetch offset+limit in one call and slice.
    """

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()

    # Create 80 mock points to simulate a large result set
    mock_points = []
    for i in range(80):
        mock_point = mocker.MagicMock()
        mock_point.payload = {"readable_id": f"resource-{i}"}
        mock_points.append(mock_point)

    # scroll returns (points, next_page_offset=None) when order_by is used
    mock_qdrant.scroll = mocker.AsyncMock(return_value=(mock_points, None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=100))
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    params = {
        "q": "",
        "sortby": "-created_on",
        "limit": 20,
        "offset": 60,
    }

    client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    call_kwargs = mock_qdrant.scroll.mock_calls[0].kwargs

    # Should request offset+limit in a single call
    assert call_kwargs["limit"] == 80  # 60 + 20

    # Should NOT pass a page offset (no cursor-based pagination with order_by)
    assert "offset" not in call_kwargs or call_kwargs.get("offset") is None

    # query_points should not be called (no query string)
    assert mock_qdrant.query_points.call_count == 0


def test_async_vector_resource_counts_aggregation_buckets():
    """
    _async_vector_resource_counts should compute correct aggregation
    buckets from hydrated hits that contain multi-valued fields
    (topics, delivery) and scalar fields (free).
    """
    view = QdrantView()

    # Simulate hydrated hits (dicts keyed by payload field paths)
    hits = [
        {
            "readable_id": "course-1",
            "topics": [{"name": "Mathematics"}, {"name": "Physics"}],
            "delivery": [{"code": "online"}, {"code": "in_person"}],
            "free": True,
        },
        {
            "readable_id": "course-2",
            "topics": [{"name": "Mathematics"}, {"name": "Social Science"}],
            "delivery": [{"code": "online"}],
            "free": False,
        },
        {
            "readable_id": "course-3",
            "topics": [{"name": "Physics"}],
            "delivery": [{"code": "in_person"}],
            "free": True,
        },
    ]

    params = {"aggregations": ["topic", "delivery", "free"]}

    result = asyncio.run(
        view._async_vector_resource_counts(hits, params)  # noqa: SLF001
    )

    assert result["total"]["value"] == 3

    # Build lookup dicts for easier assertions
    topic_buckets = {b["key"]: b["doc_count"] for b in result["aggregations"]["topic"]}
    delivery_buckets = {
        b["key"]: b["doc_count"] for b in result["aggregations"]["delivery"]
    }
    free_buckets = {b["key"]: b["doc_count"] for b in result["aggregations"]["free"]}

    # topic: Mathematics appears in 2 hits, Physics in 2, Social Science in 1
    assert topic_buckets == {
        "Mathematics": 2,
        "Physics": 2,
        "Social Science": 1,
    }

    # delivery: online in 2 hits, in_person in 2
    assert delivery_buckets == {"online": 2, "in_person": 2}

    # free: True (→ "true") in 2 hits, False (→ "false") in 1
    assert free_buckets == {"true": 2, "false": 1}


def test_vector_search_no_score_cutoff_omits_score_threshold(mocker, client):
    """Test that if score_cutoff is not explicitly passed, score_threshold is omitted from qdrant query"""
    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()

    mock_result = mocker.MagicMock()
    mock_result.points = []
    mock_qdrant.query_points = mocker.AsyncMock(return_value=mock_result)
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=42))
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    params = {
        "q": "test",
        "limit": 10,
        "offset": 20,
    }

    client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    call_kwargs = mock_qdrant.query_points.mock_calls[0].kwargs
    assert "score_threshold" not in call_kwargs


def test_async_vector_resource_counts_usage(mocker, client):
    """Test that _async_vector_resource_counts is only called when q and explicit score_cutoff are present."""
    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()

    mock_result = mocker.MagicMock()
    mock_result.points = []
    mock_qdrant.query_points = mocker.AsyncMock(return_value=mock_result)
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=42))
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    spy_resource_counts = mocker.spy(QdrantView, "_async_vector_resource_counts")
    spy_vector_counts = mocker.spy(QdrantView, "_async_vector_counts")

    url = reverse("vector_search:v0:vector_learning_resources_search")

    # 1. q present, no score_cutoff
    client.get(url, data={"q": "test"})
    assert spy_resource_counts.call_count == 0
    assert spy_vector_counts.call_count == 1

    # 2. no q, score_cutoff present
    spy_vector_counts.reset_mock()
    client.get(url, data={"score_cutoff": 0.5})
    assert spy_resource_counts.call_count == 0
    assert spy_vector_counts.call_count == 1

    # 3. no q, no score_cutoff
    spy_vector_counts.reset_mock()
    client.get(url, data={})
    assert spy_resource_counts.call_count == 0
    assert spy_vector_counts.call_count == 1

    # 4. q present, score_cutoff present
    spy_vector_counts.reset_mock()
    client.get(url, data={"q": "test", "score_cutoff": 0.5})
    assert spy_resource_counts.call_count == 1


def test_vector_search_with_score_cutoff_enforces_max_limit(mocker, client, settings):
    """Test that vector search with score_cutoff limits returned results to VECTOR_SEARCH_PAGE_MAX_LIMIT"""
    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()

    settings.VECTOR_SEARCH_PAGE_MAX_LIMIT = 5

    mock_result = mocker.MagicMock()
    mock_points = []
    for i in range(10):
        mock_point = mocker.MagicMock()
        mock_point.payload = {"readable_id": f"resource-{i}"}
        mock_points.append(mock_point)
    mock_result.points = mock_points

    mock_qdrant.query_points = mocker.AsyncMock(return_value=mock_result)
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )
    mocker.patch(
        "vector_search.views._resource_vector_hits",
        return_value=[{"id": f"resource-{i}"} for i in range(10)],
    )

    params = {
        "q": "test",
        "limit": 10,
        "offset": 0,
        "score_cutoff": 0.5,
    }

    response = client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    assert response.status_code == 200
    response_json = response.json()
    assert len(response_json["results"]) == 5
