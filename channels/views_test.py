"""Tests for channels.views"""

import random
from math import ceil

import pytest
from django.urls import reverse

from channels.constants import ChannelType
from channels.factories import (
    ChannelFactory,
    ChannelListFactory,
    ChannelUnitDetailFactory,
    SubChannelFactory,
)
from channels.models import Channel
from channels.serializers import ChannelSerializer
from learning_resources.factories import (
    LearningPathFactory,
    LearningPathRelationshipFactory,
    LearningResourceFactory,
)
from main.factories import UserFactory

pytestmark = pytest.mark.django_db


def test_list_channels(user_client):
    """Test that all published channels are returned."""
    ChannelFactory.create_batch(2, published=False)
    channels = sorted(ChannelFactory.create_batch(3), key=lambda channel: channel.id)
    ChannelFactory.create_batch(2, published=False)

    url = reverse("channels:v0:channels_api-list")
    response_channels = sorted(
        user_client.get(url).json()["results"], key=lambda channel: channel["id"]
    )

    assert len(response_channels) == 3
    for idx, channel in enumerate(channels):
        assert response_channels[idx] == ChannelSerializer(instance=channel).data


@pytest.mark.parametrize("channel_count", [2, 6])
def test_list_unit_channels_query_count(
    client, django_assert_num_queries, channel_count
):
    """Unit channels cost the same number of queries however many are listed.

    unit_detail.unit is nested by the serializer and its channel_url is a
    cached_property, so without the prefetch each row costs two extra queries.
    """
    channels = ChannelFactory.create_batch(channel_count, is_unit=True)
    # An offeror shared with later, unpublished channels: channel_url has to
    # resolve to the same row the serializer would pick on its own, so the
    # prefetch behind it can't be an unordered subquery.
    for _ in range(3):
        extra = ChannelFactory.create(
            is_unit=True, published=False, create_unit_detail=False
        )
        ChannelUnitDetailFactory.create(
            channel=extra, unit=channels[0].unit_detail.unit
        )

    url = reverse("channels:v0:channels_api-list")
    with django_assert_num_queries(5):
        results = client.get(url).json()["results"]

    assert len(results) == channel_count
    assert all(item["unit_detail"]["unit"]["channel_url"] for item in results)
    # The listing must agree with serializing each instance directly.
    for channel in channels:
        listed = next(item for item in results if item["id"] == channel.id)
        assert (
            listed["unit_detail"]["unit"]["channel_url"]
            == ChannelSerializer(instance=channel).data["unit_detail"]["unit"][
                "channel_url"
            ]
        )


def test_channel_detail_has_no_is_moderator(client):
    """Channel detail no longer exposes moderator-specific fields."""
    channel = ChannelFactory.create()
    url = reverse("channels:v0:channels_api-detail", kwargs={"id": channel.id})

    response = client.get(url)

    assert response.status_code == 200
    assert "is_moderator" not in response.json()


def test_channel_type_detail_has_no_is_moderator(client):
    """By-type channel detail no longer exposes moderator-specific fields."""
    channel = ChannelFactory.create(is_topic=True)
    url = reverse(
        "channels:v0:channel_by_type_name_api-detail",
        kwargs={"channel_type": ChannelType.topic.name, "name": channel.name},
    )

    response = client.get(url)

    assert response.status_code == 200
    assert "is_moderator" not in response.json()


@pytest.mark.parametrize("method", ["post", "patch", "delete"])
def test_channel_write_methods_not_allowed(user_client, channel, method):
    """Channel API only supports read-only methods."""
    if method == "post":
        url = reverse("channels:v0:channels_api-list")
        response = user_client.post(url, data={"name": "biology", "title": "Biology"})
    else:
        url = reverse("channels:v0:channels_api-detail", kwargs={"id": channel.id})
        response = getattr(user_client, method)(url, data={"title": "updated"})

    assert response.status_code == 405


@pytest.mark.parametrize(
    ("published", "requested_type", "response_status"),
    [
        (True, ChannelType.topic, 200),
        (False, ChannelType.topic, 404),
        (True, ChannelType.department, 404),
        (False, ChannelType.department, 404),
    ],
)
def test_channel_by_type_name_detail(
    user_client, published, requested_type, response_status
):
    """ChannelByTypeNameDetailView should return expected result."""
    channel = ChannelFactory.create(is_topic=True, published=published)
    url = reverse(
        "channels:v0:channel_by_type_name_api-detail",
        kwargs={"channel_type": requested_type.name, "name": channel.name},
    )
    response = user_client.get(url)

    assert response.status_code == response_status


