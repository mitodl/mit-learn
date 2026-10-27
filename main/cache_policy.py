"""
Classification of responses for HTTP caching, and the `Cache-Control` each
class earns.

Two concerns, deliberately kept apart:

- **Classification** — is this response safe for a cache shared between users?
  Decided per response, by the view or by the middleware's default.
- **Policy** — what `Cache-Control` a class produces. One mapping, below.

Today there is one interesting class (`PRIVATE`) and one header value, so the
split looks like overhead. It exists because the API currently sends no
`Cache-Control` at all — public endpoints included — so a later change that
wants `public, s-maxage=N` on shared responses needs exactly this
classification and should not have to invent it. See
docs/rfcs/0007-security-headers.md, D5.

Nothing here builds or parses the header by hand: `django.utils.cache.
patch_cache_control` merges directives into whatever is already present, which
is what lets a view that set its own `Cache-Control` keep it.
"""

from enum import StrEnum
from functools import wraps

from django.utils.cache import patch_cache_control

# Attribute stamped on the response object. Private by convention; read and
# written through the accessors below so the spelling lives in one place.
_CACHE_POLICY_ATTR = "_mitlearn_cache_policy"


class CachePolicy(StrEnum):
    """How a response may be cached."""

    PRIVATE = "private"
    """Never store. The response reflects one user's session."""

    SHARED = "shared"
    """Safe to serve to any user. Says nothing about for how long."""


# Keyword arguments for patch_cache_control(), per policy.
#
# PRIVATE pairs `private` with `no-store`. `no-store` alone is the requirement;
# `private` is free and still directs a shared cache correctly if it predates
# or mishandles `no-store`.
#
# SHARED is empty on purpose: this chunk only has to stop user-specific
# responses being stored. Giving shared responses an explicit `s-maxage` is a
# real CDN change and belongs in its own soak — this is the seam it would use.
CACHE_CONTROL_BY_POLICY: dict[CachePolicy, dict[str, bool | int]] = {
    CachePolicy.PRIVATE: {"no_store": True, "private": True},
    CachePolicy.SHARED: {},
}


def set_cache_policy(response, policy: CachePolicy):
    """
    Record how `response` may be cached.

    The stamp travels on the response object only, never into a cache: the
    Redis view cache stores rendered bytes, not headers (see
    `_cached_response` in main.utils), so the policy is re-derived on every
    request.
    """
    setattr(response, _CACHE_POLICY_ATTR, policy)
    return response


def get_cache_policy(response) -> CachePolicy | None:
    """Return the policy stamped on `response`, or None if it carries none."""
    return getattr(response, _CACHE_POLICY_ATTR, None)


def apply_cache_policy(response, policy: CachePolicy):
    """Write `policy`'s directives onto `response`, merging with any present."""
    directives = CACHE_CONTROL_BY_POLICY[policy]
    if directives:
        patch_cache_control(response, **directives)
    return response


def cache_policy(policy: CachePolicy):
    """
    Declare a view's responses `policy`, overriding the middleware default.

    For a view whose cacheability is not already implied by the Redis cache
    decorators in main.utils — a public endpoint that does not use them, say,
    which would otherwise be marked private the moment a signed-in user
    requests it.

    Unused in this chunk outside its own test. It exists so declaring intent
    does not require editing the middleware.
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            return set_cache_policy(view_func(request, *args, **kwargs), policy)

        return wrapper

    return decorator
