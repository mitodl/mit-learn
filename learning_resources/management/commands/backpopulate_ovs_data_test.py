"""Tests for the backpopulate_ovs_data management command"""

import json
from io import StringIO

import pytest
from django.core.management import CommandError, call_command

from learning_resources.constants import LearningResourceType, PlatformType
from learning_resources.etl.constants import ETLSource
from learning_resources.factories import (
    ETLSourceOwnershipFactory,
    LearningResourcePlatformFactory,
)
from learning_resources.models import ETLSourceOwnership, LearningResource

pytestmark = pytest.mark.django_db

OVS_BASE_URL = "https://video.odl.mit.edu"


@pytest.fixture
def ovs_videos(settings, mocker):
    """Serve test_json/ovs_videos.json as two pages, the first with two to skip"""
    settings.OVS_API_BASE_URL = OVS_BASE_URL
    settings.OVS_ALLOWED_MEDIA_HOSTS = [".cloudfront.net"]
    mocker.patch("learning_resources.etl.loaders.update_index")
    mocker.patch(
        "learning_resources.etl.loaders.similar_topics_action", return_value=[]
    )
    LearningResourcePlatformFactory.create(code=PlatformType.ovs.name)
    with open("./test_json/ovs_videos.json") as f:  # noqa: PTH123
        first, second = json.load(f)["results"]
    pages = [
        {
            "next": f"{OVS_BASE_URL}/api/v0/public/videos/?page=2",
            "results": [
                first,
                {**second, "key": "f" * 32, "is_public": False},
                {**second, "key": "e" * 32, "status": "Processing"},
            ],
        },
        {"next": None, "results": [second]},
    ]
    responses = [mocker.Mock(json=mocker.Mock(return_value=page)) for page in pages]
    return mocker.patch(
        "learning_resources.management.commands.backpopulate_ovs_data.requests.get",
        side_effect=responses,
    )


def _own_ovs(owner):
    for resource_type in (
        LearningResourceType.video_playlist.name,
        LearningResourceType.video.name,
    ):
        ETLSourceOwnershipFactory.create(
            etl_source=ETLSource.ovs.name, resource_type=resource_type, owner=owner
        )


def test_load_follows_pages_and_skips_non_public_or_incomplete(ovs_videos):
    """--load loads each public, Complete video on every page"""
    _own_ovs(ETLSourceOwnership.Pipeline.WEBHOOK)
    stdout = StringIO()

    call_command("backpopulate_ovs_data", "--load", stdout=stdout)

    assert "include_in_learn=true" in ovs_videos.call_args_list[0].args[0]
    assert ovs_videos.call_count == 2
    videos = LearningResource.objects.filter(
        etl_source=ETLSource.ovs.name, resource_type=LearningResourceType.video.name
    )
    assert sorted(videos.values_list("readable_id", flat=True)) == [
        "96fb932aa5644d8e8f6a5fafe42caa87",
        "abcdef1234567890abcdef1234567890",
    ]
    assert "Loaded 2 OVS videos, skipped 2" in stdout.getvalue()


def test_load_refuses_unless_webhook_owns_ovs(ovs_videos):
    """--load writes nothing while OVS isn't owned by the webhook"""
    with pytest.raises(CommandError, match="does not own"):
        call_command("backpopulate_ovs_data", "--load", stdout=StringIO())

    ovs_videos.assert_not_called()
    assert not LearningResource.objects.filter(etl_source=ETLSource.ovs.name).exists()
