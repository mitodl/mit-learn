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

    1. A `Set-Cookie` response is private, whatever anything else says. The
       cookie belongs to one session, so storing the response in a shared
       cache hands that session to whoever gets it next.
    2. Otherwise an existing `Cache-Control` wins. A view that set one meant
       it; `podcast_rss_feed` uses Django's `cache_page` and must keep its
       `max-age`.
    3. Otherwise an explicit stamp (`main.cache_policy.set_cache_policy`).
       The Redis cache decorators in `main.utils` stamp SHARED when they
       actually serve a response shared across users.
    4. Otherwise: private if the request is authenticated.

    The cookie clause is not redundant with the authentication clause.
    `/api/v0/users/me/` is reachable anonymously — `CurrentUserRetrieveViewSet`
    permits anonymous access and returns `request.user` either way — and it
    carries `ensure_csrf_cookie`, so an anonymous request there produces a
    cookie-bearing response that the authentication clause alone would leave
    cacheable.

    It outranks the other two because a cookie can be attached to a response
    the view already classified. `ApisixUserMiddleware` calls `login()`, which
    cycles the session, so the first request of a signed-in session can pick
    up a `Set-Cookie` on the way out — including on a SHARED search response
    or on the RSS feed, which carries its own `max-age=900`. Merging rather
    than replacing means the feed keeps that `max-age` for every other
    request.

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

        # Outranks both the view's own header and the stamp: whatever this
        # response is, it is carrying one session's cookie out with it.
        if self._sets_cookie(response):
            return apply_cache_policy(response, CachePolicy.PRIVATE)

        # A view that set its own Cache-Control has already decided.
        if response.has_header("Cache-Control"):
            return response

        policy = get_cache_policy(response)
        if policy is None and self._reflects_one_user(request):
            policy = CachePolicy.PRIVATE

        if policy is not None:
            apply_cache_policy(response, policy)

        return response

    @staticmethod
    def _sets_cookie(response) -> bool:
        """Whether the response carries a `Set-Cookie`."""
        return bool(getattr(response, "cookies", None))

    @staticmethod
    def _reflects_one_user(request) -> bool:
        """
        Whether this response was computed for a signed-in user.

        `request.user` should always be set by the time the response phase
        runs, even though this middleware is listed ahead of
        `AuthenticationMiddleware`. If it is not, the chain has been
        reordered and there is no way to tell who this response belongs to,
        so it is treated as private: over-caching is the failure mode this
        exists to prevent, and losing caching is at least visible.
        """
        user = getattr(request, "user", None)
        return user is None or user.is_authenticated
