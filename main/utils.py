"""main utilities"""

import datetime
import json
import logging
import os
from collections.abc import Callable
from enum import Flag, auto
from functools import wraps
from hashlib import md5
from itertools import islice
from urllib.parse import urljoin

import markdown2
import requests
from bs4 import BeautifulSoup
from django.conf import settings
from django.core.cache import caches
from django.http import HttpResponse
from django.views.decorators.cache import cache_page
from nh3 import nh3
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from main.constants import ALLOWED_HTML_ATTRIBUTES, ALLOWED_HTML_TAGS

log = logging.getLogger(__name__)

# This is the Django ImageField max path size
IMAGE_PATH_MAX_LENGTH = 100


def _sorted_query_string(query_dict):
    """Build a sorted query string for consistent cache keys."""
    items = []
    for key in sorted(query_dict.keys()):
        # Sort values within each key for consistent cache keys
        # (topic=a&topic=b and topic=b&topic=a should match)
        items.extend(f"{key}={value}" for value in sorted(query_dict.getlist(key)))
    return "&".join(items)


def _needs_negotiated_response(request) -> bool:
    """
    Whether the request needs content-negotiated rendering (e.g. the
    browsable API) rather than raw cached JSON bytes.
    """
    renderer = getattr(request, "accepted_renderer", None)
    if renderer is not None:
        # DRF negotiated the renderer in initial(); raw bytes only serve JSON
        return renderer.format != "json"
    return "text/html" in request.headers.get("Accept", "")


def _cached_response(request, cached_data):
    """
    Build a response from a cache entry (rendered JSON bytes or legacy dict).

    JSON requests get the cached bytes as-is, skipping re-rendering. Requests
    wanting another format (e.g. the browsable API) get a DRF Response so
    content negotiation still applies.
    """
    if not isinstance(cached_data, bytes):
        return Response(cached_data)
    if _needs_negotiated_response(request):
        return Response(json.loads(cached_data))
    return HttpResponse(cached_data, content_type="application/json")


def _resolve_cache_timeout(timeout: int | None) -> int:
    """Resolve a cache timeout, deferring to settings when no timeout is given."""
    if timeout is None:
        return settings.REDIS_VIEW_CACHE_DURATION
    return timeout


