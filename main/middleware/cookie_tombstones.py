"""Middleware for deleting legacy cookies during migrations."""

from dataclasses import dataclass

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

TOMBSTONE_FORMAT_PARTS = 3
DOMAIN_PART_INDEX = 1
PATH_PART_INDEX = 2


@dataclass(frozen=True)
class CookieTombstone:
    """Cookie signature that should be deleted from responses."""

    name: str
    domain: str | None = None
    path: str = "/"


def parse_cookie_tombstones(tombstones: list[str]) -> list[CookieTombstone]:
    """
    Parse tombstones from a list of pipe-delimited values.

    Each item has shape: ``name|domain|path``, where ``domain`` and ``path``
    are optional.

    Examples:
        Input:
            [
                "csrftoken|.learn.mit.edu|/",
                "legacy_cookie",
            ]

        Output:
            [
                CookieTombstone(name="csrftoken", domain=".learn.mit.edu", path="/"),
                CookieTombstone(name="legacy_cookie", domain=None, path="/"),
            ]
    """
    parsed_tombstones: list[CookieTombstone] = []

    for tombstone in tombstones:
        parts = [part.strip() for part in tombstone.split("|")]
        if len(parts) > TOMBSTONE_FORMAT_PARTS:
            msg = (
                "CSRF_COOKIE_TOMBSTONES entries must use 'name|domain|path' format: "
                f"{tombstone}"
            )
            raise ImproperlyConfigured(msg)

        name = parts[0]
        domain = parts[DOMAIN_PART_INDEX] if len(parts) > DOMAIN_PART_INDEX else None
        path = parts[PATH_PART_INDEX] if len(parts) > PATH_PART_INDEX else "/"

        if not name:
            msg = "CSRF_COOKIE_TOMBSTONES entries must include a cookie name"
            raise ImproperlyConfigured(msg)

        if domain == "":
            domain = None
        elif domain and not domain.lstrip("."):
            msg = (
                "CSRF_COOKIE_TOMBSTONES entries must use a valid domain when provided: "
                f"{tombstone}"
            )
            raise ImproperlyConfigured(msg)

        if not path:
            path = "/"
        elif not path.startswith("/"):
            msg = (
                "CSRF_COOKIE_TOMBSTONES entries must use a path starting with '/': "
                f"{tombstone}"
            )
            raise ImproperlyConfigured(msg)

        parsed_tombstones.append(CookieTombstone(name=name, domain=domain, path=path))

    return parsed_tombstones


def _host_in_domain_scope(host: str, domain: str | None) -> bool:
    """Check whether a request host is in scope for a cookie domain."""
    if domain is None:
        return True

    normalized_domain = domain.lstrip(".").lower()
    normalized_host = host.split(":", 1)[0].lower()
    return normalized_host == normalized_domain or normalized_host.endswith(
        f".{normalized_domain}"
    )


class CookieTombstoneMiddleware:
    """
    Delete configured legacy cookies from matching responses.

    Expected pre-parsed values in ``settings.CSRF_COOKIE_TOMBSTONES``:
    [
        CookieTombstone(name="csrftoken", domain=".learn.mit.edu", path="/"),
        CookieTombstone(name="legacy_cookie", domain=None, path="/"),
    ]
    """

    def __init__(self, get_response):
        """Initialize middleware with Django's response callable."""
        self.get_response = get_response

    def _delete_cookie_once(
        self,
        response,
        deleted_signatures: set[tuple[str, str, str | None]],
        *,
        name: str,
        path: str,
        domain: str | None,
    ) -> None:
        signature = (name, path, domain)
        if signature in deleted_signatures:
            return

        response.delete_cookie(name, path=path, domain=domain)
        deleted_signatures.add(signature)

    def __call__(self, request):
        """Delete configured cookies from matching responses."""
        response = self.get_response(request)

        tombstones = settings.CSRF_COOKIE_TOMBSTONES
        if not tombstones or not request.COOKIES:
            return response

        request_host = request.get_host()
        deleted_signatures: set[tuple[str, str, str | None]] = set()
        for tombstone in tombstones:
            if tombstone.name not in request.COOKIES:
                continue
            if not _host_in_domain_scope(request_host, tombstone.domain):
                continue

            self._delete_cookie_once(
                response,
                deleted_signatures,
                name=tombstone.name,
                path=tombstone.path,
                domain=tombstone.domain,
            )
            # Also clear host-only cookie variants while the migration is active.
            if tombstone.domain is not None:
                self._delete_cookie_once(
                    response,
                    deleted_signatures,
                    name=tombstone.name,
                    path=tombstone.path,
                    domain=None,
                )

        return response
