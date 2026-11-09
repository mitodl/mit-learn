import hashlib
import hmac
import json

import pytest
from django.urls import reverse

from learning_resources.etl.constants import ETLSource
from learning_resources.factories import ETLSourceOwnershipFactory
from learning_resources.models import ETLSourceOwnership

WEBHOOK_URL_NAME = "webhooks:v1:warehouse_views_webhook"
OCW_COURSES = "integrations__learn__ocw_courses"


def _post(client, settings, payload, *, signature=None):
    body = payload if isinstance(payload, str) else json.dumps(payload)
    if signature is None:
        signature = hmac.new(
            settings.WEBHOOK_SECRET.encode(), body.encode(), hashlib.sha256
        ).hexdigest()
    return client.post(
        reverse(WEBHOOK_URL_NAME),
        data=body,
        content_type="application/json",
        headers={"X-MITLearn-Signature": signature},
    )


def test_warehouse_views_webhook_queues_the_syncs(settings, client, mocker):
    """Each named view queues the syncs that read it, and an unknown one is skipped"""
    mock_queue = mocker.patch(
        "webhooks.views.queue_warehouse_syncs",
        return_value=(
            ["learning_resources.tasks.SyncOCWCoursesTask"],
            ["integrations__learn__nonsense"],
        ),
    )
    mock_log = mocker.patch("webhooks.views.log.warning")

    response = _post(
        client,
        settings,
        {"views": [OCW_COURSES, "integrations__learn__nonsense"]},
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "success",
        "message": (
            "Queued 1 sync(s): learning_resources.tasks.SyncOCWCoursesTask. "
            "Skipped unknown view(s): integrations__learn__nonsense"
        ),
    }
    mock_queue.assert_called_once_with([OCW_COURSES, "integrations__learn__nonsense"])
    mock_log.assert_called_once()


@pytest.mark.parametrize(
    "payload",
    [{}, {"views": []}, {"views": OCW_COURSES}, {"views": [{"name": OCW_COURSES}]}],
)
def test_warehouse_views_webhook_rejects_a_bad_payload(
    settings, client, mocker, payload
):
    """A message without a list of view names queues nothing"""
    mock_queue = mocker.patch("webhooks.views.queue_warehouse_syncs")

    assert _post(client, settings, payload).status_code == 400

    mock_queue.assert_not_called()


def test_warehouse_views_webhook_rejects_invalid_json(settings, client, mocker):
    """A body that isn't JSON is a 400"""
    mock_queue = mocker.patch("webhooks.views.queue_warehouse_syncs")

    assert _post(client, settings, "not json").status_code == 400

    mock_queue.assert_not_called()


@pytest.mark.parametrize("signature", ["", "wrong"])
def test_warehouse_views_webhook_requires_a_valid_signature(
    settings, client, mocker, signature
):
    """An unsigned or wrongly signed message queues nothing"""
    mock_queue = mocker.patch("webhooks.views.queue_warehouse_syncs")

    response = _post(client, settings, {"views": [OCW_COURSES]}, signature=signature)

    assert response.status_code == 403
    mock_queue.assert_not_called()


def test_warehouse_views_webhook_requires_post(client):
    """Only POST is routed"""
    assert client.get(reverse(WEBHOOK_URL_NAME)).status_code == 405


@pytest.mark.django_db
@pytest.mark.parametrize("warehouse_owns", [True, False])
def test_warehouse_views_webhook_runs_the_sync(
    settings, client, mocker, warehouse_owns
):
    """
    A signed POST runs SyncOCWCoursesTask (eager, as in CI), which reads the
    view only once the warehouse owns ocw courses
    """
    settings.WAREHOUSE_CATALOG = "catalog"
    settings.WAREHOUSE_SCHEMA = "schema"
    if warehouse_owns:
        ETLSourceOwnershipFactory.create(
            etl_source=ETLSource.ocw.name,
            resource_type="course",
            owner=ETLSourceOwnership.Pipeline.WAREHOUSE,
        )
    mock_connect = mocker.patch("learning_resources.lib.warehouse.connect_to_warehouse")
    rows = [{"url": "https://ocw.mit.edu/courses/a/"}]
    mock_iter_rows = mocker.patch(
        "learning_resources.tasks.iter_rows", return_value=iter(rows)
    )
    mock_sync = mocker.patch(
        "learning_resources.tasks.warehouse_ocw.sync_courses", return_value=1
    )

    response = _post(client, settings, {"views": [OCW_COURSES]})

    assert response.status_code == 200
    if warehouse_owns:
        mock_iter_rows.assert_called_once_with(
            mock_connect.return_value, f"catalog.schema.{OCW_COURSES}"
        )
        mock_sync.assert_called_once_with(rows, allow_mass_unpublish=False)
    else:
        mock_connect.assert_not_called()
        mock_sync.assert_not_called()