def _cache_page_ignoring_cookies(  # noqa: C901
    timeout: int | None = None,
    cache: str = "default",
    key_prefix: str = "",
    *,
    only_anonymous: bool = False,
    bypass: Callable | None = None,
) -> Callable:
    """
    Build cache key from URL path + query params only, so users share the same
    cached response regardless of session/auth state.

    Unlike Django's cache_page which respects Vary headers (including Cookie),
    this decorator creates a consistent cache key regardless of session/auth state.

    Args:
        timeout: Cache timeout in seconds. If None, settings.REDIS_VIEW_CACHE_DURATION
            is read at request time. If <= 0, caching is skipped entirely.
        cache: Name of the cache backend to use.
        key_prefix: Prefix for the cache key.
        only_anonymous: If True, only cache for anonymous users; authenticated
            users bypass the cache entirely.
        bypass: Optional callable(request, *args, **kwargs) -> bool. When it
            returns True the view runs uncached (e.g. for privileged users who
            must see live data).
    """

    def inner_decorator(func):  # noqa: C901
        from asgiref.sync import iscoroutinefunction

        if iscoroutinefunction(func):

            @wraps(func)
            async def inner_function(request, *args, **kwargs):
                cache_timeout = _resolve_cache_timeout(timeout)
                if cache_timeout <= 0:
                    return await func(request, *args, **kwargs)

                if only_anonymous and request.user.is_authenticated:
                    return await func(request, *args, **kwargs)

                if bypass is not None and bypass(request, *args, **kwargs):
                    return await func(request, *args, **kwargs)

                query_string = _sorted_query_string(request.GET)
                raw_key = f"{key_prefix}:{request.path}:{query_string}"
                url_hash = md5(raw_key.encode()).hexdigest()  # noqa: S324
                cache_key = (
                    f"views.decorators.cache.cache_page.{key_prefix}.GET.{url_hash}"
                )

                cache_backend = caches[cache]

                cached_data = await cache_backend.aget(cache_key)
                if cached_data is not None:
                    return _cached_response(request, cached_data)

                response = await func(request, *args, **kwargs)

                if response.status_code == 200:  # noqa: PLR2004
                    # Cache rendered JSON bytes so cache hits skip
                    # DRF serialization entirely
                    await cache_backend.aset(
                        cache_key,
                        JSONRenderer().render(response.data),
                        cache_timeout,
                    )

                return response

            return inner_function

        @wraps(func)
        def inner_function(request, *args, **kwargs):
            # Skip caching entirely if timeout is 0 or negative
            cache_timeout = _resolve_cache_timeout(timeout)
            if cache_timeout <= 0:
                return func(request, *args, **kwargs)

            # Skip caching for authenticated users if only_anonymous is set
            if only_anonymous and request.user.is_authenticated:
                return func(request, *args, **kwargs)

            # Skip caching when the bypass predicate opts this request out
            if bypass is not None and bypass(request, *args, **kwargs):
                return func(request, *args, **kwargs)

            # Build cache key from path + sorted query string (ignore cookies)
            query_string = _sorted_query_string(request.GET)
            raw_key = f"{key_prefix}:{request.path}:{query_string}"
            url_hash = md5(raw_key.encode()).hexdigest()  # noqa: S324
            cache_key = f"views.decorators.cache.cache_page.{key_prefix}.GET.{url_hash}"

            cache_backend = caches[cache]

            # Try to get from cache
            cached_data = cache_backend.get(cache_key)
            if cached_data is not None:
                return _cached_response(request, cached_data)

            # Execute view
            response = func(request, *args, **kwargs)

            # Only cache successful responses. Cache rendered JSON bytes so
            # cache hits skip DRF serialization entirely
            if response.status_code == 200:  # noqa: PLR2004
                cache_backend.set(
                    cache_key,
                    JSONRenderer().render(response.data),
                    cache_timeout,
                )

            return response

        return inner_function

    return inner_decorator


def call_fastly_purge_api(relative_url, timeout=30):
    """
    Call the Fastly purge API.

    We aren't using the official Fastly SDK here because it doesn't work for
    this - the version of it that works with the current API only allows you
    to purge *everything*, not individual pages.

    Args:
        - relative_url  The relative URL to purge.
        - timeout       Timeout in seconds for the request (default: 30)
    Returns:
        - Dict of the response (resp.json)
    Raises:
        - HTTPError if the API returns an error status code
        - RequestException for network/timeout errors
    """
    # Skip Fastly purge if API key is not configured properly
    if not settings.FASTLY_API_KEY:
        log.info(f"Skipping Fastly purge for {relative_url} (dev environment)")  # noqa: G004
        return {"status": "ok", "skipped": True}

    # Use APP_BASE_URL (https://rc.learn.mit.edu/) directly for purge requests
    # Fastly intercepts PURGE requests to your domain with the fastly-key header
    api_url = urljoin(settings.APP_BASE_URL, relative_url)

    log.info(f"Purging relative URL {relative_url}: {api_url}")  # noqa: G004

    headers = {}

    if settings.FASTLY_API_KEY:
        headers["fastly-key"] = settings.FASTLY_API_KEY

    try:
        resp = requests.request("PURGE", api_url, headers=headers, timeout=timeout)
        # Raise exception for HTTP errors (4xx, 5xx)
        resp.raise_for_status()
    except requests.HTTPError:
        log.exception(f"Fastly API Purge call failed: {resp.status_code} {resp.reason}")  # noqa: G004
        raise
    except requests.RequestException:
        log.exception(f"Fastly API network/timeout error for {api_url}")  # noqa: G004
        raise

    log.info(f"Fastly returned: {resp.text}")  # noqa: G004
    return resp.json()


