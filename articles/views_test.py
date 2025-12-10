"""Test for articles views"""

import pytest
from rest_framework.reverse import reverse

from articles.models import Article
from main.factories import UserFactory

pytestmark = [pytest.mark.django_db]


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


@pytest.mark.parametrize("is_staff", [True, False])
def test_article_permissions(client, is_staff):
    user = UserFactory.create(is_staff=True)
    client.force_login(user)
    url = reverse("articles:v1:articles-list")
    resp = client.get(url)
    resp.json()
    assert resp.status_code == 200 if is_staff else 403


def test_retrieve_article_by_id(client, user):
    """Should retrieve published article by numeric ID"""
    article = Article.objects.create(
        title="Test Article",
        content={},
        is_published=True,
        user=user,
    )

    url = reverse(
        "articles:v1:article-detail-by-id-or-slug",
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
        "articles:v1:article-detail-by-id-or-slug",
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
        "articles:v1:article-detail-by-id-or-slug",
        kwargs={"identifier": str(article.id)},
    )

    resp = client.get(url)
    data = resp.json()

    assert resp.status_code == 200
    assert data["id"] == article.id
