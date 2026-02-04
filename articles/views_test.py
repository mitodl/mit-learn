"""Test for articles views"""

import pytest
from rest_framework.reverse import reverse

from articles.models import Article
from main.factories import UserFactory

pytestmark = [pytest.mark.django_db]


@pytest.fixture(autouse=True)
def _mock_cdn_purge(mocker):
    """Auto-mock CDN purge tasks for all tests in this module"""
    mocker.patch("articles.tasks.queue_fastly_purge_article.delay")
    mocker.patch("articles.tasks.queue_fastly_purge_articles_list.delay")


def test_article_creation(staff_client, user):
    """Test article creation HTML sanitization."""

    url = reverse("articles:v1:articles-list")
    data = {
        "content": {},
        "title": "Some title",
    }
    resp = staff_client.post(url, data)
    json = resp.json()
    assert json["content"] == {}
    assert json["title"] == "Some title"


def test_retrieve_article_by_id(client, user):
    """Should retrieve published article by numeric ID"""
    article = Article.objects.create(
        title="Test Article",
        content={},
        is_published=True,
        user=user,
    )

    url = reverse(
        "articles:v1:articles-detail-by-id-or-slug",
        kwargs={"identifier": str(article.id)},
    )

    resp = client.get(url)
    data = resp.json()

    assert resp.status_code == 200
    assert data["id"] == article.id
    assert data["title"] == "Test Article"


def test_retrieve_article_by_slug(client, user):
    """Should retrieve published article by slug"""
    article = Article.objects.create(
        title="Slug Article",
        content={},
        is_published=True,
        user=user,
    )

    url = reverse(
        "articles:v1:articles-detail-by-id-or-slug",
        kwargs={"identifier": article.slug},
    )

    resp = client.get(url)
    data = resp.json()

    assert resp.status_code == 200
    assert data["slug"] == article.slug
    assert data["title"] == "Slug Article"


def test_staff_can_access_unpublished_article(client):
    """Staff should be able to see unpublished articles"""
    staff_user = UserFactory.create(is_staff=True)
    client.force_login(staff_user)

    article = Article.objects.create(
        title="Draft Article",
        content={},
        is_published=False,
        user=staff_user,
    )

    url = reverse(
        "articles:v1:articles-detail-by-id-or-slug",
        kwargs={"identifier": str(article.id)},
    )

    resp = client.get(url)
    data = resp.json()

    assert resp.status_code == 200
    assert data["id"] == article.id
