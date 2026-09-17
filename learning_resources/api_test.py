"""Tests for learning_resources APIs"""

import pytest
from django.conf import settings
from django.db import IntegrityError, transaction

from learning_resources.api import (
    sync_website_content_to_learning_resource,
    unpublish_website_content_learning_resource,
    website_content_readable_id,
)
from learning_resources.constants import LearningResourceType
from learning_resources.factories import LearningResourceTopicFactory
from learning_resources.models import LearningResource
from website_content.factories import WebsiteContentFactory

pytestmark = [pytest.mark.django_db]


@pytest.fixture(autouse=True)
def mock_upserted(mocker):
    """Mock the search hand-off; that end of the sync is covered elsewhere."""
    return mocker.patch("learning_resources.api.resource_upserted_actions")


@pytest.fixture(autouse=True)
def mock_unpublished(mocker):
    """Mock the search hand-off for the removal path."""
    return mocker.patch("learning_resources.api.resource_unpublished_actions")


def _published_content(**kwargs):
    return WebsiteContentFactory.create(is_published=True, **kwargs)


def test_sync_creates_an_article_resource(mock_upserted):
    """A published item becomes a published article resource, and is indexed."""
    content = _published_content(title="A Topical Article", content_type="article")

    resource = sync_website_content_to_learning_resource(content)

    assert resource.resource_type == LearningResourceType.article.name
    assert resource.resource_category == LearningResourceType.article.value
    assert resource.readable_id == website_content_readable_id(content.id)
    assert resource.title == "A Topical Article"
    assert resource.published is True
    # Editorial content has no external platform or offeror, and is not ETL'd.
    assert resource.platform is None
    assert resource.offered_by is None
    assert resource.etl_source == ""
    mock_upserted.assert_called_once()


def test_sync_stores_an_absolute_url():
    """`get_url` is relative; the resource's url has to be resolvable on its own."""
    content = _published_content(title="Linkable", content_type="article")

    resource = sync_website_content_to_learning_resource(content)

    assert content.get_url() is not None
    assert resource.url == f"{settings.APP_BASE_URL.rstrip('/')}{content.get_url()}"


def test_sync_flattens_the_content_into_the_description():
    """Body text reaches the description so the resource is keyword-searchable."""
    content = _published_content(
        content={
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "Climate models"},
                        {"type": "text", "text": " and their limits"},
                    ],
                }
            ],
        },
    )

    resource = sync_website_content_to_learning_resource(content)

    assert resource.description == "Climate models and their limits"


def test_sync_expands_topics_to_their_ancestors():
    """
    The editor stores only the leaves it picked, so the resource is where the
    ancestor chain gets filled in -- that is what topic filtering searches on.
    """
    grandparent = LearningResourceTopicFactory.create(name="Science")
    parent = LearningResourceTopicFactory.create(name="Physics", parent=grandparent)
    leaf = LearningResourceTopicFactory.create(name="Optics", parent=parent)
    content = _published_content()
    content.topics.set([leaf])

    resource = sync_website_content_to_learning_resource(content)

    assert sorted(resource.topics.values_list("name", flat=True)) == [
        "Optics",
        "Physics",
        "Science",
    ]


def test_sync_is_idempotent_and_updates_in_place():
    """Re-publishing the same item must not leave a second resource behind."""
    content = _published_content(title="First title")

    first = sync_website_content_to_learning_resource(content)
    content.title = "Second title"
    content.save()
    second = sync_website_content_to_learning_resource(content)

    assert first.id == second.id
    assert second.title == "Second title"
    assert (
        LearningResource.objects.filter(
            readable_id=website_content_readable_id(content.id)
        ).count()
        == 1
    )


def test_sync_drops_a_deselected_topic():
    """Topics are replaced, not accumulated, when the editor removes one."""
    kept, removed = LearningResourceTopicFactory.create_batch(2)
    content = _published_content()
    content.topics.set([kept, removed])
    sync_website_content_to_learning_resource(content)

    content.topics.set([kept])
    resource = sync_website_content_to_learning_resource(content)

    assert list(resource.topics.values_list("id", flat=True)) == [kept.id]


def test_unpublish_marks_the_resource_unpublished(mock_unpublished):
    """The row is kept and unpublished, so republishing restores it in place."""
    content = _published_content()
    resource = sync_website_content_to_learning_resource(content)

    unpublish_website_content_learning_resource(content.id)

    resource.refresh_from_db()
    assert resource.published is False
    mock_unpublished.assert_called_once_with(resource)


def test_unpublish_without_a_resource_is_a_noop(mock_unpublished):
    """A draft never had a resource; unpublishing it must not raise."""
    content = WebsiteContentFactory.create(is_published=False)

    unpublish_website_content_learning_resource(content.id)

    assert mock_unpublished.called is False


def test_republishing_restores_the_same_resource():
    """The unpublished row is reused rather than a second one created."""
    content = _published_content()
    original = sync_website_content_to_learning_resource(content)
    unpublish_website_content_learning_resource(content.id)

    restored = sync_website_content_to_learning_resource(content)

    assert restored.id == original.id
    assert restored.published is True


def test_a_second_resource_for_the_same_content_is_rejected():
    """
    Two concurrent syncs of one item must not each insert a row.

    `unique_together` spans `platform`, which these rows leave NULL, and
    Postgres treats NULLs in a unique index as distinct -- so it rejects
    nothing here. Only the partial index on the readable_id prefix does, and
    without it every later sync for the item would fail with
    MultipleObjectsReturned.
    """
    content = _published_content()
    sync_website_content_to_learning_resource(content)

    with pytest.raises(IntegrityError), transaction.atomic():
        LearningResource.objects.create(
            platform=None,
            readable_id=website_content_readable_id(content.id),
            resource_type=LearningResourceType.article.name,
            title="duplicate",
            resource_category=LearningResourceType.article.value,
            published=True,
        )

    assert (
        LearningResource.objects.filter(
            readable_id=website_content_readable_id(content.id)
        ).count()
        == 1
    )


def test_the_unique_index_does_not_catch_lookalike_ids():
    """
    `_` is a single-character wildcard in LIKE, so an unescaped prefix would
    index ids such as `websiteXcontent:1` too and reject duplicates of rows
    this has no business constraining.
    """
    shared = {
        "platform": None,
        "readable_id": "websiteXcontent:1",
        "resource_type": LearningResourceType.article.name,
        "resource_category": LearningResourceType.article.value,
        "published": True,
    }
    LearningResource.objects.create(title="one", **shared)
    # Raises IntegrityError if the index predicate is not escaped.
    LearningResource.objects.create(title="two", **shared)

    assert LearningResource.objects.filter(readable_id="websiteXcontent:1").count() == 2
