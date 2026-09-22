"""Test for website_content views"""

import pytest
from django.db import transaction
from rest_framework.reverse import reverse

from learning_resources.factories import LearningResourceTopicFactory
from main.factories import UserFactory
from website_content.models import WebsiteContent

pytestmark = [pytest.mark.django_db]


@pytest.fixture(autouse=True)
def _mock_cdn_purge(mocker):
    """Auto-mock CDN purge tasks for all tests in this module"""
    mocker.patch("website_content.tasks.fastly_purge_relative_url")
    mocker.patch("website_content.tasks.fastly_purge_relative_url.delay")
    mocker.patch("website_content.tasks.fastly_purge_website_content_list.delay")


@pytest.fixture(autouse=True)
def _mock_learning_resource_sync(mocker):
    """
    Auto-mock the learning resource sync for all tests in this module.

    Publishing fires the website_content plugins, and the search indexing one
    end of that reaches OpenSearch -- which the autouse `opensearch` fixture
    only mocks for reads. None of the tests here are about search; the sync
    itself is covered in `learning_resources`.
    """
    mocker.patch(
        "learning_resources.tasks.sync_website_content_learning_resource.delay"
    )
    # The unpublish direction runs in the request rather than in the task, so
    # the function is what has to be stubbed here; the task remains the
    # fallback for a transient database error.
    mocker.patch("learning_resources.api.unpublish_website_content_learning_resource")
    mocker.patch(
        "learning_resources.tasks.unpublish_website_content_learning_resource_task.delay"
    )


def test_website_content_creation(staff_client, user):
    """Test website content creation."""
    url = reverse("website_content:v1:website_content-list")
    data = {
        "content": {},
        "title": "Some title",
        "content_type": "news",
    }
    resp = staff_client.post(url, data)
    json = resp.json()
    assert json["content"] == {}
    assert json["title"] == "Some title"
    assert json["content_type"] == "news"


def test_website_content_creation_via_articles_alias(staff_client, user):
    """Test that the backward-compatible /api/v1/articles/ endpoint still works."""
    url = reverse("website_content:v1:articles-list")
    data = {
        "content": {},
        "title": "Articles alias title",
        "content_type": "news",
    }
    resp = staff_client.post(url, data)
    json = resp.json()
    assert resp.status_code == 201
    assert json["title"] == "Articles alias title"


def test_retrieve_content_by_id(client, user):
    """Should retrieve published content by numeric ID"""
    content = WebsiteContent.objects.create(
        title="Test Article",
        content={},
        is_published=True,
        user=user,
        content_type="news",
    )

    url = reverse(
        "website_content:v1:website_content-detail-by-id-or-slug",
        kwargs={"identifier": str(content.id)},
    )

    resp = client.get(url)
    data = resp.json()

    assert resp.status_code == 200
    assert data["id"] == content.id
    assert data["title"] == "Test Article"


def test_retrieve_content_by_slug(client, user):
    """Should retrieve published content by slug"""
    content = WebsiteContent.objects.create(
        title="Slug Article",
        content={},
        is_published=True,
        user=user,
        content_type="news",
    )

    url = reverse(
        "website_content:v1:website_content-detail-by-id-or-slug",
        kwargs={"identifier": content.slug},
    )

    resp = client.get(url)
    data = resp.json()

    assert resp.status_code == 200
    assert data["slug"] == content.slug
    assert data["title"] == "Slug Article"


def test_staff_can_access_unpublished_content(client):
    """Staff should be able to see unpublished content items"""
    staff_user = UserFactory.create(is_staff=True)
    client.force_login(staff_user)

    content = WebsiteContent.objects.create(
        title="Draft Article",
        content={},
        is_published=False,
        user=staff_user,
        content_type="news",
    )

    url = reverse(
        "website_content:v1:website_content-detail-by-id-or-slug",
        kwargs={"identifier": str(content.id)},
    )

    resp = client.get(url)
    data = resp.json()

    assert resp.status_code == 200
    assert data["id"] == content.id


@pytest.fixture
def mock_clear_views_cache(mocker):
    """Patch the cache-clear hook so tests can assert whether it fired."""
    return mocker.patch("website_content.views.clear_views_cache")


def _make_content(user, *, is_published):
    return WebsiteContent.objects.create(
        title="t",
        content={},
        is_published=is_published,
        user=user,
        content_type="news",
    )


