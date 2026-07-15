import asyncio
from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from qdrant_client import models
from qdrant_client.http.models.models import CountResult
from rest_framework.exceptions import NotAuthenticated, PermissionDenied

from learning_resources.constants import GROUP_CONTENT_FILE_CONTENT_VIEWERS
from learning_resources.factories import (
    LearningResourceFactory,
    LearningResourceRunFactory,
)
from vector_search.encoders.utils import dense_encoder, sparse_encoder
from vector_search.views import QdrantView


@pytest.fixture
def content_file_viewer(client, django_user_model):
    """Log in a user permitted to view content-file search results."""
    user = django_user_model.objects.create()
    group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
    group.user_set.add(user)
    client.force_login(user)
    return user


@pytest.fixture
def mock_qdrant(mocker):
    """Async Qdrant client mock wired into both views and utils.

    Defaults to an empty result set (no hits, count 0); tests needing hits
    override ``query_points`` / ``count`` on the returned mock.
    """
    qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    empty = mocker.MagicMock()
    empty.points = []
    qdrant.query_points = mocker.AsyncMock(return_value=empty)
    qdrant.query_points_groups = mocker.AsyncMock()
    qdrant.count = mocker.AsyncMock(return_value=CountResult(count=0))
    mocker.patch("vector_search.views.async_qdrant_client", return_value=qdrant)
    mocker.patch("vector_search.utils.async_qdrant_client", return_value=qdrant)
    return qdrant


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
        "resource_category": ["Course", "Practice & Assignment"],
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
            models.FieldCondition(
                key="resource_category",
                match=models.MatchAny(any=["Course", "Practice & Assignment"]),
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
        "resource_category": ["Course", "Practice & Assignment"],
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
            models.FieldCondition(
                key="resource_category",
                match=models.MatchAny(any=["Course", "Practice & Assignment"]),
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
        "edx_module_id": ["block-v1:MITx+6.00x+2T2020+type@problem+block@abc"],
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
                    key="edx_module_id",
                    match=models.MatchAny(
                        any=["block-v1:MITx+6.00x+2T2020+type@problem+block@abc"]
                    ),
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
        "edx_module_id": ["block-v1:MITx+6.00x+2T2020+type@problem+block@abc"],
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
                key="edx_module_id",
                match=models.MatchAny(
                    any=["block-v1:MITx+6.00x+2T2020+type@problem+block@abc"]
                ),
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
@pytest.mark.parametrize("min_score", [0.0, 0.1, None])
@pytest.mark.parametrize("sortby", ["-views", "views", None])
def test_vector_search_sortby_parameter(  # noqa: PLR0913
    mocker, client, query_string, hybrid_search, min_score, sortby
):
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
        "sortby": sortby,
        "hybrid_search": hybrid_search,
        "score_cutoff": min_score,
    }
    view = QdrantView()
    asyncio.run(
        view.async_vector_search(
            query_string,
            params,
            order_by=sortby,
            score_cutoff=min_score,
            hybrid_search=hybrid_search,
        )
    )

    if query_string:
        call_kwargs = mock_qdrant.query_points.mock_calls[0].kwargs
        if hybrid_search:
            if sortby and min_score is None:
                assert isinstance(call_kwargs["query"], models.OrderByQuery)
                assert call_kwargs["query"].order_by.key == "views"
            else:
                assert isinstance(call_kwargs["query"], models.FusionQuery)

    else:
        call_kwargs = mock_qdrant.scroll.mock_calls[0].kwargs
        if sortby:
            assert "order_by" in call_kwargs
            assert call_kwargs["order_by"].key == "views"
            if sortby.startswith("-"):
                assert call_kwargs["order_by"].direction == models.Direction.DESC
            else:
                assert call_kwargs["order_by"].direction == models.Direction.ASC


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
        "sortby": "-created_on",
        "limit": 20,
        "offset": 60,
    }

    client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    call_kwargs = mock_qdrant.scroll.mock_calls[0].kwargs

    # Should request offset+limit results, not just limit
    assert call_kwargs["limit"] == 80  # 60 + 20

    # Should NOT pass offset to Qdrant when using OrderByQuery
    assert "offset" not in call_kwargs


