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
@pytest.mark.parametrize(
    ("etl_source", "course_id", "readable_id"),
    [
        (
            ETLSource.mitxonline.name,
            "course-v1:Test+Course+R1",
            "course-v1:Test+Course+R1",
        ),
        (ETLSource.xpro.name, "course-v1:xPRO+Test+R1", "course-v1:xPRO+Test+R1"),
        (ETLSource.mit_edx.name, "MITx-1.00x-1T2022", "MITx-1.00x-1T2022"),
        (ETLSource.oll.name, "course-v1:OLL+Test+R1", "course-v1:OLL+Test+R1"),
    ],
)
def test_content_file_delete_webhook_view_edx_success(  # noqa: PLR0913
    settings, client, mocker, etl_source, course_id, readable_id
):
    """
    Test ContentFileDeleteWebhookView processes edX delete webhook successfully
    """
    mocker.patch(
        "learning_resources_search.plugins.SearchIndexPlugin.resource_before_delete"
    )
    url = reverse("webhooks:v1:content_file_delete_webhook")

    LearningResourceFactory.create(etl_source=etl_source, readable_id=readable_id)

    data = {
        "source": etl_source,
        "course_id": course_id,
    }
    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )
    assert response.status_code == 200
    assert not LearningResource.objects.filter(readable_id=readable_id).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "etl_source",
    [ETLSource.mitxonline.name, ETLSource.xpro.name, ETLSource.mit_edx.name],
)
def test_content_file_delete_webhook_view_edx_resource_not_found(
    settings, client, mocker, etl_source
):
    """
    Test ContentFileDeleteWebhookView handles missing edX resource gracefully
    """
    url = reverse("webhooks:v1:content_file_delete_webhook")
    mock_delete = mocker.patch("webhooks.views.resource_delete_actions")
    mock_log = mocker.patch("webhooks.views.log")
    data = {
        "source": etl_source,
        "course_id": "non-existent-course",
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
    mock_delete.assert_not_called()


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
@pytest.mark.parametrize(
    ("etl_source", "content_path", "readable_id"),
    [
        (
            ETLSource.mitxonline.name,
            "mitxonline/courses/course-v1:Test+Course+R1/abcdef.tar.gz",
            "course-v1:Test+Course",
        ),
        (
            ETLSource.xpro.name,
            "xpro/courses/course-v1:xPRO+Test+R1/abcdef.tar.gz",
            None,
        ),
        (
            ETLSource.mit_edx.name,
            "edxorg-raw-data/courses/xml/MITx-1.00x-1T2022/tuvxyz.tar.gz",
            "MITx-1.00x",
        ),
        (
            ETLSource.oll.name,
            "open-learning-library/courses/course-v1:OLL+Test+R1_OLL.tar.gz",
            "course-v1:OLL+Test",
        ),
    ],
)
def test_content_file_webhook_view_edx_success(  # noqa: PLR0913
    settings, client, mocker, etl_source, content_path, readable_id
):
    """
    Test ContentFileWebhookView processes edX create webhooks successfully
    """
    url = reverse("webhooks:v1:content_file_webhook")
    mock_ingest = mocker.patch("webhooks.views.ingest_edx_course.apply_async")

    data = {
        "source": etl_source,
        "content_path": content_path,
    }
    if readable_id:
        data["course_id"] = readable_id
    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )
    assert response.status_code == 200
    mock_ingest.assert_called_once_with(
        [etl_source, content_path],
        kwargs={"course_id": readable_id, "overwrite": False},
    )


@pytest.mark.django_db
def test_content_file_webhook_view_invalid_json(settings, client):
    """
    Test ContentFileWebhookView handles invalid JSON
    """
    url = reverse("webhooks:v1:content_file_webhook")
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
def test_video_short_webhook_view_creates_new(settings, client, sample_video_metadata):
    """Test VideoShortWebhookView creates a new VideoShort"""
    from video_shorts.models import VideoShort

    url = reverse("webhooks:v1:video_short_webhook")
    data = {
        "video_id": "k_AA4_fQIHc",
        "video_metadata": sample_video_metadata,
        "source": "video_shorts",
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
    video_short = VideoShort.objects.get(video_id="k_AA4_fQIHc")
    assert video_short.title == "How far away is space?"
    assert video_short.video_url == "/shorts/k_AA4_fQIHc/k_AA4_fQIHc.mp4"
    assert (
        video_short.thumbnail_large_url == "/shorts/k_AA4_fQIHc/k_AA4_fQIHc_large.jpg"
    )
    assert (
        video_short.thumbnail_small_url == "/shorts/k_AA4_fQIHc/k_AA4_fQIHc_small.jpg"
    )
    assert VideoShort.objects.count() == 1


@pytest.mark.django_db
def test_video_short_webhook_view_updates_existing(
    settings, client, sample_video_metadata
):
    """Test VideoShortWebhookView updates existing VideoShort"""
    from video_shorts.factories import VideoShortFactory
    from video_shorts.models import VideoShort

    settings.APP_BASE_URL = "https://learn.mit.edu/"

    # Create existing video short
    existing = VideoShortFactory.create(
        video_id="k_AA4_fQIHc",
        title="Old Title",
    )
    original_created_on = existing.created_on

    url = reverse("webhooks:v1:video_short_webhook")

    # Update with new metadata
    updated_metadata = sample_video_metadata.copy()
    updated_metadata["title"] = "Updated Title"

    data = {
        "video_id": "k_AA4_fQIHc",
        "video_metadata": updated_metadata,
        "source": "video_shorts",
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
    video_short = VideoShort.objects.get(video_id="k_AA4_fQIHc")
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

    # Missing video_metadata
    data = {
        "video_id": "test_id",
        "source": "video_shorts",
    }

    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_video_short_webhook_view_invalid_video_metadata(settings, client):
    """Test VideoShortWebhookView validates metadata structure"""
    settings.APP_BASE_URL = "https://learn.mit.edu/"

    url = reverse("webhooks:v1:video_short_webhook")

    # Invalid metadata (missing required fields)
    data = {
        "video_id": "test_id",
        "video_metadata": {
            "video_id": "test_id",
            # Missing 'title' and other required fields
        },
        "source": "video_shorts",
    }

    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )

    # Should fail validation with 400 Bad Request
    assert response.status_code == 400
