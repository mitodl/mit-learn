"""Tests for channels.serializers"""

from types import SimpleNamespace

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from channels.constants import ChannelType
from channels.factories import (
    ChannelDepartmentDetailFactory,
    ChannelFactory,
    ChannelListFactory,
    ChannelPathwayDetailFactory,
    ChannelTopicDetailFactory,
    ChannelUnitDetailFactory,
)
from channels.serializers import (
    ChannelDepartmentDetailSerializer,
    ChannelPathwayDetailSerializer,
    ChannelSerializer,
    ChannelTopicDetailSerializer,
    ChannelUnitDetailSerializer,
    LearningPathPreviewSerializer,
)
from learning_resources.factories import (
    LearningResourceDepartmentFactory,
    LearningResourceOfferorFactory,
    LearningResourceTopicFactory,
)
from learning_resources.serializers import LearningResourceOfferorDetailSerializer
from main.utils import frontend_absolute_url

# pylint:disable=redefined-outer-name
pytestmark = pytest.mark.django_db


small_gif = (
    b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x00\x00\x00\x21\xf9\x04"
    b"\x01\x0a\x00\x01\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02"
    b"\x02\x4c\x01\x00\x3b"
)


@pytest.fixture
def channel_detail():
    """Return possible related objects for a channel"""
    topic = LearningResourceTopicFactory.create()
    department = LearningResourceDepartmentFactory.create()
    offeror = LearningResourceOfferorFactory.create()
    return SimpleNamespace(
        topic=ChannelTopicDetailSerializer(
            instance=ChannelTopicDetailFactory.build(topic=topic)
        ).data,
        department=ChannelDepartmentDetailSerializer(
            instance=ChannelDepartmentDetailFactory.build(department=department)
        ).data,
        unit=ChannelUnitDetailSerializer(
            instance=ChannelUnitDetailFactory.build(unit=offeror)
        ).data,
        pathway=ChannelPathwayDetailSerializer(
            instance=ChannelPathwayDetailFactory.build()
        ).data,
    )


def mock_image_file(filename):
    """Return a File object with a given name"""
    return SimpleUploadedFile(filename, small_gif, content_type="image/gif")


@pytest.mark.parametrize("has_avatar", [True, False])
@pytest.mark.parametrize("has_banner", [True, False])
@pytest.mark.parametrize("has_about", [True, False])
@pytest.mark.parametrize("ga_tracking_id", ["", "abc123"])
def test_serialize_channel(  # pylint: disable=too-many-arguments
    mocker, has_avatar, has_banner, has_about, ga_tracking_id
):
    """
    Test serializing a channel
    """

    mocker.patch("channels.models.ResizeToFit", autospec=True)
    channel = ChannelFactory.create(
        banner=mock_image_file("banner.jpg") if has_banner else None,
        avatar=mock_image_file("avatar.jpg") if has_avatar else None,
        about={"foo": "bar"} if has_about else None,
        ga_tracking_id=ga_tracking_id,
        channel_type=ChannelType.unit.name,
        search_filter="offered_by=ocw",
    )

    channel_lists = ChannelListFactory.create_batch(3, channel=channel)

    assert ChannelSerializer(channel).data == {
        "name": channel.name,
        "title": channel.title,
        "avatar": channel.avatar.url if has_avatar else None,
        "avatar_small": channel.avatar_small.url if has_avatar else None,
        "avatar_medium": channel.avatar_medium.url if has_avatar else None,
        "banner": channel.banner.url if has_banner else None,
        "ga_tracking_id": channel.ga_tracking_id,
        "widget_list": channel.widget_list.id if channel.widget_list else None,
        "about": channel.about,
        "updated_on": mocker.ANY,
        "created_on": mocker.ANY,
        "id": channel.id,
        "channel_url": frontend_absolute_url(
            f"/c/{channel.channel_type}/{channel.name}/"
        ),
        "lists": [
            LearningPathPreviewSerializer(channel_list.channel_list).data
            for channel_list in sorted(
                channel_lists,
                key=lambda l: l.position,  # noqa: E741
            )
        ],
        "sub_channels": [],
        "featured_list": None,
        "public_description": channel.public_description,
        "configuration": {},
        "search_filter": channel.search_filter,
        "channel_type": ChannelType.unit.name,
        "unit_detail": {
            "unit": LearningResourceOfferorDetailSerializer(
                instance=channel.unit_detail.unit
            ).data,
        },
    }


def test_serialize_channel_lists_ordered_by_position():
    """Channel lists should be serialized in ascending `position` order"""
    channel = ChannelFactory.create(channel_type=ChannelType.unit.name)

    # Create lists whose creation order does not match their position order,
    # so the test fails if the ordering is dropped.
    channel_list_pos2 = ChannelListFactory.create(channel=channel, position=2)
    channel_list_pos0 = ChannelListFactory.create(channel=channel, position=0)
    channel_list_pos1 = ChannelListFactory.create(channel=channel, position=1)

    serialized = ChannelSerializer(channel).data

    assert serialized["lists"] == [
        LearningPathPreviewSerializer(channel_list.channel_list).data
        for channel_list in (channel_list_pos0, channel_list_pos1, channel_list_pos2)
    ]
