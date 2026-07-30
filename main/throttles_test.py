"""Tests for main.throttles."""

from django.core.cache import caches
from rest_framework.throttling import ScopedRateThrottle

from main.throttles import RedisScopedRateThrottle


def test_redis_scoped_throttle_is_scoped():
    """It subclasses ScopedRateThrottle (per-scope, per-user keying)."""
    assert issubclass(RedisScopedRateThrottle, ScopedRateThrottle)


def test_redis_scoped_throttle_resolves_redis_alias_lazily():
    """`cache` resolves to the current `redis` alias at access time.

    Resolving lazily (not at import) is what lets the autouse
    `_use_dummy_redis_cache_backend` fixture take effect in tests.
    """
    # `cache` is a property (resolved per access), not an attribute captured at
    # import — that is precisely what lets the autouse dummy-redis fixture apply.
    assert isinstance(RedisScopedRateThrottle.__dict__["cache"], property)
    assert RedisScopedRateThrottle().cache is caches["redis"]
