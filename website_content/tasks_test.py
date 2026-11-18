"""Tests for website_content CDN purge tasks"""

import pytest
from requests import RequestException

from website_content.tasks import (
    fastly_purge_relative_url,
    fastly_purge_website_content_list,
)


def test_fastly_purge_website_content_list_purges_path_key(mocker):
    """A listing page is purged by its `path:` key, covering ?page= variants"""
    mock_purge = mocker.patch("website_content.tasks.call_fastly_purge_surrogate_keys")

    fastly_purge_website_content_list("/articles")

    mock_purge.assert_called_once_with(["path:/articles"])


@pytest.mark.parametrize(
    "task", [fastly_purge_relative_url, fastly_purge_website_content_list]
)
def test_queued_purge_retries_failed_request(mocker, task):
    """A queued purge whose request fails is run again"""
    mock_purge = mocker.patch(
        "website_content.tasks.call_fastly_purge_surrogate_keys",
        side_effect=[RequestException("fastly down"), {}],
    )

    # throw=False: an eager apply() otherwise raises the Retry to its caller
    # rather than running it
    result = task.apply(args=["/news"], throw=False)

    assert result.successful()
    assert mock_purge.call_count == 2