@pytest.mark.parametrize("related_count", [1, 5, 10])
def test_no_excess_by_type_name_detail_queries(
    client, django_assert_num_queries, related_count
):
    """By-type detail query count should remain constant."""
    expected_query_count = 4

    channel = ChannelFactory.create(is_topic=True)
    ChannelListFactory.create_batch(related_count, channel=channel)
    SubChannelFactory.create_batch(related_count, parent_channel=channel)

    url = reverse(
        "channels:v0:channel_by_type_name_api-detail",
        kwargs={"channel_type": ChannelType.topic.name, "name": channel.name},
    )

    with django_assert_num_queries(expected_query_count):
        response = client.get(url)

    assert response.status_code == 200
    assert response.json()["channel_url"] is not None


@pytest.mark.parametrize("related_count", [1, 5, 10])
def test_no_excess_detail_queries(
    user_client, django_assert_num_queries, related_count
):
    """Detail query count should remain constant."""
    expected_query_count = 5

    channel = ChannelFactory.create(is_topic=True)
    ChannelListFactory.create_batch(related_count, channel=channel)
    SubChannelFactory.create_batch(related_count, parent_channel=channel)

    url = reverse("channels:v0:channels_api-detail", kwargs={"id": channel.id})

    with django_assert_num_queries(expected_query_count):
        user_client.get(url)


@pytest.mark.parametrize("channel_count", [2, 20, 200])
def test_no_excess_list_queries(client, user, django_assert_num_queries, channel_count):
    """List query count should remain constant regardless of pagination volume."""
    ChannelFactory.create_batch(channel_count, is_pathway=True)

    assert Channel.objects.count() == channel_count

    client.force_login(user)
    for page in range(ceil(channel_count / 10)):
        with django_assert_num_queries(5):
            response = client.get(
                reverse("channels:v0:channels_api-list"),
                data={"limit": 10, "offset": page * 10},
            )
            assert len(response.data["results"]) == min(channel_count, 10)
            for channel in response.data["results"]:
                assert channel["channel_url"] is not None


def test_channel_counts_view(client):
    """Channel counts should return per-channel resource counts."""
    url = reverse(
        "channels:v0:channel_counts_api-list",
        kwargs={"channel_type": "unit"},
    )
    channels = ChannelFactory.create_batch(5, channel_type="unit")
    for channel in channels:
        resource_count = random.randint(1, 10)  # noqa: S311
        unit = channel.unit_detail.unit
        resources = LearningResourceFactory.create_batch(
            resource_count,
            published=True,
            resource_type="course",
            create_course=True,
            create_program=False,
        )
        for resource in resources:
            unit.learningresource_set.add(resource)
        unit.save()

    response = client.get(url)

    assert response.status_code == 200
    assert len(response.json()) == len(channels)


@pytest.fixture
def enabled_view_cache(settings, request):
    """Enable view caching for tests that assert cached responses."""
    settings.REDIS_VIEW_CACHE_DURATION = 60
    settings.CACHES = {
        **settings.CACHES,
        "redis": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": request.node.nodeid,
        },
    }


@pytest.mark.usefixtures("enabled_view_cache")
def test_channel_detail_cache_is_global(client):
    """Cached detail responses are shared globally across users."""
    channel = ChannelFactory.create(is_topic=True, title="Original title")
    url = reverse("channels:v0:channels_api-detail", kwargs={"id": channel.id})

    assert client.get(url).json()["title"] == "Original title"

    channel.title = "Updated title"
    channel.save(update_fields=["title"])

    client.force_login(UserFactory.create())
    assert client.get(url).json()["title"] == "Original title"


@pytest.mark.usefixtures("enabled_view_cache")
def test_channel_by_type_name_cache_is_global(client):
    """Cached by-type-name responses are shared globally across users."""
    channel = ChannelFactory.create(is_topic=True, title="Original title")
    url = reverse(
        "channels:v0:channel_by_type_name_api-detail",
        kwargs={"channel_type": channel.channel_type, "name": channel.name},
    )

    assert client.get(url).json()["title"] == "Original title"

    channel.title = "Updated title"
    channel.save(update_fields=["title"])

    client.force_login(UserFactory.create())
    assert client.get(url).json()["title"] == "Original title"


