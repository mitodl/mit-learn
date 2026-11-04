"""Tests for the delete_mit_edx_resources management command"""

import pytest
from django.core.management import CommandError, call_command

from learning_resources.constants import PlatformType
from learning_resources.factories import (
    ContentFileFactory,
    LearningPathFactory,
    LearningResourceFactory,
    LearningResourcePlatformFactory,
    LearningResourceRunFactory,
    UserListRelationshipFactory,
)
from learning_resources.models import (
    ContentFile,
    ETLSourceOwnership,
    LearningResource,
    LearningResourceRun,
    UserListRelationship,
)
from vector_search.constants import (
    CONTENT_FILES_COLLECTION_NAME,
    RESOURCES_COLLECTION_NAME,
)

pytestmark = pytest.mark.django_db

COMMAND = "learning_resources.management.commands.delete_mit_edx_resources"
EDX_QUERY = {
    "query": {
        "nested": {"path": "platform", "query": {"term": {"platform.code": "edx"}}}
    }
}


@pytest.fixture
def backends(mocker, settings):
    """Mock OpenSearch, Qdrant and the views cache"""
    settings.QDRANT_HOST = "http://qdrant"
    settings.QDRANT_BASE_COLLECTION_NAME = "test"
    conn = mocker.patch(f"{COMMAND}.get_conn").return_value
    conn.delete_by_query.return_value = {"deleted": 1, "failures": []}
    mocker.patch(f"{COMMAND}.get_active_aliases", return_value=["course", "program"])
    qdrant = mocker.patch(f"{COMMAND}.qdrant_client").return_value
    qdrant.collection_exists.return_value = True
    return {
        "conn": conn,
        "qdrant": qdrant,
        "remove_points": mocker.patch(f"{COMMAND}.remove_points_matching_params"),
        "cache": mocker.patch(f"{COMMAND}.clear_views_cache"),
    }


def _resource(etl_source, platform):
    return LearningResourceFactory.create(
        is_course=True,
        etl_source=etl_source,
        platform=LearningResourcePlatformFactory.create(code=platform),
    )


def test_deletes_mit_edx_and_purges_edx(backends):
    """mit_edx rows and everything under them go; other sources stay"""
    edx = _resource("mit_edx", PlatformType.edx.name)
    other = _resource("xpro", PlatformType.xpro.name)
    run = LearningResourceRunFactory.create(learning_resource=edx)
    ContentFileFactory.create(run=run)
    ContentFileFactory.create(learning_resource=edx)
    # a file whose only parent is direct_learning_resource, which is SET_NULL
    direct = ContentFileFactory.create(learning_resource=edx)
    ContentFile.objects.filter(pk=direct.pk).update(
        learning_resource=None, direct_learning_resource=edx
    )
    UserListRelationshipFactory.create(child=edx)
    path = LearningPathFactory.create(resources=[edx, other]).learning_resource
    ETLSourceOwnership.objects.create(etl_source="mit_edx", resource_type="course")
    ETLSourceOwnership.objects.create(etl_source="xpro", resource_type="course")

    call_command("delete_mit_edx_resources")

    assert not LearningResource.objects.filter(etl_source="mit_edx").exists()
    assert not LearningResourceRun.objects.filter(learning_resource_id=edx.id).exists()
    assert not ContentFile.objects.filter(run__learning_resource_id=edx.id).exists()
    assert not ContentFile.objects.filter(pk=direct.pk).exists()
    assert not ContentFile.objects.filter(learning_resource_id=edx.id).exists()
    assert not UserListRelationship.objects.filter(child_id=edx.id).exists()
    assert list(path.children.values_list("child_id", flat=True)) == [other.id]
    assert LearningResource.objects.filter(pk=other.pk).exists()
    assert list(ETLSourceOwnership.objects.values_list("etl_source", flat=True)) == [
        "xpro"
    ]

    for alias in ("course", "program"):
        backends["conn"].indices.refresh.assert_any_call(index=alias)
        backends["conn"].delete_by_query.assert_any_call(
            index=alias, body=EDX_QUERY, conflicts="proceed", refresh=True
        )
    for collection in (RESOURCES_COLLECTION_NAME, CONTENT_FILES_COLLECTION_NAME):
        backends["remove_points"].assert_any_call(
            {"platform": "edx"}, collection_name=collection, wait=True
        )
    backends["cache"].assert_called_once_with()


def test_rerun_with_nothing_left(backends):
    """A rerun still purges the indexes, and succeeds"""
    call_command("delete_mit_edx_resources")

    assert backends["conn"].delete_by_query.call_count == 2
    assert backends["remove_points"].call_count == 2


def test_skips_qdrant_when_not_configured(backends, settings):
    """No Qdrant settings, no Qdrant calls"""
    settings.QDRANT_HOST = None

    call_command("delete_mit_edx_resources")

    backends["remove_points"].assert_not_called()
    assert backends["conn"].delete_by_query.call_count == 2


def test_skips_missing_collection(backends):
    """A collection that doesn't exist is already clean"""
    backends["qdrant"].collection_exists.side_effect = lambda name: (
        name == CONTENT_FILES_COLLECTION_NAME
    )

    call_command("delete_mit_edx_resources")

    backends["remove_points"].assert_called_once_with(
        {"platform": "edx"}, collection_name=CONTENT_FILES_COLLECTION_NAME, wait=True
    )


def test_qdrant_failure_still_cleans_the_rest(backends):
    """A Qdrant error is reported after OpenSearch and the cache are done"""
    backends["remove_points"].side_effect = RuntimeError("qdrant down")
    edx = _resource("mit_edx", PlatformType.edx.name)

    with pytest.raises(CommandError, match="qdrant down"):
        call_command("delete_mit_edx_resources")

    assert not LearningResource.objects.filter(pk=edx.pk).exists()
    assert backends["conn"].delete_by_query.call_count == 2
    backends["cache"].assert_called_once_with()


@pytest.mark.parametrize(
    "response",
    [
        {"timed_out": True, "failures": []},
        {"failures": [{"cause": "x"}]},
        {"version_conflicts": 3, "failures": []},
    ],
)
def test_partial_opensearch_delete_fails(backends, response):
    """A delete_by_query that leaves documents behind is a failure"""
    backends["conn"].delete_by_query.return_value = response

    with pytest.raises(CommandError, match="OpenSearch course"):
        call_command("delete_mit_edx_resources")

    backends["cache"].assert_called_once_with()


def test_other_source_on_edx_skips_purge(backends):
    """The platform purge would hit another source's docs, so it's skipped"""
    edx = _resource("mit_edx", PlatformType.edx.name)
    _resource("xpro", PlatformType.edx.name)

    with pytest.raises(CommandError, match="edx purge skipped"):
        call_command("delete_mit_edx_resources")

    assert not LearningResource.objects.filter(pk=edx.pk).exists()
    backends["conn"].delete_by_query.assert_not_called()
    backends["remove_points"].assert_not_called()
