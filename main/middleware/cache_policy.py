"""Middleware that sets `Cache-Control` from a response's cache policy."""

import logging

from django.conf import settings

from main.cache_policy import CachePolicy, apply_cache_policy, get_cache_policy

log = logging.getLogger(__name__)


class CachePolicyMiddleware:
    """
    Give every response a `Cache-Control`, defaulting user-specific ones to
    `no-store`.

    The API returns authenticated responses with no `Cache-Control` at all,
    which is the finding this closes (mitodl/hq#14080). See
    docs/rfcs/0007-security-headers.md, D5.

    **Fails closed.** A response is treated as private unless something says
    otherwise, so a new user-specific endpoint is covered the day it is
    written. The alternative — a DRF mixin or per-view decorator — is opt-in,
    and forgetting it produces no failure of any kind, which is exactly how
    the original finding arose.

    Three inputs, in order:

    1. An existing `Cache-Control` wins outright. A view that set one meant
       it; `podcast_rss_feed` uses Django's `cache_page` and must keep its
       `max-age`.
    2. An explicit stamp (`main.cache_policy.set_cache_policy`) wins next.
       The Redis cache decorators in `main.utils` stamp SHARED when they
       actually serve a response shared across users.
    3. Otherwise: private if the request is authenticated, or if the response
       sets a cookie.

    The cookie clause is not redundant. `/api/v0/users/me/` is reachable
    anonymously — `CurrentUserRetrieveViewSet` permits anonymous access and
    returns `request.user` either way — and it carries `ensure_csrf_cookie`,
    so an anonymous request there produces a cookie-bearing response that the
    authentication clause alone would leave cacheable.

    **Position in MIDDLEWARE matters, and getting it wrong fails silently.**
    Django runs response phases bottom-up, so the first entry's response code
    runs last. `SessionMiddleware` and `CsrfViewMiddleware` set their cookies
    during their own response phase; this middleware has to run after them to
    see those cookies, which means being listed *before* them. It sits
    directly after `SecurityMiddleware`. Asserted in cache_policy_test.py.

    Reading `request.user` from that position is still safe: it is only read
    on the way out, by which point `AuthenticationMiddleware` and
    `ApisixUserMiddleware` have both run.
    """

    def __init__(self, get_response):
        """One-time configuration."""
        self.get_response = get_response

    def __call__(self, request):
        """Apply the response's cache policy on the way out."""
        response = self.get_response(request)

        if not settings.CACHE_POLICY_ENABLED:
            return response

        # A view that set its own Cache-Control has already decided.
        if response.has_header("Cache-Control"):
            return response

        policy = get_cache_policy(response)
        if policy is None and self._is_user_specific(request, response):
            policy = CachePolicy.PRIVATE

        if policy is not None:
            apply_cache_policy(response, policy)

        return response

    @staticmethod
    def _is_user_specific(request, response) -> bool:
        """
        Whether this response reflects one user and must not be stored.

        `request.user` should always be set by the time the response phase
        runs, even though this middleware is listed ahead of
        `AuthenticationMiddleware`. If it is not, the chain has been
        reordered and there is no way to tell who this response belongs to,
        so it is treated as private: over-caching is the failure mode this
        exists to prevent, and losing caching is at least visible.
        """
        user = getattr(request, "user", None)
        if user is None or user.is_authenticated:
            return True
        # A Set-Cookie response is never safe for a shared cache, whether or
        # not anyone is signed in.
        return bool(getattr(response, "cookies", None))
