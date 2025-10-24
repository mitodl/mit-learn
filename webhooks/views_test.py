import hashlib
import hmac
import json

import pytest
from django.urls import reverse

from learning_resources.etl.constants import ETLSource
from learning_resources.factories import LearningResourceFactory
from learning_resources.models import LearningResource


def get_secret(data, settings):
    if isinstance(data, str):
        payload = data.encode("utf-8")
    else:
        payload = json.dumps(data).encode("utf-8")
    return hmac.new(
        settings.WEBHOOK_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()


@pytest.mark.django_db
def test_content_file_delete_webhook_view_canvas_success(
    settings,
    client,
    mocker,
    django_user_model,
):
    """
    Test ContentFileDeleteWebhookView processes Canvas delete webhook successfully
    """

    url = reverse("webhooks:v1:content_file_delete_webhook")
    resource = LearningResourceFactory.create(
        etl_source=ETLSource.canvas.name, readable_id="123-canvas"
    )
    mock_unpublish = mocker.patch("webhooks.views.resource_delete_actions")

    data = {
        "source": ETLSource.canvas.name,
        "course_id": "123",
    }
    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )
    assert response.status_code == 200
    assert mock_unpublish.mock_calls[0].args[0].readable_id == resource.readable_id


@pytest.mark.django_db
def test_content_file_delete_webhook_view_canvas_resource_not_found(
    settings, client, mocker
):
    """
    Test ContentFileDeleteWebhookView handles missing resource gracefully
    """
    url = reverse("webhooks:v1:content_file_delete_webhook")
    mocker.patch(
        "learning_resources.models.LearningResource.objects.get",
        side_effect=LearningResource.DoesNotExist,
    )
    mocker.patch("webhooks.views.resource_delete_actions")
    mock_log = mocker.patch("webhooks.views.log")
    data = {
        "source": ETLSource.canvas.name,
        "course_id": "canvas-course-404",
    }
    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )
    assert response.status_code == 200
    assert mock_log.warning.called
    assert "does not exist" in mock_log.warning.call_args[0][0]


@pytest.mark.django_db
def test_content_file_webhook_view_canvas_success(settings, client, mocker):
    """
    Test ContentFileWebhookView processes Canvas create webhook successfully
    """
    url = reverse("webhooks:v1:content_file_webhook")
    mock_ingest = mocker.patch("webhooks.views.ingest_canvas_course.apply_async")

    data = {
        "source": ETLSource.canvas.name,
        "content_path": "/path/to/canvas/course.tar.gz",
    }
    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )
    assert response.status_code == 200
    mock_ingest.assert_called_once_with(["/path/to/canvas/course.tar.gz", False])


@pytest.mark.django_db
def test_video_short_webhook_view_creates_new(
    settings, client, sample_youtube_metadata
):
    """Test VideoShortWebhookView creates a new VideoShort"""
    from video_shorts.models import VideoShort

    settings.APP_BASE_URL = "https://learn.mit.edu/"
    settings.VIDEO_SHORTS_S3_PREFIX = "youtube_shorts"

    url = reverse("webhooks:v1:video_short_webhook")
    data = {
        "video_id": "k_AA4_fQIHc",
        "youtube_metadata": sample_youtube_metadata,
        "source": "youtube_shorts",
    }

    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify VideoShort was created
    video_short = VideoShort.objects.get(youtube_id="k_AA4_fQIHc")
    assert video_short.title == "How far away is space?"
    assert VideoShort.objects.count() == 1


@pytest.mark.django_db
def test_video_short_webhook_view_updates_existing(
    settings, client, sample_youtube_metadata
):
    """Test VideoShortWebhookView updates existing VideoShort"""
    from video_shorts.factories import VideoShortFactory
    from video_shorts.models import VideoShort

    settings.APP_BASE_URL = "https://learn.mit.edu/"
    settings.VIDEO_SHORTS_S3_PREFIX = "youtube_shorts"

    # Create existing video short
    existing = VideoShortFactory.create(
        youtube_id="k_AA4_fQIHc",
        title="Old Title",
    )
    original_created_on = existing.created_on

    url = reverse("webhooks:v1:video_short_webhook")

    # Update with new metadata
    updated_metadata = sample_youtube_metadata.copy()
    updated_metadata["snippet"]["title"] = "Updated Title"

    data = {
        "video_id": "k_AA4_fQIHc",
        "youtube_metadata": updated_metadata,
        "source": "youtube_shorts",
    }

    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify VideoShort was updated, not duplicated
    assert VideoShort.objects.count() == 1
    video_short = VideoShort.objects.get(youtube_id="k_AA4_fQIHc")
    assert video_short.title == "Updated Title"
    assert video_short.created_on == original_created_on


@pytest.mark.django_db
def test_video_short_webhook_view_invalid_json(settings, client):
    """Test VideoShortWebhookView handles invalid JSON"""
    url = reverse("webhooks:v1:video_short_webhook")
    invalid_data = "invalid json{"
    response = client.post(
        url,
        data=invalid_data,
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(invalid_data, settings)},
    )

    assert response.status_code == 400
    assert "Invalid JSON format" in response.content.decode()


@pytest.mark.django_db
def test_video_short_webhook_view_missing_required_fields(settings, client):
    """Test VideoShortWebhookView validates required fields"""
    url = reverse("webhooks:v1:video_short_webhook")

    # Missing youtube_metadata
    data = {
        "video_id": "test_id",
        "source": "youtube_shorts",
    }

    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_video_short_webhook_view_invalid_youtube_metadata(settings, client):
    """Test VideoShortWebhookView validates youtube_metadata structure"""
    settings.APP_BASE_URL = "https://learn.mit.edu/"
    settings.VIDEO_SHORTS_S3_PREFIX = "youtube_shorts"

    url = reverse("webhooks:v1:video_short_webhook")

    # Invalid youtube_metadata (missing required fields)
    data = {
        "video_id": "test_id",
        "youtube_metadata": {
            "id": "test_id",
            # Missing 'snippet' and other required fields
        },
        "source": "youtube_shorts",
    }

    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )

    # Should fail validation with 400 Bad Request
    assert response.status_code == 400