def test_vector_search_with_score_cutoff_enforces_max_limit(mocker, client, settings):
    """A query with a score cutoff should enforce VECTOR_SEARCH_PAGE_MAX_LIMIT."""

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()

    settings.VECTOR_SEARCH_PAGE_MAX_LIMIT = 5

    mock_result = mocker.MagicMock()
    mock_result.points = []
    mock_qdrant.query_points = mocker.AsyncMock(return_value=mock_result)
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    # count is no longer called in this branch
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    params = {
        "q": "test",
        "hybrid_search": True,
        "limit": 10,
        "offset": 20,
        "score_cutoff": 0.6,
    }

    client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    call_kwargs = mock_qdrant.query_points.mock_calls[0].kwargs
    assert call_kwargs["limit"] == 5
    assert call_kwargs["offset"] == 0
    assert call_kwargs["score_threshold"] == 0.6


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


def test_vector_search_no_score_cutoff_omits_score_threshold(
    mocker, client, django_user_model
):
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
    user = django_user_model.objects.create()
    group, _ = Group.objects.get_or_create(name=GROUP_CONTENT_FILE_CONTENT_VIEWERS)
    group.user_set.add(user)
    client.force_login(user)

    params = {
        "q": "test",
        "limit": 10,
        "offset": 20,
    }

    client.get(reverse("vector_search:v0:vector_content_files_search"), data=params)

    call_kwargs = mock_qdrant.query_points.mock_calls[0].kwargs
    assert "score_threshold" not in call_kwargs


def test_vector_search_sortby_with_score_cutoff_manually_sorted(mocker, client):
    """
    Test that when a request is made with q, hybrid_search=True, and sortby,
    and it hits the score cutoff branch, results are manually sorted by the sortby param.
    """
    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()

    mock_result = mocker.MagicMock()
    mock_point_1 = mocker.MagicMock()
    mock_point_1.payload = {"readable_id": "course-1"}
    mock_point_2 = mocker.MagicMock()
    mock_point_2.payload = {"readable_id": "course-2"}
    mock_point_3 = mocker.MagicMock()
    mock_point_3.payload = {"readable_id": "course-3"}

    mock_result.points = [mock_point_1, mock_point_2, mock_point_3]
    mock_qdrant.query_points = mocker.AsyncMock(return_value=mock_result)
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    mock_hits = [
        {"readable_id": "course-1", "views": 100},
        {"readable_id": "course-2", "views": 50},
        {"readable_id": "course-3", "views": 200},
    ]
    mocker.patch(
        "vector_search.views._resource_vector_hits",
        return_value=mock_hits,
    )

    # Test descending sort: sortby=-views
    params = {
        "hybrid_search": "true",
        "q": "test",
        "sortby": "-views",
    }

    response = client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert [r["views"] for r in results] == [200, 100, 50]

    # Test ascending sort: sortby=views
    params["sortby"] = "views"

    response = client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert [r["views"] for r in results] == [50, 100, 200]


@pytest.mark.parametrize("hybrid_search", [True, False])
def test_vector_search_with_score_cutoff_enforces_min_score(
    mocker, client, settings, hybrid_search
):
    """A query with a score cutoff should clamp score_threshold to the configured minimum score and enforce the page max limit."""

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()

    settings.VECTOR_SEARCH_PAGE_MAX_LIMIT = 5

    mock_result = mocker.MagicMock()
    mock_result.points = []
    mock_qdrant.query_points = mocker.AsyncMock(return_value=mock_result)
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    # count is no longer called in this branch
    mocker.patch(
        "vector_search.views.async_qdrant_client",
        return_value=mock_qdrant,
    )

    params = {
        "q": "test",
        "hybrid_search": hybrid_search,
        "limit": 10,
        "offset": 20,
    }

    client.get(
        reverse("vector_search:v0:vector_learning_resources_search"), data=params
    )

    call_kwargs = mock_qdrant.query_points.mock_calls[0].kwargs
    assert call_kwargs["limit"] == 5
    assert call_kwargs["offset"] == 0
    if hybrid_search:
        assert call_kwargs["score_threshold"] == settings.HYBRID_VECTOR_SEARCH_MIN_SCORE
    else:
        assert call_kwargs["score_threshold"] == settings.DENSE_VECTOR_SEARCH_MIN_SCORE