# The staff listing view is cached and includes unpublished content, so every
# mutation must clear the view cache -- including on drafts. The is_published
# parametrization guards against reintroducing a published-only gate.
@pytest.mark.parametrize("is_published", [True, False])
def test_create_clears_views_cache(
    staff_client,
    mock_clear_views_cache,
    django_capture_on_commit_callbacks,
    is_published,
):
    """Create clears the view cache on commit, published or draft."""
    url = reverse("website_content:v1:website_content-list")
    data = {
        "content": {},
        "title": "Some title",
        "content_type": "news",
        "is_published": is_published,
    }
    with django_capture_on_commit_callbacks(execute=True):
        resp = staff_client.post(url, data, format="json")

    assert resp.status_code == 201
    assert mock_clear_views_cache.called is True


@pytest.mark.parametrize("now_published", [True, False])
def test_update_clears_views_cache(
    staff_client,
    user,
    mock_clear_views_cache,
    django_capture_on_commit_callbacks,
    now_published,
):
    """Update clears the view cache on commit, even a draft-to-draft edit."""
    content = _make_content(user, is_published=False)
    url = reverse(
        "website_content:v1:website_content-detail", kwargs={"pk": content.id}
    )
    with django_capture_on_commit_callbacks(execute=True):
        resp = staff_client.patch(url, {"is_published": now_published}, format="json")

    assert resp.status_code == 200
    assert mock_clear_views_cache.called is True


def test_destroy_draft_soft_deletes(
    staff_client,
    user,
    mock_clear_views_cache,
    django_capture_on_commit_callbacks,
):
    """Deleting a draft soft-deletes it and clears the view cache on commit."""
    content = _make_content(user, is_published=False)
    url = reverse(
        "website_content:v1:website_content-detail", kwargs={"pk": content.id}
    )
    with django_capture_on_commit_callbacks(execute=True):
        resp = staff_client.delete(url)

    assert resp.status_code == 204
    assert mock_clear_views_cache.called is True

    # Row is kept in the DB but marked deleted.
    content.refresh_from_db()
    assert content.deleted is not None


def test_soft_deleted_content_hidden_from_api(staff_client, user):
    """Soft-deleted items are excluded from list and detail endpoints."""
    content = _make_content(user, is_published=False)
    staff_client.delete(
        reverse("website_content:v1:website_content-detail", kwargs={"pk": content.id})
    )

    list_url = reverse("website_content:v1:website_content-list")
    list_ids = [item["id"] for item in staff_client.get(list_url).json()["results"]]
    assert content.id not in list_ids

    detail_url = reverse(
        "website_content:v1:website_content-detail-by-id-or-slug",
        kwargs={"identifier": str(content.id)},
    )
    assert staff_client.get(detail_url).status_code == 404


def test_destroy_published_rejected(staff_client, user):
    """Published content cannot be deleted; the row is left untouched."""
    content = _make_content(user, is_published=True)
    url = reverse(
        "website_content:v1:website_content-detail", kwargs={"pk": content.id}
    )
    resp = staff_client.delete(url)

    assert resp.status_code == 400
    content.refresh_from_db()
    assert content.deleted is None


def test_destroy_forbidden_for_non_editor(client, user):
    """A non-staff, non-editor user cannot delete content."""
    normal_user = UserFactory.create(is_staff=False)
    client.force_login(normal_user)

    content = _make_content(user, is_published=False)
    url = reverse(
        "website_content:v1:website_content-detail", kwargs={"pk": content.id}
    )
    resp = client.delete(url)

    assert resp.status_code == 403
    content.refresh_from_db()
    assert content.deleted is None


def test_content_type_filter(client, user):
    """content_type query param should filter results"""
    WebsiteContent.objects.create(
        title="News piece",
        content={},
        is_published=True,
        user=user,
        content_type="news",
    )
    WebsiteContent.objects.create(
        title="Article piece",
        content={},
        is_published=True,
        user=user,
        content_type="article",
    )

    url = reverse("website_content:v1:website_content-list") + "?content_type=news"
    resp = client.get(url)
    results = resp.json()["results"]

    assert all(r["content_type"] == "news" for r in results)
    assert len(results) == 1


