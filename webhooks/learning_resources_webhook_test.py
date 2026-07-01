import hashlib
import hmac
import json

import pytest
from django.urls import reverse

from learning_resources.constants import LearningResourceType
from learning_resources.etl.constants import ETLSource

WEBHOOK_URL_NAME = "webhooks:v1:learning_resources_webhook"


def _post(client, settings, payload, *, signature=None):
    """POST a JSON payload to the learning_resources webhook, signing the body."""
    body = json.dumps(payload)
    if signature is None:
        signature = hmac.new(
            settings.WEBHOOK_SECRET.encode(),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
    return client.post(
        reverse(WEBHOOK_URL_NAME),
        data=body,
        content_type="application/json",
        headers={"X-MITLearn-Signature": signature},
    )


def _resource(readable_id, etl_source, resource_type, **extra):
    return {
        "readable_id": readable_id,
        "etl_source": etl_source,
        "resource_type": resource_type,
        "title": f"Title {readable_id}",
        **extra,
    }


@pytest.mark.django_db
def test_courses_routed_to_load_courses(settings, client, mocker):
    """Course resources are routed to load_courses with their etl_source."""
    mock_clear = mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])

    payload = {
        "resources": [
            _resource(
                "course-1", ETLSource.mitpe.name, LearningResourceType.course.name
            ),
            _resource(
                "course-2", ETLSource.mitpe.name, LearningResourceType.course.name
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    mock_load_courses.assert_called_once()
    etl_source_arg, courses_arg = mock_load_courses.call_args.args
    assert etl_source_arg == ETLSource.mitpe.name
    assert [r["readable_id"] for r in courses_arg] == ["course-1", "course-2"]
    mock_load_programs.assert_not_called()
    mock_clear.assert_called_once()


@pytest.mark.django_db
def test_groups_by_source_and_type(settings, client, mocker):
    """Resources are grouped by (etl_source, resource_type) before dispatch."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])

    payload = {
        "resources": [
            _resource(
                "c-mitpe", ETLSource.mitpe.name, LearningResourceType.course.name
            ),
            _resource("c-oll", ETLSource.oll.name, LearningResourceType.course.name),
            _resource(
                "p-edx", ETLSource.mit_edx.name, LearningResourceType.program.name
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    # one load_courses call per distinct etl_source that has course resources
    assert mock_load_courses.call_count == 2
    called_sources = {call.args[0] for call in mock_load_courses.call_args_list}
    assert called_sources == {ETLSource.mitpe.name, ETLSource.oll.name}
    mock_load_programs.assert_called_once()
    assert mock_load_programs.call_args.args[0] == ETLSource.mit_edx.name


@pytest.mark.django_db
def test_videos_and_podcasts_routed(settings, client, mocker):
    """Video and podcast resources reach load_videos / load_podcasts."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_videos = mocker.patch("webhooks.views.load_videos", return_value=[])
    mock_load_podcasts = mocker.patch("webhooks.views.load_podcasts", return_value=[])

    payload = {
        "resources": [
            _resource("v1", ETLSource.youtube.name, LearningResourceType.video.name),
            _resource(
                "pod1", ETLSource.podcast.name, LearningResourceType.podcast.name
            ),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    mock_load_videos.assert_called_once()
    assert [r["readable_id"] for r in mock_load_videos.call_args.args[0]] == ["v1"]
    mock_load_podcasts.assert_called_once()
    assert [r["readable_id"] for r in mock_load_podcasts.call_args.args[0]] == ["pod1"]


@pytest.mark.django_db
def test_unsupported_resource_type_skipped(settings, client, mocker):
    """A resource_type with no loader (e.g. mit_climate 'article') is skipped, not 500."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    mock_load_programs = mocker.patch("webhooks.views.load_programs", return_value=[])
    mock_load_videos = mocker.patch("webhooks.views.load_videos", return_value=[])
    mock_load_podcasts = mocker.patch("webhooks.views.load_podcasts", return_value=[])

    payload = {
        "resources": [
            _resource("art-1", ETLSource.mit_climate.name, "article"),
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    mock_load_courses.assert_not_called()
    mock_load_programs.assert_not_called()
    mock_load_videos.assert_not_called()
    mock_load_podcasts.assert_not_called()


@pytest.mark.django_db
def test_missing_required_field_returns_400(settings, client, mocker):
    """A resource missing readable_id/etl_source/resource_type is rejected."""
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    payload = {
        "resources": [
            {
                "etl_source": ETLSource.mitpe.name,
                "resource_type": LearningResourceType.course.name,
            },
        ]
    }
    response = _post(client, settings, payload)

    assert response.status_code == 400
    mock_load_courses.assert_not_called()


@pytest.mark.django_db
def test_invalid_signature_rejected(settings, client, mocker):
    """A bad signature short-circuits before any loader runs."""
    mock_load_courses = mocker.patch("webhooks.views.load_courses", return_value=[])
    payload = {
        "resources": [
            _resource("c1", ETLSource.mitpe.name, LearningResourceType.course.name),
        ]
    }
    response = _post(client, settings, payload, signature="deadbeef")

    assert response.status_code != 200
    mock_load_courses.assert_not_called()


@pytest.mark.django_db
def test_invalid_json_returns_400(settings, client):
    """A validly-signed but malformed JSON body returns 400."""
    body = "{not json"
    signature = hmac.new(
        settings.WEBHOOK_SECRET.encode(),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    response = client.post(
        reverse(WEBHOOK_URL_NAME),
        data=body,
        content_type="application/json",
        headers={"X-MITLearn-Signature": signature},
    )
    assert response.status_code == 400