@pytest.mark.parametrize("query_string", ["", "test"])
@pytest.mark.parametrize("hybrid_search", [True, False])
@pytest.mark.parametrize("min_score", [0.0, 0.1, None])
@pytest.mark.parametrize("sortby", ["-views", "views", None])
def test_build_search_params_sort_with_cutoff_score(
    settings, query_string, hybrid_search, min_score, sortby
):
    """
    Test that _build_search_params returns correct search parameters when sortby and score_cutoff are both provided.
    """
    view = QdrantView()

    search_params = asyncio.run(
        view._build_search_params(  # noqa: SLF001
            query_string=query_string,
            search_collection=None,
            limit=10,
            prefetch_limit=100,
            search_filter=None,
            order_by=sortby,
            encoder_dense=dense_encoder(),
            encoder_sparse=sparse_encoder(),
            hybrid_search=hybrid_search,
            score_cutoff=min_score,
        )
    )
    assert not (
        isinstance(search_params["query"], models.OrderByQuery)
        and "score_cutoff" in search_params
    ), (
        "OrderByQuery query should never be used with a score_cutoff, because Qdrant does not support score_threshold with OrderByQuery.  If both are provided, the view should fall back to a FusionQuery and do manual sorting on the client side."
    )

    if query_string and min_score is not None:
        if sortby and hybrid_search:
            assert isinstance(search_params["query"], models.FusionQuery)

        assert search_params["score_threshold"] == (
            settings.HYBRID_VECTOR_SEARCH_MIN_SCORE
            if hybrid_search
            else settings.DENSE_VECTOR_SEARCH_MIN_SCORE
        )

    if sortby and min_score is None:
        assert isinstance(search_params["query"], models.OrderByQuery)
        if sortby.startswith("-"):
            assert search_params["query"].order_by.direction == models.Direction.DESC
        else:
            assert search_params["query"].order_by.direction == models.Direction.ASC


@pytest.mark.django_db(transaction=True)
def test_content_file_search_restricts_resource_query_to_best_run(
    mocker, client, django_user_model
):
    """resource_readable_id with no run filter is pinned to the best run."""
    course = LearningResourceFactory.create(is_course=True, test_mode=False)
    course.runs.all().delete()
    # end_date=None is load-bearing: prevents both runs from looking currently-enrollable,
    # which would cause best_run to pick earliest start_date (OLD_RUN) instead of latest.
    LearningResourceRunFactory.create(
        learning_resource=course,
        run_id="OLD_RUN",
        published=True,
        start_date=timezone.now() - timedelta(days=60),
        enrollment_start=None,
        enrollment_end=None,
        end_date=None,
    )
    best = LearningResourceRunFactory.create(
        learning_resource=course,
        run_id="NEW_RUN",
        published=True,
        start_date=timezone.now() - timedelta(days=10),
        enrollment_start=None,
        enrollment_end=None,
        end_date=None,
    )

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.query_points_groups = mocker.AsyncMock()
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
    mocker.patch("vector_search.views.async_qdrant_client", return_value=mock_qdrant)

    admin = django_user_model.objects.create_superuser(
        "admin", "admin@example.com", "pass"
    )
    client.force_login(admin)

    client.get(
        reverse("vector_search:v0:vector_content_files_search"),
        data={"q": "topics", "resource_readable_id": [course.readable_id]},
    )

    must = mock_qdrant.query_points.mock_calls[0].kwargs["query_filter"].must
    # Allowed runs are the best run PLUS the resource readable_id itself (which
    # matches the run-less course-metadata point).
    run_conditions = [c for c in must if getattr(c, "key", None) == "run_readable_id"]
    assert len(run_conditions) == 1
    assert set(run_conditions[0].match.any) == {best.run_id, course.readable_id}
    # resource_readable_id is replaced by the run filter, not AND-ed with it
    # (a single-field filter keeps Qdrant's approximate count accurate).
    assert not any(getattr(c, "key", None) == "resource_readable_id" for c in must)