@pytest.mark.parametrize("limit", [2, 10])
def test_list_query_count_is_constant(client, django_assert_num_queries, limit):
    """Listing costs the same number of queries whatever the page size."""
    for content_user in [*UserFactory.create_batch(5), None]:
        WebsiteContent.objects.create(
            title="t",
            content={},
            is_published=True,
            user=content_user,
            content_type="news",
        )

    url = reverse("website_content:v1:website_content-list")
    # Count, page, and one more for the topics prefetch -- all independent of
    # the page size, which is what this is guarding.
    with django_assert_num_queries(3):
        results = client.get(url, {"limit": limit}).json()["results"]

    assert len(results) == min(limit, 6)
    # The most recently published item has no user; a nullable FK still has to
    # serialize, which a select_related() join preserves and an inner join wouldn't.
    assert results[0]["user"] is None


@pytest.mark.parametrize(
    "case",
    [
        # each case is was_published, then now_published, then whether the
        # unpublish actions should fire
        (True, False, True),  # the unpublish transition
        (True, True, False),  # still published
        (False, False, False),  # draft edit, never published
        (False, True, False),  # publishing
    ],
)
def test_update_triggers_unpublish_actions_only_on_the_transition(
    staff_client,
    user,
    mocker,
    django_capture_on_commit_callbacks,
    case,
):
    """
    Tearing down the news feed entry must key off the published->unpublished
    transition, which the saved instance alone cannot reveal.
    """
    was_published, now_published, expect_unpublish_actions = case
    mocker.patch("website_content.views.clear_views_cache")
    mock_unpublish = mocker.patch("website_content.views.content_unpublished_actions")
    # purge_content_on_save skips unpublished content, so the unpublish
    # transition owns clearing the CDN for the page and its listing.
    mock_purge = mocker.patch("website_content.views.purge_content_on_unpublish")
    content = _make_content(user, is_published=was_published)
    url = reverse(
        "website_content:v1:website_content-detail", kwargs={"pk": content.id}
    )

    with django_capture_on_commit_callbacks(execute=True):
        resp = staff_client.patch(url, {"is_published": now_published}, format="json")

    assert resp.status_code == 200
    assert mock_unpublish.called is expect_unpublish_actions
    assert mock_purge.called is expect_unpublish_actions


def test_unpublish_removes_the_news_feed_entry_inline(staff_client, user):
    """
    The feed entry is gone by the time the unpublish request answers.

    The news listing refetches the moment it returns, so an entry left for a
    worker to remove comes straight back to the editor who just unpublished it.
    No worker runs here and no on_commit callback is executed: the removal has
    to have happened during the request itself.
    """
    from news_events.etl.articles_news import (
        sync_single_website_content_news_to_news,
        website_content_feed_guid,
    )
    from news_events.models import FeedItem

    content = _make_content(user, is_published=True)
    sync_single_website_content_news_to_news(content)
    guid = website_content_feed_guid(content.id)
    assert FeedItem.objects.filter(guid=guid).exists()
    url = reverse(
        "website_content:v1:website_content-detail", kwargs={"pk": content.id}
    )

    resp = staff_client.patch(url, {"is_published": False}, format="json")

    assert resp.status_code == 200
    assert not FeedItem.objects.filter(guid=guid).exists()


@pytest.mark.django_db(transaction=True)
def test_unpublish_hooks_run_outside_a_transaction(staff_client, user, mocker):
    """
    The unpublish hooks must not run inside a transaction.

    They do two things that are only safe in autocommit: a synchronous call out
    to Qdrant, which would otherwise hold a transaction open across network
    I/O, and swallowing a `DatabaseError` to fall back to a queued task, which
    inside an atomic block would poison the transaction instead -- the fallback
    would never be queued, and the next query would raise
    `TransactionManagementError`.

    Nothing here asks for a transaction today, so this asserts the property
    rather than trusting it: enabling `ATOMIC_REQUESTS` (or wrapping the view)
    breaks the assumption, and this is what says so.
    """
    seen = {}

    def record(*, content):
        connection = transaction.get_connection()
        seen["in_atomic_block"] = connection.in_atomic_block
        seen["autocommit"] = connection.get_autocommit()

    mocker.patch("website_content.views.content_unpublished_actions", record)
    mocker.patch("website_content.views.clear_views_cache")
    content = _make_content(user, is_published=True)
    url = reverse(
        "website_content:v1:website_content-detail", kwargs={"pk": content.id}
    )

    resp = staff_client.patch(url, {"is_published": False}, format="json")

    assert resp.status_code == 200
    assert seen == {"in_atomic_block": False, "autocommit": True}


