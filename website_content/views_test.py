"""Test for website_content views"""

import pytest
from rest_framework.reverse import reverse

from main.factories import UserFactory
from website_content.models import WebsiteContent

pytestmark = [pytest.mark.django_db]


@pytest.fixture(autouse=True)
def _mock_cdn_purge(mocker):
    """Auto-mock CDN purge tasks for all tests in this module"""
    mocker.patch("website_content.tasks.fastly_purge_relative_url")
    mocker.patch("website_content.tasks.fastly_purge_relative_url.delay")
    mocker.patch("website_content.tasks.fastly_purge_website_content_list.delay")


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
