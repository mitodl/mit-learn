"""Tests for content_feedback views."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

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


def test_submit_allows_anonymous():
    """Anonymous users can submit without a CSRF token; the record has no user."""
    # enforce_csrf_checks=True mirrors production SessionAuthentication: CSRF is
    # only enforced for session-authenticated callers, so an anonymous POST with
    # no token still succeeds.
    client = APIClient(enforce_csrf_checks=True)
    response = client.post(reverse("content_feedback:v0:content_feedback"), _payload())
    assert response.status_code == 201
    assert ContentFeedback.objects.count() == 1
    assert ContentFeedback.objects.get().user is None


def test_authenticated_without_csrf_token_rejected(user):
    """A session-authenticated POST without a CSRF token is rejected (403)."""
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(user)
    response = client.post(reverse("content_feedback:v0:content_feedback"), _payload())
    assert response.status_code == 403
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


def test_submit_rate_limited(user_client, mocker):
    """Exceeding the per-user rate returns 429; a different user is unaffected."""
    from django.core.cache.backends.locmem import LocMemCache

    from main.factories import UserFactory
    from main.throttles import RedisScopedRateThrottle

    mocker.patch.object(
        RedisScopedRateThrottle, "cache", LocMemCache("throttle-test", {})
    )
    mocker.patch.object(
        RedisScopedRateThrottle, "THROTTLE_RATES", {"content_feedback": "2/min"}
    )

    url = reverse("content_feedback:v0:content_feedback")
    assert user_client.post(url, _payload()).status_code == 201
    assert user_client.post(url, _payload()).status_code == 201
    response = user_client.post(url, _payload())
    assert response.status_code == 429
    assert response.json()["error_type"] == "Throttled"

    # The limit is keyed per authenticated user: a different user still gets
    # through even after the first user is throttled. (The user_client fixture
    # shares one APIClient, so build a distinct client for the second user.)
    other_client = APIClient()
    other_client.force_login(UserFactory.create())
    assert other_client.post(url, _payload()).status_code == 201


def test_anonymous_throttle_ignores_spoofed_xff(mocker):
    """A rotating client-supplied X-Forwarded-For cannot bypass the anon limit.

    Anonymous requests key on the real client IP, which our infrastructure
    (APISIX + nginx = NUM_PROXIES hops) appends to X-Forwarded-For. A client can
    prepend anything to that header, so the throttle must ignore the spoofable
    left side and key on the trusted entry (mitodl/hq#12775).
    """
    from django.core.cache.backends.locmem import LocMemCache

    from main.throttles import RedisScopedRateThrottle

    mocker.patch.object(
        RedisScopedRateThrottle, "cache", LocMemCache("throttle-test", {})
    )
    mocker.patch.object(
        RedisScopedRateThrottle, "THROTTLE_RATES", {"content_feedback": "2/min"}
    )

    url = reverse("content_feedback:v0:content_feedback")
    client = APIClient(enforce_csrf_checks=True)

    # Same real client (203.0.113.5) and trusted proxy (10.0.0.1); only the
    # spoofable, client-controlled left entry rotates. All three share a bucket.
    def post(spoofed_ip):
        return client.post(
            url,
            _payload(),
            HTTP_X_FORWARDED_FOR=f"{spoofed_ip}, 203.0.113.5, 10.0.0.1",
        )

    assert post("9.9.9.1").status_code == 201
    assert post("9.9.9.2").status_code == 201
    assert post("9.9.9.3").status_code == 429
