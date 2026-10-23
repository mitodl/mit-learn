import hashlib
import logging
import time
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlparse

import httpx
from botocore.exceptions import ClientError

from learning_resources.etl.utils import get_bucket_by_name
from learning_resources.utils import get_s3_object_and_read

log = logging.getLogger(__name__)

UA = "course-profile-prototype/0.1 (+research; contact: local)"


class Fetcher:
    """HTTP fetcher that caches raw responses on disk."""

    def __init__(self, raw_dir: Path, *, refresh: bool = False):
        """Cache responses in raw_dir; refresh re-downloads cached urls."""
        self.raw_dir = raw_dir
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.refresh = refresh
        self.client = httpx.Client(
            timeout=60, follow_redirects=True, headers={"User-Agent": UA}
        )
        self.downloads = 0
        self.cache_hits = 0

    def path_for(self, url: str) -> Path:
        """Return the cache path for a url."""
        ext = Path(urlparse(url).path).suffix.lower() or ".html"
        if ext not in (".html", ".pdf", ".vtt", ".json", ".xml", ".txt"):
            ext = ".bin"
        url_hash = hashlib.sha1(url.encode(), usedforsecurity=False).hexdigest()
        return self.raw_dir / (url_hash[:20] + ext)

    def get(self, url: str) -> bytes:
        """Return the body of a url, from the cache when possible."""
        p = self.path_for(url)
        if p.exists() and not self.refresh:
            self.cache_hits += 1
            return p.read_bytes()
        last: Exception | None = None
        for attempt in range(3):
            try:
                r = self.client.get(url)
                r.raise_for_status()
                p.write_bytes(r.content)
                self.downloads += 1
                return r.content  # noqa: TRY300
            except httpx.HTTPError as e:  # retry on transient errors
                last = e
                time.sleep(1.5 * (attempt + 1))
        msg = f"fetch failed for {url}: {last}"
        raise RuntimeError(msg)

    def text(self, url: str) -> str:
        return self.get(url).decode("utf-8", errors="replace")


class S3Fetcher:
    """Fetcher that reads OCW site urls from the OCW bucket, without caching."""

    cache_hits = 0  # never caches; kept for the Ingestor's summary note

    def __init__(self, bucket_name: str, host: str):
        """Read keys from bucket_name for urls on host."""
        self.bucket = get_bucket_by_name(bucket_name)
        self.host = host
        self.seen: set[str] = set()
        self.downloads = 0

    def key_for(self, url: str) -> str:
        """Return the bucket key for a url."""
        parsed = urlparse(url)
        if parsed.netloc != self.host:
            msg = f"fetch failed for {url}: not on {self.host}"
            raise RuntimeError(msg)
        key = unquote(parsed.path).lstrip("/")
        if not key or key.endswith("/"):
            key += "index.html"
        elif not PurePosixPath(key).suffix:
            key += "/index.html"
        return key

    def get(self, url: str) -> bytes:
        """Return the body of a url, warning when it was already downloaded."""
        key = self.key_for(url)
        if key in self.seen:
            log.warning("Re-downloading %s from S3", key)
        self.seen.add(key)
        try:
            body = get_s3_object_and_read(self.bucket.Object(key))
        except ClientError as e:
            msg = f"fetch failed for {url}: {e}"
            raise RuntimeError(msg) from e
        self.downloads += 1
        return body

    def text(self, url: str) -> str:
        """Return the body of a url as text."""
        return self.get(url).decode("utf-8", errors="replace")
