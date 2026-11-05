"""Tests for website_content CDN purge tasks"""

from website_content.tasks import fastly_purge_website_content_list


def test_fastly_purge_website_content_list_purges_path_key(mocker):
    """A listing page is purged by its `path:` key, covering ?page= variants"""
    # @single_task takes a Redis lock, and the test cache backend has no Redis
    redis = mocker.patch("mitol.common.decorators.get_redis_connection").return_value
    redis.lock.return_value.acquire.return_value = True
    mock_purge = mocker.patch("website_content.tasks.call_fastly_purge_surrogate_keys")

    fastly_purge_website_content_list("/articles")

    mock_purge.assert_called_once_with(["path:/articles"])
