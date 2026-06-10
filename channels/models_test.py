from urllib.parse import urlparse

import pytest

from channels.constants import ChannelType
from channels.factories import (
    ChannelDepartmentDetailFactory,
    ChannelFactory,
    ChannelTopicDetailFactory,
    ChannelUnitDetailFactory,
    SubChannelFactory,
)
from channels.models import Channel
from channels.serializers import ChannelSerializer

pytestmark = [pytest.mark.django_db]


@pytest.mark.parametrize("published", [True, False])
@pytest.mark.parametrize(
    (
        "channel_type",
        "detail_factory",
    ),
    [
        (ChannelType.department, ChannelDepartmentDetailFactory),
        (ChannelType.topic, ChannelTopicDetailFactory),
        (ChannelType.unit, ChannelUnitDetailFactory),
    ],
)
def test_channel_url_for_departments(published, channel_type, detail_factory):
    """Test that the channel URL is correct for department channels"""
    channel = detail_factory.create(
        channel__published=published,
    ).channel

    if published:
        assert (
            urlparse(channel.channel_url).path
            == f"/c/{channel_type.name}/{channel.name}/"
        )
    else:
        assert channel.channel_url is None


@pytest.mark.parametrize("sub_channel_count", [1, 5, 10])
def test_with_detail_relations_serialization_has_no_extra_subchannel_queries(
    django_assert_num_queries, sub_channel_count
):
    """with_detail_relations should preload subchannel relations for serialization."""
    channel = ChannelFactory.create(is_topic=True)
    SubChannelFactory.create_batch(sub_channel_count, parent_channel=channel)

    prefetched_channel = Channel.objects.with_detail_relations().get(pk=channel.pk)

    with django_assert_num_queries(0):
        serialized = ChannelSerializer(prefetched_channel).data

    assert len(serialized["sub_channels"]) == sub_channel_count
