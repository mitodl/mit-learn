"""Tests for channels plugins"""

import pytest

from channels.constants import ChannelType
from channels.factories import FieldChannelFactory
from channels.models import FieldChannel
from channels.plugins import ChannelPlugin
from learning_resources.factories import (
    LearningResourceDepartmentFactory,
    LearningResourceOfferorFactory,
    LearningResourceTopicFactory,
)
from learning_resources.models import (
    LearningResourceDepartment,
    LearningResourceOfferor,
    LearningResourceTopic,
)


@pytest.mark.django_db()
def test_search_index_plugin_topic_upserted():
    """The plugin function should create a topic channel"""
    topic = LearningResourceTopicFactory.create()
    channel, created = ChannelPlugin().topic_upserted(topic)
    assert created is True
    assert channel.topic_detail.topic == topic
    assert channel.title == topic.name
    assert channel.channel_type == ChannelType.topic.name
    assert channel.search_filter == f"topic={topic.name}"
    same_channel, created = ChannelPlugin().topic_upserted(topic)
    assert channel == same_channel
    assert created is False


@pytest.mark.django_db()
def test_search_index_plugin_topic_delete():
    """The plugin function should delete a topic and associated channel"""
    channel = FieldChannelFactory.create(is_topic=True)
    topic = channel.topic_detail.topic
    assert topic is not None
    ChannelPlugin().topic_delete(topic)
    assert FieldChannel.objects.filter(id=channel.id).exists() is False
    assert LearningResourceTopic.objects.filter(id=topic.id).exists() is False


@pytest.mark.django_db()
def test_search_index_plugin_department_upserted():
    """The plugin function should create a department channel"""
    department = LearningResourceDepartmentFactory.create()
    channel, created = ChannelPlugin().department_upserted(department)
    assert channel.department_detail.department == department
    assert channel.title == department.name
    assert channel.channel_type == ChannelType.department.name
    assert channel.search_filter == f"department={department.department_id}"
    same_channel, created = ChannelPlugin().department_upserted(department)
    assert channel == same_channel
    assert created is False


@pytest.mark.django_db()
def test_search_index_plugin_department_delete():
    """The plugin function should delete a department and associated channel"""
    channel = FieldChannelFactory.create(is_department=True)
    department = channel.department_detail.department
    assert department is not None
    ChannelPlugin().department_delete(department)
    assert FieldChannel.objects.filter(id=channel.id).exists() is False
    assert (
        LearningResourceDepartment.objects.filter(
            department_id=department.department_id
        ).exists()
        is False
    )


@pytest.mark.django_db()
def test_search_index_plugin_offeror_upserted():
    """The plugin function should create an offeror channel"""
    offeror = LearningResourceOfferorFactory.create()
    channel, created = ChannelPlugin().offeror_upserted(offeror)
    assert channel.offeror_detail.offeror == offeror
    assert channel.title == offeror.name
    assert channel.channel_type == ChannelType.offeror.name
    assert channel.search_filter == f"offeror={offeror.code}"
    same_channel, created = ChannelPlugin().offeror_upserted(offeror)
    assert channel == same_channel
    assert created is False


@pytest.mark.django_db()
def test_search_index_plugin_offeror_delete():
    """The plugin function should delete an offeror and associated channel"""
    channel = FieldChannelFactory.create(is_offeror=True)
    offeror = channel.offeror_detail.offeror
    assert offeror is not None
    ChannelPlugin().offeror_delete(offeror)
    assert FieldChannel.objects.filter(id=channel.id).exists() is False
    assert LearningResourceOfferor.objects.filter(code=offeror.code).exists() is False