@pytest.mark.django_db(transaction=True)
def test_content_file_search_test_mode_not_restricted(
    mocker, client, django_user_model
):
    """A test_mode course allows all its published runs."""
    course = LearningResourceFactory.create(is_course=True, test_mode=True)
    course.runs.all().delete()
    run_a = LearningResourceRunFactory.create(
        learning_resource=course, run_id="RUN_A", published=True
    )
    run_b = LearningResourceRunFactory.create(
        learning_resource=course, run_id="RUN_B", published=True
    )

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.query_points_groups = mocker.AsyncMock()
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
    mocker.patch("vector_search.views.async_qdrant_client", return_value=mock_qdrant)

    admin = django_user_model.objects.create_superuser(
        "admin", "admin@example.com", "pass"
    )
    client.force_login(admin)

    client.get(
        reverse("vector_search:v0:vector_content_files_search"),
        data={"q": "topics", "resource_readable_id": [course.readable_id]},
    )

    must = mock_qdrant.query_points.mock_calls[0].kwargs["query_filter"].must
    run_conditions = [c for c in must if getattr(c, "key", None) == "run_readable_id"]
    assert len(run_conditions) == 1
    # All published runs plus the resource readable_id (for the metadata point).
    assert set(run_conditions[0].match.any) == {
        run_a.run_id,
        run_b.run_id,
        course.readable_id,
    }


@pytest.mark.django_db
def test_content_file_search_explicit_run_not_overridden(
    mocker, client, django_user_model
):
    """An explicit run_readable_id filter is left untouched."""
    course = LearningResourceFactory.create(is_course=True, test_mode=False)
    course.runs.all().delete()
    LearningResourceRunFactory.create(
        learning_resource=course, run_id="BEST_RUN", published=True
    )

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.query_points_groups = mocker.AsyncMock()
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
    mocker.patch("vector_search.views.async_qdrant_client", return_value=mock_qdrant)

    admin = django_user_model.objects.create_superuser(
        "admin", "admin@example.com", "pass"
    )
    client.force_login(admin)

    client.get(
        reverse("vector_search:v0:vector_content_files_search"),
        data={
            "q": "topics",
            "resource_readable_id": [course.readable_id],
            "run_readable_id": ["EXPLICIT_RUN"],
        },
    )

    must = mock_qdrant.query_points.mock_calls[0].kwargs["query_filter"].must
    assert (
        models.FieldCondition(
            key="run_readable_id", match=models.MatchAny(any=["EXPLICIT_RUN"])
        )
        in must
    )
    assert not any(
        getattr(c, "key", None) == "run_readable_id" and c.match.any == ["BEST_RUN"]
        for c in must
    )


@pytest.mark.django_db(transaction=True)
def test_content_file_search_no_best_run_metadata_only(
    mocker, client, django_user_model
):
    """A resource with no published run resolves to the resource metadata point only.

    best_run_ids_for_resources returns [], so the allowed run set is just the
    resource readable_id (which matches the course-metadata point). No real run's
    content files leak in.
    """
    course = LearningResourceFactory.create(is_course=True, test_mode=False)
    course.runs.all().delete()
    # Only an unpublished run, so best_run is None and best_run_ids_for_resources -> [].
    LearningResourceRunFactory.create(
        learning_resource=course,
        run_id="UNPUB_RUN",
        published=False,
        start_date=timezone.now() - timedelta(days=10),
        enrollment_start=None,
        enrollment_end=None,
        end_date=None,
    )

    mock_qdrant = mocker.patch(
        "qdrant_client.AsyncQdrantClient", return_value=mocker.AsyncMock()
    )()
    mock_qdrant.scroll = mocker.AsyncMock(return_value=([], None))
    mock_qdrant.query_points = mocker.AsyncMock()
    mock_qdrant.query_points_groups = mocker.AsyncMock()
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=10))
    mocker.patch("vector_search.views.async_qdrant_client", return_value=mock_qdrant)

    admin = django_user_model.objects.create_superuser(
        "admin", "admin@example.com", "pass"
    )
    client.force_login(admin)

    client.get(
        reverse("vector_search:v0:vector_content_files_search"),
        data={"q": "topics", "resource_readable_id": [course.readable_id]},
    )

    must = mock_qdrant.query_points.mock_calls[0].kwargs["query_filter"].must
    run_conditions = [c for c in must if getattr(c, "key", None) == "run_readable_id"]
    assert len(run_conditions) == 1
    assert set(run_conditions[0].match.any) == {course.readable_id}


