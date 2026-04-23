"""Middleware for deleting legacy cookies during migrations."""

import json
import re
from dataclasses import dataclass

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

VALID_COOKIE_DOMAIN_RE = re.compile(r"^\.?[A-Za-z0-9.-]+$")
ALLOWED_TOMBSTONE_FIELDS = {"name", "domain", "path"}


@dataclass(frozen=True)
class CookieTombstone:
    """Cookie signature that should be deleted from responses."""

    name: str
    domain: str | None = None
    path: str = "/"


def parse_cookie_tombstones(tombstones_json: str) -> list[CookieTombstone]:
    """
    Parse tombstones from a JSON array of objects.

    Each object supports:
    - ``name`` (required string)
    - ``domain`` (optional string or null)
    - ``path`` (optional string, defaults to ``/``)

    Examples:
        Input:
            [
                {"name": "csrftoken", "domain": ".learn.mit.edu", "path": "/"},
                {"name": "legacy_cookie"},
            ]

        Output:
            [
                CookieTombstone(name="csrftoken", domain=".learn.mit.edu", path="/"),
                CookieTombstone(name="legacy_cookie", domain=None, path="/"),
            ]
    """
    try:
        tombstones = json.loads(tombstones_json)
    except json.JSONDecodeError as ex:
        msg = "COOKIE_TOMBSTONES must be valid JSON"
        raise ImproperlyConfigured(msg) from ex

    if not isinstance(tombstones, list):
        msg = "COOKIE_TOMBSTONES must be a JSON array"
        raise ImproperlyConfigured(msg)

    return [_parse_tombstone(tombstone) for tombstone in tombstones]


def _parse_tombstone(tombstone: object) -> CookieTombstone:
    """Parse a single tombstone object into a CookieTombstone."""
    if not isinstance(tombstone, dict):
        msg = "COOKIE_TOMBSTONES entries must be objects with name/domain/path fields"
        raise ImproperlyConfigured(msg)

    extra_fields = set(tombstone.keys()) - ALLOWED_TOMBSTONE_FIELDS
    if extra_fields:
        msg = (
            "COOKIE_TOMBSTONES entries include unsupported field(s): "
            f"{sorted(extra_fields)}"
        )
        raise ImproperlyConfigured(msg)

    return CookieTombstone(
        name=_parse_tombstone_name(tombstone.get("name")),
        domain=_parse_tombstone_domain(tombstone.get("domain")),
        path=_parse_tombstone_path(tombstone.get("path", "/")),
    )


def _parse_tombstone_name(name: object) -> str:
    """Validate and normalize tombstone name."""
    if not isinstance(name, str):
        msg = "COOKIE_TOMBSTONES entries must include a string cookie name"
        raise ImproperlyConfigured(msg)

    name = name.strip()
    if not name:
        msg = "COOKIE_TOMBSTONES entries must include a cookie name"
        raise ImproperlyConfigured(msg)
    return name


def _parse_tombstone_domain(domain: object) -> str | None:
    """Validate and normalize tombstone domain."""
    if domain is None:
        return None
    if not isinstance(domain, str):
        msg = "COOKIE_TOMBSTONES entries must use a string domain when provided"
        raise ImproperlyConfigured(msg)

    domain = domain.strip()
    if not domain:
        return None
    if not _is_valid_cookie_domain(domain):
        msg = (
            f"COOKIE_TOMBSTONES entries must use a valid domain when provided: {domain}"
        )
        raise ImproperlyConfigured(msg)
    return domain


def _parse_tombstone_path(path: object) -> str:
    """Validate and normalize tombstone path."""
    if path is None:
        return "/"
    if not isinstance(path, str):
        msg = "COOKIE_TOMBSTONES entries must use a string path when provided"
        raise ImproperlyConfigured(msg)

    path = path.strip() or "/"
    if not path.startswith("/"):
        msg = f"COOKIE_TOMBSTONES entries must use a path starting with '/': {path}"
        raise ImproperlyConfigured(msg)
    return path


def _host_in_domain_scope(host: str, domain: str | None) -> bool:
    """Check whether a request host is in scope for a cookie domain."""
    if domain is None:
        return True

    normalized_domain = domain.lstrip(".").lower()
    normalized_host = host.split(":", 1)[0].lower()
    return normalized_host == normalized_domain or normalized_host.endswith(
        f".{normalized_domain}"
    )


def _is_valid_cookie_domain(domain: str) -> bool:
    """Validate cookie domain format."""
    normalized_domain = domain.lstrip(".")
    if not normalized_domain:
        return False
    if not VALID_COOKIE_DOMAIN_RE.fullmatch(domain):
        return False
    if ".." in normalized_domain:
        return False

    labels = normalized_domain.split(".")
    return all(
        label and not label.startswith("-") and not label.endswith("-")
        for label in labels
    )


class CookieTombstoneMiddleware:
    """
    Delete configured legacy cookies from matching responses.

    Expected pre-parsed values in ``settings.COOKIE_TOMBSTONES``:
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

        tombstones = settings.COOKIE_TOMBSTONES
        if not tombstones or not request.COOKIES:
            return response

        request_host: str | None = None
        deleted_signatures: set[tuple[str, str, str | None]] = set()
        for tombstone in tombstones:
            if tombstone.name not in request.COOKIES:
                continue
            if tombstone.domain is not None:
                if request_host is None:
                    request_host = request.get_host()
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
