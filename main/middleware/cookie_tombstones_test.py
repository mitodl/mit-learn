"""Tests for cookie tombstone middleware."""

# pylint: disable=redefined-outer-name
import pytest
from django.core.exceptions import ImproperlyConfigured

from main.middleware.cookie_tombstones import (
    CookieTombstone,
    CookieTombstoneMiddleware,
    parse_cookie_tombstones,
)


@pytest.fixture
def middleware(mocker):
    """Create middleware with mocked get_response."""
    return CookieTombstoneMiddleware(mocker.Mock())


def test_parse_cookie_tombstones():
    """Cookie tombstones should parse from JSON object values."""
    parsed = parse_cookie_tombstones(
        """
        [
            {"name": "csrftoken", "domain": ".learn.mit.edu", "path": "/"},
            {"name": "csrftoken"},
            {"name": "sessionid", "path": "/accounts"}
        ]
        """
    )
    assert parsed == [
        CookieTombstone(name="csrftoken", domain=".learn.mit.edu", path="/"),
        CookieTombstone(name="csrftoken", domain=None, path="/"),
        CookieTombstone(name="sessionid", domain=None, path="/accounts"),
    ]


def test_parse_cookie_tombstones_invalid():
    """Invalid cookie tombstone values should raise ImproperlyConfigured."""
    with pytest.raises(ImproperlyConfigured):
        parse_cookie_tombstones(
            """
            [{"name": "csrftoken", "domain": "/accounts"}]
            """
        )

    with pytest.raises(ImproperlyConfigured):
        parse_cookie_tombstones(
            """
            [{"domain": ".learn.mit.edu"}]
            """
        )

    with pytest.raises(ImproperlyConfigured):
        parse_cookie_tombstones("not-json")


def test_delete_matching_domain_cookie_and_host_only(middleware, mocker, settings):
    """Matching domain tombstones should delete both domain and host-only cookies."""
    settings.COOKIE_TOMBSTONES = [
        CookieTombstone(name="csrftoken", domain=".learn.mit.edu", path="/")
    ]
    request = mocker.Mock()
    request.COOKIES = {"csrftoken": "abc"}
    request.get_host.return_value = "api.learn.mit.edu"

    middleware(request)

    response = middleware.get_response.return_value
    assert response.delete_cookie.call_count == 2
    response.delete_cookie.assert_any_call(
        "csrftoken",
        path="/",
        domain=".learn.mit.edu",
    )
    response.delete_cookie.assert_any_call(
        "csrftoken",
        path="/",
        domain=None,
    )


def test_skip_when_host_not_in_cookie_domain(middleware, mocker, settings):
    """Domain tombstones should not apply outside the tombstone domain scope."""
    settings.COOKIE_TOMBSTONES = [
        CookieTombstone(name="csrftoken", domain=".learn.mit.edu", path="/")
    ]
    request = mocker.Mock()
    request.COOKIES = {"csrftoken": "abc"}
    request.get_host.return_value = "example.org"

    middleware(request)

    response = middleware.get_response.return_value
    response.delete_cookie.assert_not_called()


def test_skip_when_cookie_not_present(middleware, mocker, settings):
    """No deletion should occur when the cookie name is not present in request cookies."""
    settings.COOKIE_TOMBSTONES = [
        CookieTombstone(name="csrftoken", domain=".learn.mit.edu", path="/")
    ]
    request = mocker.Mock()
    request.COOKIES = {"other_cookie": "abc"}
    request.get_host.return_value = "api.learn.mit.edu"

    middleware(request)

    response = middleware.get_response.return_value
    response.delete_cookie.assert_not_called()
    request.get_host.assert_not_called()


def test_skip_host_lookup_for_host_only_tombstones(middleware, mocker, settings):
    """Host lookups should be skipped when only host-only tombstones apply."""
    settings.COOKIE_TOMBSTONES = [
        CookieTombstone(name="csrftoken", domain=None, path="/")
    ]
    request = mocker.Mock()
    request.COOKIES = {"csrftoken": "abc"}

    middleware(request)

    response = middleware.get_response.return_value
    response.delete_cookie.assert_called_once_with(
        "csrftoken",
        path="/",
        domain=None,
    )
    request.get_host.assert_not_called()


def test_domain_host_lookup_is_lazy_and_single_call(middleware, mocker, settings):
    """Host should be fetched lazily and at most once for domain tombstones."""
    settings.COOKIE_TOMBSTONES = [
        CookieTombstone(name="other_cookie", domain=".learn.mit.edu", path="/"),
        CookieTombstone(name="csrftoken", domain=".learn.mit.edu", path="/"),
        CookieTombstone(name="csrftoken", domain=".open.edx.org", path="/"),
    ]
    request = mocker.Mock()
    request.COOKIES = {"csrftoken": "abc"}
    request.get_host.return_value = "api.learn.mit.edu"

    middleware(request)

    response = middleware.get_response.return_value
    response.delete_cookie.assert_any_call(
        "csrftoken",
        path="/",
        domain=".learn.mit.edu",
    )
    request.get_host.assert_called_once_with()