@pytest.mark.usefixtures("enabled_view_cache")
@pytest.mark.parametrize("is_authenticated", [False, True])
def test_channel_counts_view_is_cached(client, is_authenticated):
    """Counts endpoint should return cached payload for all users."""
    channel_count = 5
    if is_authenticated:
        client.force_login(UserFactory.create())

    channels = ChannelFactory.create_batch(channel_count, channel_type="unit")
    url = reverse(
        "channels:v0:channel_counts_api-list",
        kwargs={"channel_type": "unit"},
    )

    response = client.get(url).json()
    assert len(response) == channel_count

    for channel in channels:
        channel.delete()

    response = client.get(url).json()
    assert len(response) == channel_count


def _featured_url(channel):
    return reverse(
        "channels:v0:channel_featured_api-list",
        kwargs={"channel_type": channel.channel_type, "name": channel.name},
    )


def test_channel_featured_returns_the_list_in_its_own_order(client):
    """The path's order is the row's order, not the resources' own."""
    path = LearningPathFactory.create(resources=[]).learning_resource
    channel = ChannelFactory.create(featured_list=path)
    children = [
        LearningPathRelationshipFactory.create(parent=path, position=position).child
        for position in (2, 0, 1)
    ]

    results = client.get(_featured_url(channel)).json()["results"]

    assert [r["id"] for r in results] == [
        children[1].id,
        children[2].id,
        children[0].id,
    ]


def test_channel_featured_includes_an_unpublished_learning_path(client):
    """
    The reason this endpoint exists: editors curate these lists without
    publishing them, so the aggregated featured endpoint leaves the row empty.
    """
    path = LearningPathFactory.create(resources=[]).learning_resource
    path.published = False
    path.save(update_fields=["published"])
    channel = ChannelFactory.create(featured_list=path)
    child = LearningPathRelationshipFactory.create(parent=path).child

    results = client.get(_featured_url(channel)).json()["results"]

    assert [r["id"] for r in results] == [child.id]


def test_channel_featured_excludes_unpublished_resources(client):
    """An unpublished path is a curation state; an unpublished member is not."""
    path = LearningPathFactory.create(resources=[]).learning_resource
    channel = ChannelFactory.create(featured_list=path)
    published = LearningPathRelationshipFactory.create(parent=path, position=0).child
    hidden = LearningPathRelationshipFactory.create(parent=path, position=1).child
    hidden.published = False
    hidden.save(update_fields=["published"])

    results = client.get(_featured_url(channel)).json()["results"]

    assert [r["id"] for r in results] == [published.id]


def test_channel_featured_is_empty_without_a_configured_list(client):
    """A channel need not feature anything, which is empty rather than a 404."""
    channel = ChannelFactory.create(featured_list=None)

    response = client.get(_featured_url(channel))

    assert response.status_code == 200
    assert response.json()["results"] == []


def test_channel_featured_404s_for_an_unpublished_channel(client):
    """Matching the other channel views, which only serve published channels."""
    channel = ChannelFactory.create(published=False)

    assert client.get(_featured_url(channel)).status_code == 404


def test_channel_featured_is_scoped_to_its_own_channel(client):
    """Each channel reads its own list, not the aggregate across channels."""
    mine = LearningPathFactory.create(resources=[]).learning_resource
    theirs = LearningPathFactory.create(resources=[]).learning_resource
    channel = ChannelFactory.create(featured_list=mine)
    ChannelFactory.create(featured_list=theirs)
    child = LearningPathRelationshipFactory.create(parent=mine).child
    LearningPathRelationshipFactory.create(parent=theirs)

    results = client.get(_featured_url(channel)).json()["results"]

    assert [r["id"] for r in results] == [child.id]


def test_channel_featured_shows_a_repeated_resource_once(client):
    """
    Nothing stops a list holding the same resource twice, and the row should
    still show it once -- at the first place the list puts it.
    """
    path = LearningPathFactory.create(resources=[]).learning_resource
    channel = ChannelFactory.create(featured_list=path)
    repeated = LearningResourceFactory.create()
    other = LearningResourceFactory.create()
    LearningPathRelationshipFactory.create(parent=path, child=repeated, position=0)
    LearningPathRelationshipFactory.create(parent=path, child=other, position=1)
    LearningPathRelationshipFactory.create(parent=path, child=repeated, position=2)

    body = client.get(_featured_url(channel)).json()

    assert [r["id"] for r in body["results"]] == [repeated.id, other.id]
    assert body["count"] == 2