@pytest.mark.django_db
def test_content_file_vector_search_logs_missing_edx_module_id(
    mocker, client, mock_qdrant, content_file_viewer
):
    """Vector search for an edx_module_id with no ContentFile logs not_in_db."""
    mock_log = mocker.patch("vector_search.utils.log_missing_content_file")
    absent_id = "block-v1:MITx+6.00x+2T2020+type@problem+block@absent"

    client.get(
        reverse("vector_search:v0:vector_content_files_search"),
        data={"q": "test", "edx_module_id": [absent_id]},
    )

    mock_log.assert_any_call(
        absent_id, reason="not_in_db", source="vector_content_files_search"
    )


@pytest.mark.django_db
def test_content_file_vector_search_probe_failure_does_not_break_search(
    mocker, client, mock_qdrant, content_file_viewer
):
    """A failing observability probe must not propagate and return a 500."""
    mocker.patch(
        "vector_search.views.check_missing_content_file_ids",
        new=mocker.AsyncMock(side_effect=Exception("qdrant down")),
    )

    response = client.get(
        reverse("vector_search:v0:vector_content_files_search"),
        data={
            "q": "test",
            "edx_module_id": ["block-v1:MITx+6.00x+2T2020+type@problem+block@absent"],
        },
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_content_file_vector_search_skips_probe_when_results_present(
    mocker, client, mock_qdrant, content_file_viewer
):
    """Probe is skipped when the search returns at least one hit."""
    # A single point with the minimum payload needed by _content_file_vector_hits.
    mock_point = mocker.MagicMock()
    mock_point.payload = {
        "run_readable_id": "run-present",
        "key": "present.pdf",
        "edx_module_id": "block-v1:MITx+6.00x+2T2020+type@problem+block@present",
    }
    non_empty_result = mocker.MagicMock()
    non_empty_result.points = [mock_point]
    mock_qdrant.query_points = mocker.AsyncMock(return_value=non_empty_result)
    mock_qdrant.count = mocker.AsyncMock(return_value=CountResult(count=1))

    mock_probe = mocker.patch(
        "vector_search.views.check_missing_content_file_ids",
        new=mocker.AsyncMock(),
    )

    response = client.get(
        reverse("vector_search:v0:vector_content_files_search"),
        data={
            "q": "test",
            "edx_module_id": ["block-v1:MITx+6.00x+2T2020+type@problem+block@present"],
        },
    )

    assert response.status_code == 200
    mock_probe.assert_not_awaited()


@pytest.mark.django_db
def test_content_file_vector_search_all_invalid_ids_returns_empty(
    mocker, client, mock_qdrant, content_file_viewer
):
    """If every requested edx_module_id is invalid, return empty results
    without querying Qdrant or probing for missing content.
    """
    mock_probe = mocker.patch(
        "vector_search.views.check_missing_content_file_ids",
        new=mocker.AsyncMock(),
    )

    response = client.get(
        reverse("vector_search:v0:vector_content_files_search"),
        data={
            "q": "test",
            "edx_module_id": [
                "block-v1:X+type@discussion+block@y",
                "block_xpro",
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["results"] == []
    assert data["count"] == 0
    mock_qdrant.query_points.assert_not_called()
    mock_probe.assert_not_awaited()


@pytest.mark.django_db
def test_content_file_vector_search_partial_invalid_ids_searches_survivors(
    mocker, client, mock_qdrant, content_file_viewer
):
    """Invalid ids are dropped from the Qdrant filter; valid ones searched."""
    valid_id = "block-v1:MITx+6.00x+2T2020+type@problem+block@abc"

    response = client.get(
        reverse("vector_search:v0:vector_content_files_search"),
        data={
            "q": "test",
            "edx_module_id": [valid_id, "block-v1:X+type@discussion+block@y"],
        },
    )

    assert response.status_code == 200
    must = mock_qdrant.query_points.mock_calls[0].kwargs["query_filter"].must
    id_conditions = [c for c in must if getattr(c, "key", None) == "edx_module_id"]
    assert len(id_conditions) == 1
    assert list(id_conditions[0].match.any) == [valid_id]
