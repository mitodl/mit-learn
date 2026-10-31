"""Tests for the cache policy classification layer."""

import pytest
from django.http import HttpResponse

from main.cache_policy import (
    CACHE_CONTROL_BY_POLICY,
    CachePolicy,
    apply_cache_policy,
    cache_policy,
    get_cache_policy,
    set_cache_policy,
)


def test_unstamped_response_has_no_policy():
    """A response nothing has classified carries no policy, not a default."""
    assert get_cache_policy(HttpResponse()) is None


def test_set_and_get_round_trip():
    """set_cache_policy stores what get_cache_policy returns."""
    response = HttpResponse()
    set_cache_policy(response, CachePolicy.SHARED)
    assert get_cache_policy(response) == CachePolicy.SHARED


@pytest.mark.parametrize("policy", list(CachePolicy))
def test_every_policy_has_directives_defined(policy):
    """
    Adding a CachePolicy member without a CACHE_CONTROL_BY_POLICY entry would
    raise KeyError in the middleware, on the response path, in production.
    """
    assert policy in CACHE_CONTROL_BY_POLICY


def test_private_sets_no_store():
    """PRIVATE is the whole point: the response must not be stored anywhere."""
    response = apply_cache_policy(HttpResponse(), CachePolicy.PRIVATE)
    directives = response["Cache-Control"]
    assert "no-store" in directives
    assert "private" in directives


def test_shared_sets_nothing_today():
    """
    SHARED deliberately adds no header in this chunk -- it only has to stop
    the default from marking the response private. Asserted so that giving it
    an s-maxage later is a conscious change with a failing test, not a silent
    CDN behaviour change.
    """
    response = apply_cache_policy(HttpResponse(), CachePolicy.SHARED)
    assert not response.has_header("Cache-Control")


def test_private_merges_with_an_existing_directive():
    """
    patch_cache_control merges rather than replaces. A view that set its own
    directive keeps it even if the policy is applied on top.
    """
    response = HttpResponse()
    response["Cache-Control"] = "max-age=900"
    apply_cache_policy(response, CachePolicy.PRIVATE)
    directives = response["Cache-Control"]
    assert "max-age=900" in directives
    assert "no-store" in directives


def test_cache_policy_decorator_stamps_the_view_response():
    """The decorator is the declared-intent escape hatch for a view."""

    @cache_policy(CachePolicy.SHARED)
    def view(request):
        return HttpResponse()

    assert get_cache_policy(view(None)) == CachePolicy.SHARED


def test_cache_policy_decorator_preserves_view_metadata():
    """functools.wraps, so Django and DRF introspection still work."""

    @cache_policy(CachePolicy.SHARED)
    def my_view(request):
        """Docstring."""
        return HttpResponse()

    assert my_view.__name__ == "my_view"
    assert my_view.__doc__ == "Docstring."
