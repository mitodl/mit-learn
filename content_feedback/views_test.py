"""Tests for content_feedback views."""

import pytest
from django.urls import reverse

from content_feedback.factories import ContentFeedbackFactory
from content_feedback.models import ContentFeedback

pytestmark = pytest.mark.django_db


def _payload(**overrides):
    """Return a valid content feedback POST body."""
    payload = {
        "course_id": "course-v1:MITx+6.00+2T2026",
        "course_name": "Introduction to Computer Science",
        "block_usage_key": "block-v1:MITx+6.00+2T2026+type@video+block@abc123",
        "block_type": "video",
        "block_display_name": "Lecture 3: Recursion",
        "unit_title": "Recursion and Dictionaries",
        "url": "https://apps.mitxonline.mit.edu/learn/course/x/y/abc123",
        "sentiment": "positive",
        "comment": "Very clear explanation.",
    }
    payload.update(overrides)
    return payload


def test_submit_requires_authentication(client):
    """Anonymous users cannot submit feedback."""
    response = client.post(reverse("content_feedback:v0:content_feedback"), _payload())
    assert response.status_code in (401, 403)
    assert ContentFeedback.objects.count() == 0


def test_submit_creates_record_for_user(user_client, user):
    """A valid submission persists a record owned by the request user."""
    response = user_client.post(
        reverse("content_feedback:v0:content_feedback"), _payload()
    )
    assert response.status_code == 201
    assert ContentFeedback.objects.count() == 1
    feedback = ContentFeedback.objects.get()
    assert feedback.user == user
    assert feedback.sentiment == "positive"
    assert feedback.block_display_name == "Lecture 3: Recursion"


def test_user_not_client_settable(user_client, user):
    """A client-supplied user field is ignored; the request user is used."""
    response = user_client.post(
        reverse("content_feedback:v0:content_feedback"),
        _payload(user=999999),
    )
    assert response.status_code == 201
    assert ContentFeedback.objects.get().user == user


@pytest.mark.parametrize("missing", ["course_id", "block_usage_key", "sentiment"])
def test_required_fields(user_client, missing):
    """course_id, block_usage_key and sentiment are required."""
    payload = _payload()
    payload.pop(missing)
    response = user_client.post(
        reverse("content_feedback:v0:content_feedback"), payload
    )
    assert response.status_code == 400
    assert missing in response.json()


def test_invalid_sentiment_rejected(user_client):
    """An unknown sentiment value is rejected."""
    response = user_client.post(
        reverse("content_feedback:v0:content_feedback"),
        _payload(sentiment="angry"),
    )
    assert response.status_code == 400
    assert "sentiment" in response.json()


def test_resubmit_appends_new_record(user_client, user):
    """Append-only: resubmitting on the same block keeps every submission."""
    url = reverse("content_feedback:v0:content_feedback")
    user_client.post(url, _payload(sentiment="positive", comment="first"))
    user_client.post(url, _payload(sentiment="negative", comment="changed my mind"))

    feedback = ContentFeedback.objects.filter(user=user).order_by("created_on")
    assert feedback.count() == 2
    assert [f.sentiment for f in feedback] == ["positive", "negative"]
    # Latest-by-timestamp is the actionable record; history is preserved.
    assert feedback.last().comment == "changed my mind"


def test_different_blocks_create_separate_rows(user_client, user):
    """Feedback on distinct blocks is kept separate."""
    url = reverse("content_feedback:v0:content_feedback")
    user_client.post(url, _payload(block_usage_key="block-v1:MITx+type@video+block@a"))
    user_client.post(url, _payload(block_usage_key="block-v1:MITx+type@video+block@b"))
    assert ContentFeedback.objects.filter(user=user).count() == 2


def test_comment_truncated(user_client):
    """Over-long comments are truncated rather than rejected."""
    response = user_client.post(
        reverse("content_feedback:v0:content_feedback"),
        _payload(comment="x" * 5000),
    )
    assert response.status_code == 201
    assert len(ContentFeedback.objects.get().comment) == 1000


def test_factory_builds_valid_record():
    """The factory produces a persistable record."""
    feedback = ContentFeedbackFactory.create()
    assert feedback.pk is not None
    assert feedback.sentiment in ("positive", "negative", "idea")
