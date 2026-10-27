"""Tests for CachePolicyMiddleware."""

from http import HTTPStatus

import pytest
from django.conf import settings as django_settings
from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.urls import reverse

from main.cache_policy import CachePolicy, set_cache_policy
from main.middleware.cache_policy import CachePolicyMiddleware

# No django_db marker: the middleware reads `user.is_authenticated` and the
# response's cookies, nothing that touches the database. AnonymousUser is a
# plain object.


def _request(mocker, *, authenticated: bool):
    """Build a request stand-in carrying only what the middleware reads."""
    user = mocker.Mock(is_authenticated=authenticated)
    return mocker.Mock(user=user)


def _middleware(response, mocker):
    """Build the middleware around a get_response returning `response`."""
    return CachePolicyMiddleware(mocker.Mock(return_value=response))


def test_authenticated_response_is_no_store(mocker):
    """The requirement: user-specific responses must not be stored."""
    response = _middleware(HttpResponse(), mocker)(_request(mocker, authenticated=True))
    assert "no-store" in response["Cache-Control"]


def test_anonymous_response_is_left_alone(mocker):
    """
    THE OCW NO-REGRESSION TEST.

    ocw.mit.edu and draft.ocw.mit.edu are in Learn's production CORS allowlist
    and ocw-hugo-themes ships FEATURE_ENABLE_LEARN_INTEGRATION, so OCW calls
    public endpoints from the browser today, anonymously -- and the search
    switchover (mitodl/hq#12184) raises that volume. A blanket no-store would
    be a regression, not a fix. Anonymous requests must come out untouched.
    """
    response = _middleware(HttpResponse(), mocker)(
        _request(mocker, authenticated=False)
    )
    assert not response.has_header("Cache-Control")


def test_cookie_bearing_anonymous_response_is_no_store(mocker):
    """
    /api/v0/users/me/ is reachable anonymously and carries ensure_csrf_cookie,
    so it returns a cookie with no authenticated user. The authentication
    clause alone would leave it cacheable.
    """
    response = HttpResponse()
    response.set_cookie("csrftoken", "abc123")
    result = _middleware(response, mocker)(_request(mocker, authenticated=False))
    assert "no-store" in result["Cache-Control"]


def test_existing_cache_control_is_not_clobbered(mocker):
    """
    SILENT FAILURE GUARD. podcast_rss_feed uses Django's cache_page, which
    sets Cache-Control: max-age=900. Overwriting it would uncache the RSS feed
    with nothing anywhere to notice.
    """
    response = HttpResponse()
    response["Cache-Control"] = "max-age=900"
    result = _middleware(response, mocker)(_request(mocker, authenticated=True))
    assert result["Cache-Control"] == "max-age=900"


def test_shared_stamp_survives_an_authenticated_request(mocker):
    """
    SILENT FAILURE GUARD. A cache_page_for_all_users response is shared by
    design. Without the stamp winning over the authenticated default, signed-in
    users would quietly lose caching on search and channel pages.
    """
    response = set_cache_policy(HttpResponse(), CachePolicy.SHARED)
    result = _middleware(response, mocker)(_request(mocker, authenticated=True))
    assert not result.has_header("Cache-Control")


def test_kill_switch_disables_the_middleware(mocker, settings):
    """
    SILENT FAILURE GUARD. A kill switch nobody tested is not a kill switch,
    and this one is the rollback plan if the header regresses a consumer.
    """
    settings.CACHE_POLICY_ENABLED = False
    response = _middleware(HttpResponse(), mocker)(_request(mocker, authenticated=True))
    assert not response.has_header("Cache-Control")


def test_missing_user_attribute_is_treated_as_private(mocker):
    """
    Reordering the middleware chain so request.user is absent should degrade
    to the safe side, not raise on the response path.
    """
    request = mocker.Mock(spec=[])  # no `user` attribute at all
    response = _middleware(HttpResponse(), mocker)(request)
    assert "no-store" in response["Cache-Control"]


def test_anonymous_user_instance_is_not_private(mocker):
    """A real AnonymousUser, not just a mock, reads as not authenticated."""
    request = mocker.Mock(user=AnonymousUser())
    response = _middleware(HttpResponse(), mocker)(request)
    assert not response.has_header("Cache-Control")


def test_middleware_runs_after_the_cookie_setting_middlewares():
    """
    SILENT FAILURE GUARD -- the ordering trap this design turns on.

    Django runs middleware response phases bottom-up, so an entry listed
    EARLIER runs LATER on the way out. SessionMiddleware and
    CsrfViewMiddleware set their cookies during their own response phase, so
    this middleware must be listed before them to see those cookies.

    Listed at the end instead, it would run first on the way out, observe no
    cookies, and silently stop marking anonymous cookie-bearing responses
    private -- with every other test in this file still passing, because they
    construct the middleware directly rather than through the configured
    chain.

    The assertion is on relative index, not a literal position, so inserting
    an unrelated middleware does not fail it spuriously.
    """
    middleware = list(django_settings.MIDDLEWARE)
    ours = middleware.index("main.middleware.cache_policy.CachePolicyMiddleware")

    for cookie_setter in (
        "django.contrib.sessions.middleware.SessionMiddleware",
        "django.middleware.csrf.CsrfViewMiddleware",
    ):
        assert ours < middleware.index(cookie_setter), (
            f"CachePolicyMiddleware must be listed before {cookie_setter} so "
            "its response phase runs after that middleware has set cookies"
        )


# -- Through the configured middleware chain -------------------------------
#
# Every test above constructs CachePolicyMiddleware directly, which is fast
# but bypasses settings.MIDDLEWARE entirely -- so none of them would notice
# the middleware being unregistered, mis-ordered, or shadowed. These go
# through Django's real request/response cycle against real endpoints.


@pytest.mark.django_db
def test_chain_marks_an_authenticated_api_response_no_store(user_client):
    """A signed-in request to a real endpoint comes back no-store."""
    response = user_client.get(reverse("profile:v0:users_api-me"))

    assert response.status_code == HTTPStatus.OK
    assert "no-store" in response["Cache-Control"]


@pytest.mark.django_db
def test_chain_marks_anonymous_users_me_no_store(client):
    """
    /api/v0/users/me/ permits anonymous access but sets a CSRF cookie, so the
    cookie clause has to catch it -- the authenticated clause cannot. This is
    the case that justifies that clause existing, exercised for real.
    """
    response = client.get(reverse("profile:v0:users_api-me"))

    assert response.status_code == HTTPStatus.OK
    assert response.cookies, "expected ensure_csrf_cookie to set a cookie"
    assert "no-store" in response["Cache-Control"]


@pytest.mark.django_db
def test_chain_leaves_an_anonymous_public_response_cacheable(client):
    """
    THE OCW NO-REGRESSION CASE, through the real chain. An anonymous request
    to a public endpoint must not come back no-store.
    """
    response = client.get(reverse("lr:v1:courses_api-list"))

    assert response.status_code == HTTPStatus.OK
    assert "no-store" not in response.get("Cache-Control", "")
