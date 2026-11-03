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
    ETLSourceOwnershipFactory,
    LearningResourceFactory,
    LearningResourcePlatformFactory,
    LearningResourceRunFactory,
)
from learning_resources.models import (
    ETLSourceOwnership,
    LearningResource,
    LearningResourceRelationship,
)


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
    # mit_edx is retired, but its webhooks must still get a 200 (see ETLSource)
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
    ("course_id", "course_readable_id"),
    [(2198, None), (None, "2198")],
)
def test_content_file_webhook_view_canvas_null_id(
    settings, client, mocker, course_id, course_readable_id
):
    """
    Test ContentFileWebhookView accepts Canvas create webhooks with null IDs
    """
    url = reverse("webhooks:v1:content_file_webhook")
    mock_ingest = mocker.patch("webhooks.views.ingest_canvas_course.apply_async")

    data = {
        "source": ETLSource.canvas.name,
        "content_path": "/path/to/canvas/course.tar.gz",
        "course_id": course_id,
        "course_readable_id": course_readable_id,
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


@pytest.fixture
def ovs_platform(settings):
    settings.OVS_API_BASE_URL = "https://video.odl.mit.edu"
    settings.OVS_ALLOWED_MEDIA_HOSTS = [".cloudfront.net"]
    return LearningResourcePlatformFactory.create(code=PlatformType.ovs.name)


@pytest.fixture
def webhook_owns_ovs():
    """Cut OVS over to the webhook, which is what lets the OVS push write"""
    for resource_type in (
        LearningResourceType.video_playlist.name,
        LearningResourceType.video.name,
    ):
        ETLSourceOwnershipFactory.create(
            etl_source=ETLSource.ovs.name,
            resource_type=resource_type,
            owner=ETLSourceOwnership.Pipeline.WEBHOOK,
        )


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
    settings, client, mocker, ovs_platform, webhook_owns_ovs
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
    settings, client, mocker, ovs_platform, webhook_owns_ovs
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
    settings, client, mocker, ovs_platform, webhook_owns_ovs
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
    webhook_owns_ovs,
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
def test_ovs_video_webhook_deletes_existing(
    settings, client, mocker, ovs_platform, webhook_owns_ovs
):
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
def test_ovs_video_webhook_delete_missing(settings, client, mocker, webhook_owns_ovs):
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
@pytest.mark.parametrize(
    "owner",
    [None, ETLSourceOwnership.Pipeline.LEGACY, ETLSourceOwnership.Pipeline.WAREHOUSE],
)
@pytest.mark.parametrize("delete", [True, False])
def test_ovs_video_webhook_refuses_until_ovs_is_cut_over(  # noqa: PLR0913
    settings, client, mocker, ovs_platform, owner, delete
):
    """The OVS push writes nothing while legacy or the warehouse owns OVS"""
    if owner:
        ETLSourceOwnershipFactory.create(
            etl_source=ETLSource.ovs.name,
            resource_type=LearningResourceType.video.name,
            owner=owner,
        )
    # owning only one of the two types is not enough
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.ovs.name,
        resource_type=LearningResourceType.video_playlist.name,
        owner=ETLSourceOwnership.Pipeline.WEBHOOK,
    )
    LearningResourceFactory.create(
        readable_id="vid1",
        platform=ovs_platform,
        etl_source=ETLSource.ovs.name,
        resource_type=LearningResourceType.video.name,
    )
    mock_load = mocker.patch("webhooks.views.load_ovs_video_from_webhook")
    mock_delete = mocker.patch("webhooks.views.resource_delete_actions")

    payload = (
        {"video_id": "vid1", "delete": True} if delete else _ovs_payload(key="vid1")
    )
    response = client.post(
        reverse("webhooks:v1:ovs_video_webhook"),
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )

    assert response.status_code == 409
    assert "does not own ovs" in response.json()["message"]
    mock_load.assert_not_called()
    mock_delete.assert_not_called()


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
    assert response.status_code == 403
    assert response.json()["error_type"] == "PermissionDenied"
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


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "mutation"),
    [
        pytest.param(
            "sources",
            lambda payload: payload["sources"][0].update(
                {"src": "http://169.254.169.254/latest/meta-data/video__index.m3u8"}
            ),
            id="streaming_source",
        ),
        pytest.param(
            "videothumbnail_set",
            lambda payload: payload["videothumbnail_set"][0].update(
                {"cloudfront_url": "https://evil.io/thumb.jpg"}
            ),
            id="thumbnail",
        ),
        pytest.param(
            "cta_link",
            lambda payload: payload.update({"cta_link": "https://evil.io/watch"}),
            id="cta_link",
        ),
    ],
)
def test_ovs_video_webhook_rejects_disallowed_urls(
    settings, client, mocker, field, mutation
):
    """A payload url outside the OVS media allowlist is rejected, not fetched."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load = mocker.patch("webhooks.views.load_ovs_video_from_webhook")
    payload = _ovs_payload(key="ssrf")
    mutation(payload)

    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 400
    assert field in response.json()
    mock_load.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "hostile_url",
    [
        # urllib reads the host as du3yhovcx8dht.cloudfront.net, browsers read
        # it as evil.io
        pytest.param(
            "https://evil.io\\@du3yhovcx8dht.cloudfront.net/x.jpg", id="backslash"
        ),
        pytest.param("https://[", id="unparseable"),
        pytest.param(5, id="not_a_string"),
        pytest.param(
            {"src": "https://du3yhovcx8dht.cloudfront.net/x.jpg"}, id="object"
        ),
    ],
)
def test_ovs_video_webhook_rejects_hostile_urls(settings, client, mocker, hostile_url):
    """Urls urllib and browsers disagree about are rejected with a 400, not a 500."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load = mocker.patch("webhooks.views.load_ovs_video_from_webhook")
    settings.OVS_ALLOWED_MEDIA_HOSTS = [".cloudfront.net"]
    payload = _ovs_payload(key="hostile")
    payload["cta_link"] = hostile_url

    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 400
    assert "cta_link" in response.json()
    mock_load.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload_update",
    [
        pytest.param({"key": "abc/../../evil"}, id="key"),
        pytest.param({"collection": {"key": "col/../evil"}}, id="collection_key"),
    ],
)
def test_ovs_video_webhook_rejects_structural_keys(
    settings, client, mocker, payload_update
):
    """Keys that could alter a url or index path are rejected."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load = mocker.patch("webhooks.views.load_ovs_video_from_webhook")
    payload = {**_ovs_payload(), **payload_update}

    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 400
    mock_load.assert_not_called()


@pytest.mark.django_db
def test_ovs_video_webhook_delete_rejects_structural_video_id(settings, client, mocker):
    """A delete payload with a structural video_id is rejected."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_delete = mocker.patch("webhooks.views.resource_delete_actions")

    payload = {"video_id": "../../evil", "delete": True}
    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 400
    mock_delete.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        pytest.param([1, 2, 3], id="list_body"),
        pytest.param({"key": "abc", "sources": 5}, id="sources_not_a_list"),
        pytest.param({"key": "abc", "videothumbnail_set": "x"}, id="thumbnails_string"),
        pytest.param({"key": "abc", "collection": "x"}, id="collection_not_object"),
    ],
)
def test_ovs_video_webhook_malformed_payload(settings, client, mocker, payload):
    """Structurally invalid payloads are rejected with a 400, not a 500."""
    mocker.patch("webhooks.views.clear_views_cache")
    mock_load = mocker.patch("webhooks.views.load_ovs_video_from_webhook")
    url = reverse("webhooks:v1:ovs_video_webhook")
    response = client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(payload, settings)},
    )
    assert response.status_code == 400
    mock_load.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "owner",
    [ETLSourceOwnership.Pipeline.WAREHOUSE, ETLSourceOwnership.Pipeline.WEBHOOK],
)
def test_content_file_delete_webhook_skips_courses_legacy_does_not_own(
    settings, client, mocker, owner
):
    """The archive delete webhook leaves a course another pipeline owns alone"""
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.mitxonline.name,
        resource_type=LearningResourceType.course.name,
        owner=owner,
    )
    LearningResourceFactory.create(
        etl_source=ETLSource.mitxonline.name,
        readable_id="course-v1:Test+Course",
    )
    mock_delete = mocker.patch("webhooks.views.resource_delete_actions")

    data = {"source": ETLSource.mitxonline.name, "course_id": "course-v1:Test+Course"}
    response = client.post(
        reverse("webhooks:v1:content_file_delete_webhook"),
        data=json.dumps(data),
        content_type="application/json",
        headers={"X-MITLearn-Signature": get_secret(data, settings)},
    )

    assert response.status_code == 200
    mock_delete.assert_not_called()