@pytest.mark.django_db(transaction=True)
def test_unpublish_clears_the_view_cache_after_removing_the_feed_entry(
    staff_client, user, mocker
):
    """
    The cached news listing is dropped only once the entry it contains is gone.

    Cleared any earlier, a request landing in between re-caches the listing
    that still holds the story, which then outlives the unpublish by the whole
    cache duration. Needs a real commit: inside the usual test transaction
    every on_commit callback is deferred to the end regardless of order.
    """
    from news_events.etl.articles_news import (
        sync_single_website_content_news_to_news,
        website_content_feed_guid,
    )
    from news_events.models import FeedItem

    content = _make_content(user, is_published=True)
    sync_single_website_content_news_to_news(content)
    guid = website_content_feed_guid(content.id)
    seen = {}

    mocker.patch(
        "website_content.views.clear_views_cache",
        side_effect=lambda: seen.update(
            feed_entry=FeedItem.objects.filter(guid=guid).exists()
        ),
    )
    url = reverse(
        "website_content:v1:website_content-detail", kwargs={"pk": content.id}
    )

    resp = staff_client.patch(url, {"is_published": False}, format="json")

    assert resp.status_code == 200
    assert seen == {"feed_entry": False}


def test_create_with_topics(staff_client):
    """Topics sent on create are persisted and echoed back."""
    topics = LearningResourceTopicFactory.create_batch(2)
    expected = sorted(topic.id for topic in topics)
    url = reverse("website_content:v1:website_content-list")

    resp = staff_client.post(
        url,
        {
            "content": {},
            "title": "Topical",
            "content_type": "news",
            "topics": expected,
        },
        format="json",
    )

    assert resp.status_code == 201
    # `topics` is in the serializer's required_prefetches, and a write leaves
    # nothing prefetched on its own -- a created instance has no prefetch cache
    # at all. The response can serialize them because `perform_create` hands
    # the serializer a freshly prefetched instance; without that this is a 500.
    assert sorted(resp.json()["topics"]) == expected
    content = WebsiteContent.objects.get(id=resp.json()["id"])
    assert sorted(content.topics.values_list("id", flat=True)) == expected


def test_patch_replaces_topics(staff_client, user):
    """PATCHing topics replaces the selection rather than adding to it."""
    old_topic, new_topic = LearningResourceTopicFactory.create_batch(2)
    content = _make_content(user, is_published=False)
    content.topics.set([old_topic])
    url = reverse(
        "website_content:v1:website_content-detail", kwargs={"pk": content.id}
    )

    resp = staff_client.patch(url, {"topics": [new_topic.id]}, format="json")

    assert resp.status_code == 200
    assert resp.json()["topics"] == [new_topic.id]
    assert list(content.topics.values_list("id", flat=True)) == [new_topic.id]


def test_patch_without_topics_leaves_them_alone(staff_client, user):
    """
    The field is optional, so an unrelated PATCH -- which is what the drawer
    sends when the editor only renames -- must not wipe existing selections.
    """
    topic = LearningResourceTopicFactory.create()
    content = _make_content(user, is_published=False)
    content.topics.set([topic])
    url = reverse(
        "website_content:v1:website_content-detail", kwargs={"pk": content.id}
    )

    resp = staff_client.patch(url, {"title": "Renamed"}, format="json")

    assert resp.status_code == 200
    assert list(content.topics.values_list("id", flat=True)) == [topic.id]


@pytest.mark.parametrize("bad_topics", [[-1], ["not-a-number"], "news"])
def test_create_with_invalid_topics_rejected(staff_client, bad_topics):
    """
    Resolving all the ids in one query must still reject the payloads the
    per-id lookup would have: a missing topic, a non-numeric id, and a bare
    string where a list belongs.
    """
    url = reverse("website_content:v1:website_content-list")

    resp = staff_client.post(
        url,
        {
            "content": {},
            "title": "Topical",
            "content_type": "news",
            "topics": bad_topics,
        },
        format="json",
    )

    assert resp.status_code == 400
    assert "topics" in resp.json()


def test_retrieve_returns_topics(client, user):
    """Topics are readable by anonymous users on published content."""
    topic = LearningResourceTopicFactory.create()
    content = _make_content(user, is_published=True)
    content.topics.set([topic])

    url = reverse(
        "website_content:v1:website_content-detail-by-id-or-slug",
        kwargs={"identifier": str(content.id)},
    )
    resp = client.get(url)

    assert resp.status_code == 200
    assert resp.json()["topics"] == [topic.id]