def cache_page_for_anonymous_users(
    timeout: int | None = None, cache: str = "default", key_prefix: str = ""
) -> Callable:
    """
    Cache decorator for anonymous users only, ignoring Vary headers.

    Args:
        timeout: Cache timeout in seconds. If None, settings.REDIS_VIEW_CACHE_DURATION
            is read at request time. If <= 0, caching is skipped entirely.
        cache: Name of the cache backend to use.
        key_prefix: Prefix for the cache key.
    """
    return _cache_page_ignoring_cookies(
        timeout, cache=cache, key_prefix=key_prefix, only_anonymous=True
    )


def cache_page_per_user(*cache_args, **cache_kwargs):
    """
    Create a cache per page and user/session
    """

    def inner_decorator(func):
        @wraps(func)
        def inner_function(request, *args, **kwargs):
            return cache_page(*cache_args, **cache_kwargs)(func)(
                request, *args, **kwargs
            )

        return inner_function

    return inner_decorator


def cache_page_for_all_users(
    timeout: int | None = None,
    cache: str = "default",
    key_prefix: str = "",
    bypass: Callable | None = None,
) -> Callable:
    """
    Cache decorator that ignores authentication and Vary headers.

    Builds cache key from URL path + query params only, so all users
    (anonymous or authenticated) share the same cached response.

    Unlike Django's cache_page which respects Vary headers (including Cookie),
    this decorator creates a consistent cache key regardless of session/auth state.

    Args:
        timeout: Cache timeout in seconds. If None, settings.REDIS_VIEW_CACHE_DURATION
            is read at request time. If <= 0, caching is skipped entirely.
        cache: Name of the cache backend to use.
        key_prefix: Prefix for the cache key.
        bypass: Optional callable(request, *args, **kwargs) -> bool. When it
            returns True the view runs uncached (e.g. for privileged users).
    """
    return _cache_page_ignoring_cookies(
        timeout,
        cache=cache,
        key_prefix=key_prefix,
        only_anonymous=False,
        bypass=bypass,
    )


class FeatureFlag(Flag):
    """
    FeatureFlag enum

    Members should have values of increasing powers of 2 (1, 2, 4, 8, ...)

    """

    EXAMPLE_FEATURE = auto()


def is_near_now(time):
    """
    Returns true if time is within five seconds or so of now
    Args:
        time (datetime.datetime):
            The time to test
    Returns:
        bool:
            True if near now, false otherwise
    """  # noqa: D401
    now = datetime.datetime.now(tz=datetime.UTC)
    five_seconds = datetime.timedelta(0, 5)
    return now - five_seconds < time < now + five_seconds


def now_in_utc():
    """
    Get the current time in UTC
    Returns:
        datetime.datetime: A datetime object for the current time
    """
    return datetime.datetime.now(tz=datetime.UTC)


def normalize_to_start_of_day(dt):
    """
    Normalizes a datetime value to the start of it's day

    Args:
        dt (datetime.datetime): the datetime to normalize

    Returns:
        datetime.datetime: the normalized datetime
    """  # noqa: D401
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def chunks(iterable, *, chunk_size=20):
    """
    Yields chunks of an iterable as sub lists each of max size chunk_size.

    Args:
        iterable (iterable): iterable of elements to chunk
        chunk_size (int): Max size of each sublist

    Yields:
        list: List containing a slice of list_to_chunk
    """  # noqa: D401
    chunk_size = max(1, chunk_size)
    iterable = iter(iterable)
    chunk = list(islice(iterable, chunk_size))

    while len(chunk) > 0:
        yield chunk
        chunk = list(islice(iterable, chunk_size))


def merge_strings(list_or_str):
    """
    Recursively go through through nested lists of strings and merge into a flattened list.

    Args:
        list_or_str (any): A list of strings or a string

    Returns:
        list of str: A list of strings
    """  # noqa: E501

    list_to_return = []
    _merge_strings(list_or_str, list_to_return)
    return list_to_return


