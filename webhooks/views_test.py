import hashlib
import hmac
import json

import pytest
from django.urls import reverse

from learning_resources.etl.constants import ETLSource
from learning_resources.factories import LearningResourceFactory
from learning_resources.models import LearningResource


def get_secret(data, settings):
    payload = bytes(json.dumps(data), "utf-8")
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
        etl_source=ETLSource.canvas.name, readable_id="canvas-course-123"
    )
    mock_unpublish = mocker.patch("webhooks.views.resource_unpublished_actions")
    data = {
        "source": ETLSource.canvas.name,
        "course_id": "canvas-course-123",
    }
    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )
    assert response.status_code == 200
    mock_unpublish.assert_called_once_with(resource)


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
    mocker.patch("webhooks.views.resource_unpublished_actions")
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
