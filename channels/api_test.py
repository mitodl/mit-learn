"""Tests for channel cache invalidation"""

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