def _merge_strings(list_or_str, list_to_return):
    """
    Recursively go through through nested lists of strings and merge into a flattened list.

    Args:
        list_or_str (any): A list of strings or a string
        list_to_return (list of str): The list the strings will be added to
    """  # noqa: E501
    if isinstance(list_or_str, list):
        for item in list_or_str:
            _merge_strings(item, list_to_return)
    elif list_or_str is not None:
        list_to_return.append(list_or_str)


def filter_dict_keys(orig_dict, keys_to_keep, *, optional=False):
    """
    Returns a copy of a dictionary filtered by a collection of keys to keep

    Args:
        orig_dict (dict): A dictionary
        keys_to_keep (iterable): Keys to filter on
        optional (bool): If True, ignore keys that don't exist in the dict. If False, raise a KeyError.
    """  # noqa: D401, E501
    return {
        key: orig_dict[key] for key in keys_to_keep if not optional or key in orig_dict
    }


def filter_dict_with_renamed_keys(orig_dict, key_rename_dict, *, optional=False):
    """
    Returns a copy of a dictionary with keys renamed according to a provided dictionary

    Args:
        orig_dict (dict): A dictionary
        key_rename_dict (dict): Mapping of old key to new key
        optional (bool): If True, ignore keys that don't exist in the dict. If False, raise a KeyError.
    """  # noqa: D401, E501
    return {
        new_key: orig_dict[key]
        for key, new_key in key_rename_dict.items()
        if not optional or key in orig_dict
    }


def html_to_plain_text(html_str):
    """
    Takes an HTML string and returns text with HTML tags removed and line breaks replaced with spaces

    Args:
        html_str (str): A string containing HTML tags

    Returns:
        str: Plain text
    """  # noqa: D401, E501
    soup = BeautifulSoup(html_str, features="html.parser")
    return soup.get_text().replace("\n", " ")


def markdown_to_plain_text(markdown_str):
    """
    Takes a string and returns text with Markdown elements removed and line breaks
    replaced with spaces

    Args:
        markdown_str (str): A string containing Markdown

    Returns:
        str: Plain text
    """  # noqa: D401
    html_str = markdown2.markdown(markdown_str)
    return html_to_plain_text(html_str).strip()


def prefetched_iterator(query, chunk_size=2000):
    """
    This is a prefetch_related-safe version of what iterator() should do.
    It will sort and batch on the default django primary key

    Args:
        query (QuerySet): the django queryset to iterate
        chunk_size (int): the size of each chunk to fetch

    """  # noqa: D401
    # walk the records in ascending id order
    base_query = query.order_by("id")

    def _next(greater_than_id):
        """Returns the next batch"""  # noqa: D401
        return base_query.filter(id__gt=greater_than_id)[:chunk_size]

    batch = _next(0)

    while batch:
        item = None
        # evaluate each batch query here
        for item in batch:
            yield item

        # next batch starts after the last item.id
        batch = _next(item.id) if item is not None else None


def generate_filepath(filename, directory_name, suffix, prefix):
    """
    Generate and return the filepath for an uploaded image

    Args:
        filename(str): The name of the image file
        directory_name (str): A directory name
        suffix(str): 'small', 'medium', or ''
        prefix (str): A directory name to use as a prefix

    Returns:
        str: The filepath for the uploaded image.
    """
    name, ext = os.path.splitext(filename)  # noqa: PTH122
    timestamp = now_in_utc().replace(microsecond=0)
    path_format = "{prefix}/{directory_name}/{name}-{timestamp}{suffix}{ext}"

    path_without_name = path_format.format(
        timestamp=timestamp.strftime("%Y-%m-%dT%H%M%S"),
        prefix=prefix,
        directory_name=directory_name,
        suffix=suffix,
        ext=ext,
        name="",
    )
    if len(path_without_name) >= IMAGE_PATH_MAX_LENGTH:
        msg = f"path is longer than max length even without name: {path_without_name}"
        raise ValueError(msg)

    max_name_length = IMAGE_PATH_MAX_LENGTH - len(path_without_name)
    return path_format.format(
        name=name[:max_name_length],
        timestamp=timestamp.strftime("%Y-%m-%dT%H%M%S"),
        prefix=prefix,
        directory_name=directory_name,
        suffix=suffix,
        ext=ext,
    )