def _post_extracted(client, settings, payload, *, signature=None):
    body = json.dumps(payload) if not isinstance(payload, str) else payload
    return client.post(
        reverse("webhooks:v1:extracted_content_files_webhook"),
        data=body,
        content_type="application/json",
        headers={"X-MITLearn-Signature": signature or get_secret(body, settings)},
    )


def test_extracted_content_files_webhook_queues_a_pull_per_run(
    settings, client, mocker
):
    """Each entry queues its run's pull, whatever the warehouse owns yet"""
    mock_load = mocker.patch("webhooks.views.load_warehouse_content_files")

    response = _post_extracted(
        client,
        settings,
        {
            "courses": [
                {
                    "source": ETLSource.mitxonline.name,
                    "readable_id": "course-v1:MITxT+7.05x+2T2026",
                    "content_file_count": 2279,
                    "extracted_at": "2026-08-19T04:31:07+00:00",
                },
                {
                    "source": ETLSource.ocw.name,
                    "readable_id": "abc123",
                    "content_file_count": 0,
                },
            ]
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "success",
        "message": "Queued 2 run(s), skipped 0",
    }
    assert mock_load.delay.call_args_list == [
        mocker.call(ETLSource.mitxonline.name, "course-v1:MITxT+7.05x+2T2026", 2279),
        mocker.call(ETLSource.ocw.name, "abc123", 0),
    ]


def test_extracted_content_files_webhook_skips_a_source_with_no_pull(
    settings, client, mocker
):
    """One bad source doesn't reject the runs around it"""
    mock_load = mocker.patch("webhooks.views.load_warehouse_content_files")
    mock_log = mocker.patch("webhooks.views.log.warning")

    response = _post_extracted(
        client,
        settings,
        {
            "courses": [
                {"source": "nonsense", "readable_id": "a", "content_file_count": 1},
                {"source": "xpro", "readable_id": "b", "content_file_count": 1},
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Queued 1 run(s), skipped 1"
    mock_load.delay.assert_called_once_with("xpro", "b", 1)
    mock_log.assert_called_once()


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"courses": []},
        {"courses": "course-v1:a"},
        {"courses": [{"source": "xpro", "content_file_count": 1}]},
        {"courses": [{"source": "xpro", "readable_id": "a"}]},
        {"courses": [{"source": "xpro", "readable_id": "a", "content_file_count": -1}]},
    ],
)
def test_extracted_content_files_webhook_rejects_a_bad_payload(
    settings, client, mocker, payload
):
    """A message without what a pull needs queues nothing"""
    mock_load = mocker.patch("webhooks.views.load_warehouse_content_files")

    assert _post_extracted(client, settings, payload).status_code == 400

    mock_load.delay.assert_not_called()


def test_extracted_content_files_webhook_rejects_invalid_json(settings, client):
    """A body that isn't JSON is a 400"""
    assert _post_extracted(client, settings, "not json").status_code == 400


def test_extracted_content_files_webhook_requires_a_valid_signature(
    settings, client, mocker
):
    """An unsigned or wrongly signed message queues nothing"""
    mock_load = mocker.patch("webhooks.views.load_warehouse_content_files")

    response = _post_extracted(
        client,
        settings,
        {"courses": [{"source": "xpro", "readable_id": "a", "content_file_count": 1}]},
        signature="wrong",
    )

    assert response.status_code == 403
    mock_load.delay.assert_not_called()


def test_extracted_content_files_webhook_requires_post(settings, client):
    """Only POST is routed"""
    response = client.get(reverse("webhooks:v1:extracted_content_files_webhook"))

    assert response.status_code == 405


@pytest.mark.django_db
def test_extracted_content_files_webhook_scopes_the_pull_to_the_run(
    settings, client, mocker
):
    """
    A signed POST reaches the warehouse with its run's filter and expected count,
    the end-to-end path a sender uses, with the task eager as in CI.
    """
    settings.WAREHOUSE_CATALOG = "catalog"
    settings.WAREHOUSE_SCHEMA = "schema"
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.xpro.name,
        resource_type="content_file",
        owner=ETLSourceOwnership.Pipeline.WAREHOUSE,
    )
    run = LearningResourceRunFactory.create(
        learning_resource=LearningResourceFactory.create(
            is_course=True, etl_source=ETLSource.xpro.name, create_runs=False
        ),
        published=True,
    )
    mocker.patch("learning_resources.tasks.caches")
    mock_connect = mocker.patch("learning_resources.tasks.connect_to_warehouse")
    mock_iter_rows = mocker.patch(
        "learning_resources.tasks.iter_rows", return_value=iter([{"key": "a"}])
    )
    mock_load_run = mocker.patch(
        "learning_resources.tasks.warehouse_content_files.load_run", return_value=1
    )

    response = _post_extracted(
        client,
        settings,
        {
            "courses": [
                {
                    "source": ETLSource.xpro.name,
                    "readable_id": run.run_id,
                    "content_file_count": 1,
                }
            ]
        },
    )

    assert response.status_code == 200
    mock_iter_rows.assert_called_once_with(
        mock_connect.return_value,
        "catalog.schema.integrations__learn__content_files",
        where={"etl_source": ETLSource.xpro.name, "run_readable_id": run.run_id},
    )
    # the per-run unpublish limit applies, and nothing a sender sends lifts it
    mock_load_run.assert_called_once_with(
        run, [{"key": "a"}], expected_count=1, allow_mass_unpublish=False
    )
