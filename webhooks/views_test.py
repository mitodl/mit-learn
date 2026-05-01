import hashlib
import hmac
import json

import pytest
from django.urls import reverse

from learning_resources.constants import (
    VIDEO_SHORT_RESOURCE_CATEGORY,
    LearningResourceRelationTypes,
    LearningResourceType,
    PlatformType,
)
from learning_resources.etl.constants import ETLSource
from learning_resources.factories import (
    LearningResourceFactory,
    LearningResourcePlatformFactory,
)
from learning_resources.models import (
    LearningResource,
    LearningResourceRelationship,
)
from video_shorts.factories import VideoShortFactory
from video_shorts.models import VideoShort


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
    mock_ingest = mocker.patch("webhooks.views.ingest_edx_run_archive.apply_async")

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
        kwargs={"run_id": readable_id, "overwrite": False},
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


@pytest.mark.django_db
def test_video_short_webhook_view_deletes_existing(settings, client, mocker):
    """Test VideoShortWebhookView deletes an existing VideoShort"""

    VideoShortFactory.create(video_id="delete_me")
    assert VideoShort.objects.count() == 1

    mock_s3_task = mocker.patch("video_shorts.api.delete_video_short_from_s3")

    url = reverse("webhooks:v1:video_short_webhook")
    data = {
        "video_id": "delete_me",
        "video_metadata": {"video_id": "delete_me", "delete": True},
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
    assert VideoShort.objects.count() == 0
    mock_s3_task.delay.assert_called_once()


@pytest.mark.django_db
def test_video_short_webhook_view_delete_nonexistent(settings, client, mocker):
    """Test VideoShortWebhookView delete for a nonexistent video is a no-op"""
    mock_s3_task = mocker.patch("video_shorts.api.delete_video_short_from_s3")

    url = reverse("webhooks:v1:video_short_webhook")
    data = {
        "video_id": "does_not_exist",
        "video_metadata": {"video_id": "does_not_exist", "delete": True},
        "source": "video_shorts",
    }

    response = client.post(
        url,
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )

    assert response.status_code == 200
    assert VideoShort.objects.count() == 0
    mock_s3_task.delay.assert_not_called()


@pytest.fixture
def ovs_platform():
    return LearningResourcePlatformFactory.create(code=PlatformType.ovs.name)


def _ovs_payload(*, key="vid_abc123", for_shorts=False, collection_key="col_abc"):
    return {
        "key": key,
        "created_at": "2026-04-28T17:35:42.065326Z",
        "title": "Sample OVS video",
        "description": "Sample description",
        "status": "Complete",
        "is_public": True,
        "youtube_id": None,
        "sources": [
            {
                "src": (
                    "https://du3yhovcx8dht.cloudfront.net/transcoded/"
                    f"{key}/video__index.m3u8"
                ),
                "label": "HLS",
                "type": "application/x-mpegURL",
            }
        ],
        "cta_link": None,
        "duration": 5.28,
        "multiangle": False,
        "videothumbnail_set": [
            {
                "id": 1,
                "created_at": "2026-04-28T17:46:53.887896Z",
                "s3_object_key": f"thumbnails/{key}/video_thumbnail.0000000.jpg",
                "bucket_name": "odl-video-service-thumbnails-rc",
                "cloudfront_url": (
                    f"https://du3yhovcx8dht.cloudfront.net/thumbnails/{key}/"
                    "video_thumbnail.0000000.jpg"
                ),
            }
        ],
        "videosubtitle_set": [],
        "collection": {
            "key": collection_key,
            "title": "Video Shorts" if for_shorts else "Lecture Series",
            "description": "",
            "is_public": True,
            "stream_source": None,
            "for_shorts": for_shorts,
        },
    }


@pytest.mark.django_db
def test_ovs_video_webhook_creates_short_and_playlist(
    settings, client, mocker, ovs_platform
):
    """Webhook creates a Video LearningResource (Video Short category) and playlist."""
    mocker.patch("webhooks.views.clear_views_cache")
    mocker.patch("learning_resources.etl.loaders.update_index")
    mocker.patch(
        "learning_resources.etl.loaders.similar_topics_action", return_value=[]
    )

    payload = _ovs_payload(key="short1", for_shorts=True, collection_key="col_short")
    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    video = LearningResource.objects.get(readable_id="short1")
    assert video.resource_type == LearningResourceType.video.name
    assert video.resource_category == VIDEO_SHORT_RESOURCE_CATEGORY
    assert video.platform == ovs_platform
    assert video.video.streaming_url.endswith(".m3u8")

    playlist = LearningResource.objects.get(readable_id="col_short")
    assert playlist.resource_type == LearningResourceType.video_playlist.name
    assert playlist.resource_category == LearningResourceType.video_playlist.value

    assert (
        LearningResourceRelationship.objects.filter(
            parent=playlist,
            child=video,
            relation_type=LearningResourceRelationTypes.PLAYLIST_VIDEOS.value,
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_ovs_video_webhook_creates_regular_video(
    settings, client, mocker, ovs_platform
):
    """Webhook with for_shorts=False sets resource_category to "Video"."""
    mocker.patch("webhooks.views.clear_views_cache")
    mocker.patch("learning_resources.etl.loaders.update_index")
    mocker.patch(
        "learning_resources.etl.loaders.similar_topics_action", return_value=[]
    )

    payload = _ovs_payload(key="vid1", for_shorts=False)
    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 200

    video = LearningResource.objects.get(readable_id="vid1")
    assert video.resource_category == LearningResourceType.video.value


@pytest.mark.django_db
def test_ovs_video_webhook_idempotent_no_dup_relationship(
    settings, client, mocker, ovs_platform
):
    """Re-sending the same webhook does not create duplicate relationships."""
    mocker.patch("webhooks.views.clear_views_cache")
    mocker.patch("learning_resources.etl.loaders.update_index")
    mocker.patch(
        "learning_resources.etl.loaders.similar_topics_action", return_value=[]
    )

    payload = _ovs_payload(key="dup1")
    url = reverse("webhooks:v1:ovs_video_webhook")
    for _ in range(2):
        response = client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
            headers={"X-MITLearn-Signature": get_secret(payload, settings)},
        )
        assert response.status_code == 200

    assert LearningResource.objects.filter(readable_id="dup1").count() == 1
    assert (
        LearningResourceRelationship.objects.filter(
            child__readable_id="dup1",
            relation_type=LearningResourceRelationTypes.PLAYLIST_VIDEOS.value,
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_ovs_video_webhook_skips_when_no_m3u8_source(
    settings,
    client,
    mocker,
    ovs_platform,
):
    """Payload with no m3u8 source returns 200 but creates no resources."""
    mocker.patch("webhooks.views.clear_views_cache")
    payload = _ovs_payload(key="no_src")
    payload["sources"] = []

    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 200
    assert not LearningResource.objects.filter(readable_id="no_src").exists()


@pytest.mark.django_db
def test_ovs_video_webhook_deletes_existing(settings, client, mocker, ovs_platform):
    """Webhook delete payload removes the matching OVS video resource."""
    mocker.patch("webhooks.views.clear_views_cache")
    LearningResourceFactory.create(
        readable_id="del_me",
        platform=ovs_platform,
        etl_source=ETLSource.ovs.name,
        resource_type=LearningResourceType.video.name,
    )
    mock_delete = mocker.patch("webhooks.views.resource_delete_actions")

    payload = {"video_id": "del_me", "delete": True}
    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 200
    assert mock_delete.called
    assert mock_delete.mock_calls[0].args[0].readable_id == "del_me"


@pytest.mark.django_db
def test_ovs_video_webhook_delete_missing(settings, client, mocker):
    """Delete for a nonexistent OVS video returns 200 without error."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_delete = mocker.patch("webhooks.views.resource_delete_actions")

    payload = {"video_id": "nope", "delete": True}
    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 200
    assert not mock_delete.called


@pytest.mark.django_db
def test_ovs_video_webhook_invalid_signature(settings, client, mocker):
    """Wrong signature short-circuits before the view runs."""
    mock_load = mocker.patch("webhooks.views.load_ovs_video_from_webhook")
    payload = _ovs_payload()
    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": "deadbeef"},
    )
    assert response.status_code in (403, 405)
    mock_load.assert_not_called()


@pytest.mark.django_db
def test_ovs_video_webhook_invalid_json(settings, client):
    """Invalid JSON body returns 400."""
    invalid = "not json{"
    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=invalid,
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(invalid, settings)},
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_ovs_video_webhook_missing_key(settings, client):
    """Upsert payload missing `key` returns 400."""
    payload = {"title": "no key here"}
    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 400