def extract_values(obj, key):
    """
    Pull all values of specified key from nested JSON.

    Args:
        obj(dict): The JSON object
        key(str): The JSON key to search for and extract

    Returns:
        list of matching key values

    """
    array = []

    def extract(obj, array, key):
        """Recursively search for values of key in JSON tree."""
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k == key:
                    array.append(v)
                if isinstance(v, dict | list):
                    extract(v, array, key)
        elif isinstance(obj, list):
            for item in obj:
                extract(item, array, key)
        return array

    return extract(obj, array, key)


def write_to_file(filename, contents):
    """
    Write content to a file in binary mode, creating directories if necessary

    Args:
        filename (str): The full-path filename to write to.
        contents (bytes): What to write to the file.

    """
    if not os.path.exists(os.path.dirname(filename)):  # noqa: PTH110, PTH120
        os.makedirs(os.path.dirname(filename))  # noqa: PTH103, PTH120
    if os.path.exists(filename):  # noqa: PTH110
        with open(filename, "rb") as infile:  # noqa: PTH123
            if infile.read() == contents:
                return
    with open(filename, "wb") as infile:  # noqa: PTH123
        infile.write(contents)


def write_x509_files():
    """Write the x509 certificate and key to files"""
    write_to_file(settings.MIT_WS_CERTIFICATE_FILE, settings.MIT_WS_CERTIFICATE)
    write_to_file(settings.MIT_WS_PRIVATE_KEY_FILE, settings.MIT_WS_PRIVATE_KEY)


def frontend_absolute_url(relative_path: str) -> str:
    """
    Create an absolute url to the frontend

    Args:
        relative_path(str): path relative to the frontend root

    Returns:
        str: absolute url path to the frontend
    """
    return urljoin(settings.APP_BASE_URL, relative_path)


def clean_data(data: str, tags=None, attributes=None) -> str:
    """Remove unwanted html tags from text"""
    if tags is None:
        tags = ALLOWED_HTML_TAGS
    if attributes is None:
        attributes = ALLOWED_HTML_ATTRIBUTES
    if data:
        return nh3.clean(data, tags=tags, attributes=attributes)
    return ""


def clear_views_cache(key_prefix: str | None = None) -> int:
    """
    Clear cached view responses from Redis.

    Args:
        key_prefix: If given, only clear responses cached under this key_prefix
            (as passed to the cache_page_* decorators). Otherwise clear all.
    """
    cache = caches["redis"]
    pattern = (
        f"views.decorators.cache.cache_page.{key_prefix}.*" if key_prefix else "views.*"
    )

    if hasattr(cache, "delete_pattern"):
        # itersize is the SCAN COUNT: django-redis defaults it to 10, so a
        # delete_pattern over a large shared keyspace (this cache shares its
        # Redis with the Celery broker + result backend) needs ~keyspace/10
        # round-trips. Raising it ~100x cuts a multi-second scan to a fraction.
        return cache.delete_pattern(pattern, itersize=1000)
    # Backends without SCAN-based pattern deletion (DummyCache in tests,
    # LocMemCache) can't clear selectively -- flush everything instead.
    cache.clear()
    return 0


def checksum_for_content(content: str) -> str:
    """
    Generate a checksum based on the provided content string
    """
    hasher = md5()  # noqa: S324
    if content:
        hasher.update(content.encode("utf-8"))
        return hasher.hexdigest()
    return None
