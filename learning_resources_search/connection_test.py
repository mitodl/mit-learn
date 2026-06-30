"""
Tests for the indexing API
"""

import pytest
from django.conf import settings

from learning_resources_search.connection import (
    configure_connections,
    get_active_aliases,
)
from learning_resources_search.constants import COURSE_TYPE, IndexestoUpdate


def test_configure_connections_uses_pool_maxsize(mocker):
    """configure_connections must pass pool_maxsize, not connections_per_node.

    opensearch-py's Transport only reads pool_maxsize; connections_per_node is
    silently dropped, leaving urllib3 at its default maxsize of 1.
    """
    mock_configure = mocker.patch(
        "learning_resources_search.connection.connections.configure"
    )
    configure_connections()
    call_kwargs = mock_configure.call_args[1]["default"]
    assert "pool_maxsize" in call_kwargs, (
        "pool_maxsize must be passed to connections.configure; "
        "connections_per_node is ignored by opensearch-py Transport"
    )
    assert call_kwargs["pool_maxsize"] == settings.OPENSEARCH_CONNECTIONS_PER_NODE
    assert "connections_per_node" not in call_kwargs


@pytest.mark.parametrize(
    "index_types",
    [
        IndexestoUpdate.current_index.value,
        IndexestoUpdate.reindexing_index.value,
        IndexestoUpdate.all_indexes.value,
    ],
)
@pytest.mark.parametrize("indexes_exist", [True, False])
@pytest.mark.parametrize("object_types", [None, [COURSE_TYPE]])
def test_get_active_aliases(mocker, index_types, indexes_exist, object_types):
    """Test for get_active_aliases"""
    conn = mocker.Mock()
    conn.indices.exists.return_value = indexes_exist

    active_aliases = get_active_aliases(
        conn, object_types=object_types, index_types=index_types
    )

    if indexes_exist:
        if object_types:
            if index_types == IndexestoUpdate.all_indexes.value:
                assert active_aliases == [
                    "testindex_course_default",
                    "testindex_course_reindexing",
                ]
            elif index_types == IndexestoUpdate.current_index.value:
                assert active_aliases == ["testindex_course_default"]
            elif index_types == IndexestoUpdate.reindexing_index.value:
                assert active_aliases == ["testindex_course_reindexing"]
        elif index_types == IndexestoUpdate.all_indexes.value:
            assert active_aliases == [
                "testindex_percolator_default",
                "testindex_percolator_reindexing",
                "testindex_combined_hybrid_default",
                "testindex_combined_hybrid_reindexing",
                "testindex_course_default",
                "testindex_course_reindexing",
                "testindex_program_default",
                "testindex_program_reindexing",
                "testindex_podcast_default",
                "testindex_podcast_reindexing",
                "testindex_podcast_episode_default",
                "testindex_podcast_episode_reindexing",
                "testindex_video_default",
                "testindex_video_reindexing",
                "testindex_video_playlist_default",
                "testindex_video_playlist_reindexing",
                "testindex_document_default",
                "testindex_document_reindexing",
            ]
        elif index_types == IndexestoUpdate.current_index.value:
            assert active_aliases == [
                "testindex_percolator_default",
                "testindex_combined_hybrid_default",
                "testindex_course_default",
                "testindex_program_default",
                "testindex_podcast_default",
                "testindex_podcast_episode_default",
                "testindex_video_default",
                "testindex_video_playlist_default",
                "testindex_document_default",
            ]
        elif index_types == IndexestoUpdate.reindexing_index.value:
            assert active_aliases == [
                "testindex_percolator_reindexing",
                "testindex_combined_hybrid_reindexing",
                "testindex_course_reindexing",
                "testindex_program_reindexing",
                "testindex_podcast_reindexing",
                "testindex_podcast_episode_reindexing",
                "testindex_video_reindexing",
                "testindex_video_playlist_reindexing",
                "testindex_document_reindexing",
            ]
    else:
        assert active_aliases == []
