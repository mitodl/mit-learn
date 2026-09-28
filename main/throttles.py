"""Custom DRF throttles for mit-learn."""

from django.core.cache import caches
from rest_framework.throttling import ScopedRateThrottle


class RedisScopedRateThrottle(ScopedRateThrottle):
    """ScopedRateThrottle backed by the shared redis cache.

    DRF's default binds to the process-local ``default`` cache, which would not
    share counters across gunicorn workers. The cache is resolved lazily (per
    request) via a property rather than captured at import, so tests that swap
    the ``redis`` alias for a DummyCache (conftest ``_use_dummy_redis_cache_backend``)
    take effect. DRF only reads ``self.cache``, so a read-only property is safe.
    """

    @property
    def cache(self):
        """Return the shared redis cache backend."""
        return caches["redis"]
