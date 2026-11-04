"""Tests for channel cache invalidation"""

from requests import RequestException

from channels import api


def test_clear_featured_caches(mocker):
    """
    Clears the Redis prefix first, then hard-purges the channel pages and the
    homepage by path key in one request
    """
    manager = mocker.Mock()
    manager.attach_mock(
        mocker.patch("channels.api.clear_views_cache"), "clear_views_cache"
    )
    manager.attach_mock(
        mocker.patch("channels.api.call_fastly_purge_surrogate_keys"), "purge_keys"
    )

    api.clear_featured_caches(
        ["https://learn.example/c/unit/mitx", "https://learn.example/c/topic/math"]
    )

    assert manager.mock_calls == [
        mocker.call.clear_views_cache(key_prefix="featured_resources"),
        mocker.call.purge_keys(
            ["path:/c/unit/mitx", "path:/c/topic/math", "path:/"], timeout=5
        ),
    ]


def test_clear_featured_caches_purges_after_redis_failure(mocker):
    """A failed Redis clear must not skip the Fastly purge"""
    mocker.patch("channels.api.clear_views_cache", side_effect=Exception("redis down"))
    mock_purge_keys = mocker.patch("channels.api.call_fastly_purge_surrogate_keys")

    api.clear_featured_caches(["https://learn.example/c/unit/mitx"])

    mock_purge_keys.assert_called_once()


def test_clear_featured_caches_purges_in_batches(mocker):
    """Keys are purged in batches, and a failed batch doesn't skip the rest"""
    mocker.patch("channels.api.clear_views_cache")
    mocker.patch("channels.api.PURGE_BATCH_SIZE", 2)
    mock_purge_keys = mocker.patch(
        "channels.api.call_fastly_purge_surrogate_keys",
        side_effect=[RequestException("fastly down"), None],
    )

    api.clear_featured_caches(
        ["https://learn.example/c/unit/mitx", "https://learn.example/c/topic/math"]
    )

    assert [c.args[0] for c in mock_purge_keys.call_args_list] == [
        ["path:/c/unit/mitx", "path:/c/topic/math"],
        ["path:/"],
    ]
