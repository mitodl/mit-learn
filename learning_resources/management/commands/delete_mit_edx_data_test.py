"""Tests for the delete_mit_edx_data management command"""

import pytest
from django.core.management import CommandError, call_command

from channels.factories import ChannelFactory
from learning_resources.constants import LearningResourceRelationTypes
from learning_resources.factories import (
    ContentFileFactory,
    LearningPathFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
    UserListFactory,
    UserListRelationshipFactory,
)
from learning_resources.models import (
    ContentFile,
    LearningResource,
    LearningResourceRelationship,
    UserListRelationship,
)

pytestmark = pytest.mark.django_db

COMMAND_MODULE = "learning_resources.management.commands.delete_mit_edx_data"


@pytest.fixture
def mocks(mocker):
    """Mock the plugin hooks, search backends and caches"""
    mocker.patch(f"{COMMAND_MODULE}.get_active_aliases", return_value=["course"])
    conn = mocker.patch(f"{COMMAND_MODULE}.get_conn").return_value
    conn.delete_by_query.return_value = {"deleted": 1, "failures": []}
    return mocker.Mock(
        plugins=mocker.patch("learning_resources.utils.get_plugin_manager"),
        conn=conn,
        qdrant=mocker.patch(f"{COMMAND_MODULE}.remove_points_matching_params"),
        upsert=mocker.patch(f"{COMMAND_MODULE}.resource_upserted_actions"),
        views_cache=mocker.patch(f"{COMMAND_MODULE}.clear_views_cache"),
        featured=mocker.patch(f"{COMMAND_MODULE}.clear_featured_caches"),
    )


def _path_with(items, *, published=True):
    """Create a learning path holding items at positions 1..n"""
    path = LearningPathFactory.create(
        resources=[], learning_resource__published=published
    ).learning_resource
    for position, item in enumerate(items, 1):
        LearningResourceRelationship.objects.create(
            parent=path,
            child=item,
            position=position,
            relation_type=LearningResourceRelationTypes.LEARNING_PATH_ITEMS.value,
        )
    return path


def test_delete_mit_edx_data(mocks, settings):
    """mit_edx rows go, hooks run, lists are renumbered and search is cleaned"""
    settings.QDRANT_HOST = "http://qdrant"
    settings.QDRANT_BASE_COLLECTION_NAME = "test"
    edx_courses = LearningResourceFactory.create_batch(
        2, is_course=True, etl_source="mit_edx"
    )
    run = LearningResourceRunFactory.create(learning_resource=edx_courses[0])
    ContentFileFactory.create(run=run)
    other = LearningResourceFactory.create(is_course=True, etl_source="xpro")

    path = _path_with([edx_courses[0], other, edx_courses[1]])
    draft_path = _path_with([edx_courses[0], other], published=False)
    channel = ChannelFactory.create(featured_list=path)
    user_list = UserListFactory.create()
    for position, item in enumerate([edx_courses[1], other], 1):
        UserListRelationshipFactory.create(
            parent=user_list, child=item, position=position
        )

    call_command("delete_mit_edx_data", "--no-input")

    assert not LearningResource.objects.filter(etl_source="mit_edx").exists()
    assert not ContentFile.objects.filter(run=run).exists()
    assert LearningResource.objects.filter(id=other.id).exists()
    hook = mocks.plugins.return_value.hook
    assert hook.resource_before_delete.call_count == 2

    for parent in (path, draft_path):
        assert list(
            LearningResourceRelationship.objects.filter(parent=parent).values_list(
                "child_id", "position"
            )
        ) == [(other.id, 1)]
    assert list(
        UserListRelationship.objects.filter(parent=user_list).values_list(
            "child_id", "position"
        )
    ) == [(other.id, 1)]

    mocks.conn.delete_by_query.assert_called_once()
    assert mocks.qdrant.call_count == 2
    for call in mocks.qdrant.call_args_list:
        assert call.args == ({"platform": "edx"},)
        assert call.kwargs["wait"] is True
    # the draft path stays out of search
    mocks.upsert.assert_called_once_with(
        path, percolate=False, generate_embeddings=True
    )
    mocks.views_cache.assert_called_once_with()
    mocks.featured.assert_called_once_with([(channel.channel_type, channel.name)])


@pytest.mark.parametrize(
    ("side_effect", "response"),
    [
        (ConnectionError, None),
        (None, {"timed_out": True, "failures": []}),
        (None, {"failures": [{"cause": "shard"}]}),
        (None, {"failures": [], "version_conflicts": 3}),
    ],
)
def test_delete_mit_edx_data_backend_failure(mocks, side_effect, response):
    """A failed sweep still clears caches, then exits nonzero so it gets rerun"""
    mocks.conn.delete_by_query.side_effect = side_effect
    mocks.conn.delete_by_query.return_value = response
    LearningResourceFactory.create(is_course=True, etl_source="mit_edx")

    with pytest.raises(CommandError, match="OpenSearch"):
        call_command("delete_mit_edx_data", "--no-input")

    assert not LearningResource.objects.filter(etl_source="mit_edx").exists()
    mocks.views_cache.assert_called_once_with()


def test_delete_mit_edx_data_aborts(mocks, mocker):
    """Anything but yes at the prompt leaves the data alone"""
    mocker.patch("builtins.input", return_value="n")
    LearningResourceFactory.create(is_course=True, etl_source="mit_edx")

    with pytest.raises(CommandError, match="Aborted"):
        call_command("delete_mit_edx_data")

    assert LearningResource.objects.filter(etl_source="mit_edx").exists()
    mocks.conn.delete_by_query.assert_not_called()
