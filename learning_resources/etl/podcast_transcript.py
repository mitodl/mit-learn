"""
Fetch and normalize Podcasting 2.0 ``<podcast:transcript>`` files.

An item may carry the same transcript in several formats, so ranking them and
working down the list until one yields text is part of the job. Transcript urls
come from third-party feeds and there is no usable host allowlist (podcasts are
hosted anywhere), so they are fetched under the guards in ``_checked_response``.

Spec: https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/transcript.md
"""

import html
import ipaddress
import json
import logging
import re
import socket
from email.message import Message
from pathlib import PurePosixPath
from typing import NamedTuple
from urllib.parse import ParseResult, urljoin, urlparse

import requests
from bs4 import BeautifulSoup as bs  # noqa: N813

from learning_resources.etl.constants import BROWSER_UA_HEADERS

log = logging.getLogger(__name__)

# Ordered by the quality of the files MIT's feeds actually serve; the spec
# states no preference. text/html is last because Captivate marks up only the
# first cue and dumps raw SRT into <p> tags after it. Both SRT spellings appear
# in the wild -- the spec says x-subrip, several hosts send application/srt.
TRANSCRIPT_TYPE_PREFERENCE = (
    "text/plain",
    "text/vtt",
    "application/x-subrip",
    "application/srt",
    "application/json",
    "text/html",
)

# The spec makes `type` required, but some feeds omit it and others use a
# spelling outside TRANSCRIPT_TYPE_PREFERENCE ("text/srt" among them). The url
# extension identifies the format well enough to try, and the Content-Type
# check in `_served_type_matches` still guards what comes back.
TRANSCRIPT_TYPE_BY_EXTENSION = {
    ".txt": "text/plain",
    ".vtt": "text/vtt",
    ".srt": "application/x-subrip",
    ".json": "application/json",
    ".html": "text/html",
    ".htm": "text/html",
}

# A feed item publishes one transcript per format, so a handful is the real
# ceiling; the cap only bounds the requests one hostile item can provoke.
MAX_TRANSCRIPT_CANDIDATES = 4

# Generous ceilings; the largest real transcript is ~80KB. These only bound a
# hostile or broken response.
MAX_SOURCE_BYTES = 4 * 1024 * 1024
MAX_TRANSCRIPT_CHARS = 500_000
MAX_REDIRECTS = 3
REQUEST_TIMEOUT = (5, 30)

# Cue formats break every few seconds; without a paragraph target an 861-cue
# SRT normalizes to one unbroken block.
PARAGRAPH_TARGET_CHARS = 600

# One stray "Name: " label at the top of a caption file is not turn structure
# (Captivate's SRT has 1 across 861 cues), so labels are trusted only if they
# recur -- otherwise the whole episode gets attributed to one speaker.
MIN_SPEAKER_LABELS = 2
MAX_CUES_PER_SPEAKER_LABEL = 50

# Tags whose boundaries mark a paragraph break in an HTML transcript.
BLOCK_LEVEL_TAGS = (
    "p", "br", "div", "li", "tr", "cite", "time", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6",
)  # fmt: skip

CUE_TIMING_RE = re.compile(r"^[\d:.,]+\s*-->\s*[\d:.,]+")
# A line that is only a timestamp, e.g. Captivate's <time>00:00:00</time>.
STAMP_ONLY_RE = re.compile(r"^[\[(]?\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?[\])]?$")
VTT_VOICE_RE = re.compile(r"<v(?:\.[^\s>]*)?\s+([^>]+)>", re.IGNORECASE)
VTT_TAG_RE = re.compile(r"</?[a-z](?:\.[^\s>]*)?(?:\s[^>]*)?>|<\d{2}:[\d:.]+>", re.I)
INLINE_SPEAKER_RE = re.compile(r"^([^:\n]{2,60}?):\s+(?=\S)")
SENTENCE_END_RE = re.compile(r"[.!?][\"')\]]*$")


def parse_transcript_tags(item) -> list[dict]:
    """
    Read every ``<podcast:transcript>`` tag off one feed ``<item>``.

    The tags are matched on local name with a prefix check rather than as
    ``"podcast:transcript"``, because the prefix is frequently absent by the
    time we look. lxml in recover mode drops an *undeclared* namespace prefix,
    so a feed emitting the tag without ``xmlns:podcast`` is invisible to a
    prefixed selector -- and, more importantly here, ``Tag.prettify()`` drops
    the declaration too, so re-parsing a stored ``PodcastEpisode.rss`` fragment
    always yields an unprefixed ``<transcript>``. The existing
    ``find("itunes:duration")`` calls get away with the prefixed form only
    because they run against the live feed, where the namespace is declared.

    Args:
        item: the episode's ``<item>`` soup element, or a soup containing it

    Returns:
        ``{"url", "type", "language"}`` dicts in feed order
    """
    return [
        {
            "url": tag.get("url"),
            "type": tag.get("type") or "",
            "language": tag.get("language"),
        }
        for tag in item.find_all("transcript")
        if tag.prefix in (None, "podcast") and tag.get("url")
    ]


def transcript_tags_from_rss(rss: str | None) -> list[dict]:
    """
    Read the transcript tags out of a stored ``PodcastEpisode.rss`` fragment.

    The ETL already saves each episode's ``<item>`` XML verbatim, so the tags
    need no column of their own -- re-reading them here also means the
    references can never drift from what the feed actually published.

    Args:
        rss: the stored prettified ``<item>`` XML

    Returns:
        ``{"url", "type", "language"}`` dicts in feed order
    """
    if not rss:
        return []
    return parse_transcript_tags(bs(rss, "xml"))


def _language_is_usable(language: object) -> bool:
    """
    Check whether a transcript tag's language is one we can present.

    An absent language means the feed's own ``<language>``, which for every
    podcast Learn ingests is English. A declared non-English language is
    skipped rather than ranked last: showing it under a "Transcript" tab and
    indexing it with the english analyzer would both be wrong.

    Args:
        language: the tag's ``language`` attribute, if any

    Returns:
        True if the transcript should be considered
    """
    if language is None or language == "":
        return True
    return isinstance(language, str) and language.lower().startswith("en")


def _media_type_from_url(url: object) -> str | None:
    """
    Infer a transcript's media type from its url extension.

    Args:
        url: the transcript url

    Returns:
        a type from ``TRANSCRIPT_TYPE_PREFERENCE``, or None if the extension
        identifies nothing we can parse
    """
    if not isinstance(url, str):
        return None
    try:
        path = urlparse(url).path
    except ValueError:
        return None
    return TRANSCRIPT_TYPE_BY_EXTENSION.get(PurePosixPath(path).suffix.lower())


def _resolved_media_type(entry: dict) -> str | None:
    """
    Work out which parser a transcript tag needs.

    A declared ``type`` we recognize is authoritative. Otherwise the url
    extension is tried, so a tag that omits ``type`` or spells it unusually is
    not discarded outright -- the response's own Content-Type is still checked
    against the result in ``_served_type_matches``.

    Args:
        entry: a ``{"url", "type", "language"}`` dict

    Returns:
        a type from ``TRANSCRIPT_TYPE_PREFERENCE``, or None if none applies
    """
    declared = (entry.get("type") or "").split(";")[0].strip().lower()
    if declared in TRANSCRIPT_TYPE_PREFERENCE:
        return declared
    return _media_type_from_url(entry.get("url"))


class TranscriptCandidate(NamedTuple):
    """A transcript tag worth fetching, with its media type resolved."""

    url: str
    media_type: str


def rank_transcript_candidates(entries: list[dict]) -> list[TranscriptCandidate]:
    """
    Rank one feed item's transcript tags into the order they should be tried.

    Every usable tag is returned, not only the best one. The formats a feed
    lists are almost always the same transcript, so a 404, an oversized body or
    an HTML error page on the preferred format should fall through to the next
    rather than cost the episode a transcript the feed also published as SRT or
    JSON.

    Args:
        entries: ``{"url", "type", "language"}`` dicts, in feed order

    Returns:
        candidates in fetch order, at most ``MAX_TRANSCRIPT_CANDIDATES``
    """
    ranked = []
    for index, entry in enumerate(entries or []):
        url = entry.get("url")
        media_type = _resolved_media_type(entry)
        if not url or media_type is None:
            continue
        if not _language_is_usable(entry.get("language")):
            continue
        # Feed order is the final tiebreak, so the order is deterministic when
        # a feed repeats a format.
        ranked.append(
            (
                TRANSCRIPT_TYPE_PREFERENCE.index(media_type),
                index,
                TranscriptCandidate(url=url, media_type=media_type),
            )
        )
    ranked.sort(key=lambda item: item[:2])
    if len(ranked) > MAX_TRANSCRIPT_CANDIDATES:
        log.warning(
            "Item lists %d usable transcripts, trying only the best %d",
            len(ranked),
            MAX_TRANSCRIPT_CANDIDATES,
        )
    return [candidate for *_, candidate in ranked[:MAX_TRANSCRIPT_CANDIDATES]]


def _is_public_ip(address: str) -> bool:
    """
    Check that an address is routable on the public internet.

    Args:
        address: a textual IPv4 or IPv6 address

    Returns:
        True if the address is outside every special-use range
    """
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    # Several IPv6 forms tunnel a v4 address that is itself special-use --
    # ::ffff:169.254.169.254, 2002:a9fe:a9fe::1 (6to4) and Teredo all reach the
    # cloud metadata endpoint -- and ipaddress only classifies the embedded
    # address, so unwrap before testing.
    if isinstance(ip, ipaddress.IPv6Address):
        embedded = (
            ip.ipv4_mapped or ip.sixtofour or (ip.teredo[1] if ip.teredo else None)
        )
        if embedded is not None:
            ip = embedded
    # `is_global` alone would allow 64:ff9b::/96 (NAT64, which translates to
    # arbitrary v4 including link-local); `is_reserved` catches that. Testing
    # the individual negatives instead of `is_global` would in turn allow
    # 100.64.0.0/10 (carrier NAT). Both checks are needed.
    return ip.is_global and not ip.is_reserved


def _parsed_https_url(url: object) -> ParseResult | None:
    """
    Parse a url, rejecting anything that is not an unambiguous https url.

    A backslash or userinfo in the netloc is refused outright: urllib reads
    ``https://evil.io\\@ok.example`` as a url on ok.example while browsers read
    it as a url on evil.io, so the hostname we check would not be the host that
    is contacted. This is the same guard as ``ovs.parse_media_url``.

    Args:
        url: the url to check

    Returns:
        the parsed url, or None if its shape is not trustworthy
    """
    if not isinstance(url, str) or not url:
        return None
    try:
        parsed = urlparse(url)
    except ValueError:
        return None
    if parsed.scheme != "https" or "\\" in parsed.netloc or "@" in parsed.netloc:
        return None
    if not parsed.hostname:
        return None
    return parsed


def _resolves_publicly(parsed: ParseResult) -> bool:
    """
    Check that a url's host resolves only to publicly routable addresses.

    Every answer must be public, not merely one of them: we cannot control
    which record urllib3 connects to, so a host with an A record on the
    internet and an AAAA record on ``::1`` is disqualifying.

    Resolution happens before the request, so a name that changes answers
    between this check and the connection leaves a narrow rebinding window. It
    is accepted here because closing it means pinning the address and losing
    SNI, and because the value at risk is a single unauthenticated GET whose
    body is only ever parsed as text.

    Args:
        parsed: an already shape-checked https url

    Returns:
        True if the host may be contacted
    """
    try:
        resolved = socket.getaddrinfo(
            parsed.hostname, parsed.port or 443, proto=socket.IPPROTO_TCP
        )
    except (OSError, UnicodeError):
        return False
    return bool(resolved) and all(_is_public_ip(info[4][0]) for info in resolved)


def _parsed_public_url(url: object) -> ParseResult | None:
    """
    Parse an https url and confirm its host resolves only to public addresses.

    Args:
        url: the url to check

    Returns:
        the parsed url, or None if it must not be fetched
    """
    parsed = _parsed_https_url(url)
    if parsed is None or not _resolves_publicly(parsed):
        return None
    return parsed


def _declared_encoding(response: requests.Response) -> str | None:
    """
    Return the charset the server actually declared, if any.

    ``response.encoding`` cannot be used for this: requests follows RFC 2616
    and reports ISO-8859-1 for any ``text/*`` response that omits the charset
    parameter, which most transcript hosts do. Decoding a UTF-8 transcript that
    way turns every smart quote and non-ASCII name into mojibake.

    Args:
        response: the transcript response

    Returns:
        the declared charset, or None if the server declared none
    """
    message = Message()
    message["Content-Type"] = response.headers.get("Content-Type", "")
    charset = message.get_param("charset")
    # get_param returns a (charset, language, value) tuple for an RFC 2231
    # parameter, which a charset is never legitimately encoded as.
    return charset if isinstance(charset, str) else None


def _read_capped(response: requests.Response) -> str | None:
    """
    Read a response body, abandoning it if it exceeds ``MAX_SOURCE_BYTES``.

    Args:
        response: a streamed response

    Returns:
        the decoded body, or None if it is too large
    """
    chunks = []
    total = 0
    for chunk in response.iter_content(chunk_size=64 * 1024):
        total += len(chunk)
        if total > MAX_SOURCE_BYTES:
            log.warning(
                "Transcript at %s exceeds %d bytes, skipping",
                response.url,
                MAX_SOURCE_BYTES,
            )
            return None
        chunks.append(chunk)
    body = b"".join(chunks)
    encoding = _declared_encoding(response) or "utf-8"
    try:
        return body.decode(encoding, errors="replace")
    except LookupError:
        # An unrecognized charset name is not worth discarding the body over.
        log.warning(
            "Transcript at %s declared unknown charset %s", response.url, encoding
        )
        return body.decode("utf-8", errors="replace")


def _checked_response(url: str) -> requests.Response | None:
    """
    GET a transcript url, revalidating the target at every redirect hop.

    ``requests`` would follow redirects itself, but then only the first url
    would have been checked and a redirect into 169.254.169.254 would be
    followed. Each hop is resolved and range-checked instead.

    Args:
        url: the transcript url

    Returns:
        the final response, or None if any hop is disallowed
    """
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        parsed = _parsed_public_url(current)
        if parsed is None:
            log.warning("Refusing to fetch transcript from %s", current)
            return None
        response = requests.get(
            current,
            headers=BROWSER_UA_HEADERS,
            timeout=REQUEST_TIMEOUT,
            stream=True,
            allow_redirects=False,
        )
        if response.is_redirect or response.is_permanent_redirect:
            location = response.headers.get("Location")
            response.close()
            if not location:
                return None
            current = urljoin(current, location)
            continue
        try:
            response.raise_for_status()
        except requests.HTTPError:
            # stream=True keeps the connection checked out of the pool until
            # the body is consumed or the response closed.
            response.close()
            raise
        return response
    log.warning("Too many redirects fetching transcript from %s", url)
    return None


def _cue_blocks(text: str) -> list[list[str]]:
    """
    Split a VTT or SRT body into cue blocks of payload lines.

    Cue identifiers, timing lines, and VTT ``NOTE``/``STYLE``/``WEBVTT`` blocks
    are dropped, leaving only the spoken text of each cue.

    Args:
        text: the raw caption file body

    Returns:
        a list of cues, each a list of payload lines
    """
    blocks = []
    for raw_block in re.split(r"\n\s*\n", text.replace("\r\n", "\n")):
        lines = [line.strip() for line in raw_block.split("\n") if line.strip()]
        if not lines:
            continue
        if lines[0].upper().startswith(("WEBVTT", "NOTE", "STYLE", "REGION")):
            continue
        payload = [
            line
            for line in lines
            if not CUE_TIMING_RE.match(line) and not STAMP_ONLY_RE.match(line)
        ]
        # A bare numeric first line is the cue identifier, not speech.
        if payload and payload[0].isdigit():
            payload = payload[1:]
        if payload:
            blocks.append(payload)
    return blocks


def _split_speaker(text: str) -> tuple[str | None, str]:
    """
    Pull a leading ``Speaker: `` label off a cue's text.

    Args:
        text: one cue's text

    Returns:
        the speaker name (or None) and the remaining text
    """
    match = INLINE_SPEAKER_RE.match(text)
    if not match:
        return None, text
    return match.group(1).strip(), text[match.end() :]


def _cue_speaker_and_text(
    payload: list[str], *, decode_entities: bool = True
) -> tuple[str | None, str, str]:
    """
    Reduce one cue's payload lines to a speaker and its text.

    Both the label-free and the verbatim text are returned because whether an
    inline ``Name: `` prefix is a speaker label is not decidable from one cue --
    it depends on how often labels recur across the whole file, which only
    ``_turns_to_text`` can see. Returning just the stripped text would silently
    delete the prefix of any cue that merely contains a colon, turning
    "The bottom line: we need funding" into "we need funding".

    Args:
        payload: the cue's payload lines
        decode_entities: whether the payload still carries HTML character
            references, as a caption file read off the wire does

    Returns:
        the speaker name (or None), the text with any label removed, and the
        text verbatim
    """
    joined = " ".join(payload)
    voice = VTT_VOICE_RE.search(joined)
    speaker = voice.group(1).strip() if voice else None
    verbatim = VTT_TAG_RE.sub("", joined).strip()
    if decode_entities:
        # WebVTT requires "&" to be written "&amp;", so cue text arrives with
        # character references intact and would otherwise be stored literally.
        # Decoding after the tags are stripped keeps a literal "&lt;i&gt;" as
        # text rather than turning it into a tag to remove.
        verbatim = html.unescape(verbatim)
        if speaker:
            speaker = html.unescape(speaker)
    label_free = verbatim
    if speaker is None:
        speaker, label_free = _split_speaker(verbatim)

    def normalize(text: str) -> str:
        return re.sub(r"\s+", " ", text).strip()

    return speaker, normalize(label_free), normalize(verbatim)


def _speaker_labels_are_meaningful(turns: list[tuple[str | None, str, str]]) -> bool:
    """
    Decide whether a cue file's speaker labels describe real turn structure.

    Formats that tag every cue (VTT voice tags, podcastindex ``speaker``) are
    trustworthy. A file with a single label at the top is not, and honouring it
    would attribute the whole episode to one person.

    Args:
        turns: ``(speaker, label_free_text, verbatim_text)`` triples in order

    Returns:
        True if speaker labels should be applied
    """
    labeled = sum(1 for speaker, _, _ in turns if speaker)
    return (
        labeled >= MIN_SPEAKER_LABELS
        and labeled * MAX_CUES_PER_SPEAKER_LABEL >= len(turns)
    )


def _turns_to_text(turns: list[tuple[str | None, str, str]]) -> str:
    """
    Render cues or segments as prose paragraphs.

    A paragraph ends when the speaker changes, or -- so that a long monologue
    or an unlabeled caption file does not become one unbroken block -- at the
    first sentence end past ``PARAGRAPH_TARGET_CHARS``. Only the first
    paragraph of a turn carries the speaker label; continuations are unlabeled,
    which is how transcripts are conventionally set.

    When the labels turn out not to be meaningful, the verbatim text is used so
    that a cue which merely contains a colon keeps its opening words.

    Consecutive identical cues are dropped: rolling captions repeat a cue
    verbatim as the window scrolls.

    Args:
        turns: ``(speaker, label_free_text, verbatim_text)`` triples in order

    Returns:
        paragraphs separated by a blank line
    """
    use_speakers = _speaker_labels_are_meaningful(turns)
    paragraphs: list[str] = []
    current_speaker: str | None = None
    label_pending = False
    previous_text: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        nonlocal label_pending
        if not buffer:
            return
        body = " ".join(buffer).strip()
        if body:
            prefix = f"{current_speaker}: " if label_pending and current_speaker else ""
            paragraphs.append(f"{prefix}{body}")
            label_pending = False
        buffer.clear()

    for speaker, label_free, verbatim in turns:
        text = label_free if use_speakers else verbatim
        if not text or text == previous_text:
            continue
        previous_text = text
        if use_speakers and speaker is not None and speaker != current_speaker:
            flush()
            current_speaker = speaker
            label_pending = True
        buffer.append(text)
        if sum(len(part) for part in buffer) >= PARAGRAPH_TARGET_CHARS and (
            SENTENCE_END_RE.search(text)
        ):
            flush()
    flush()
    return "\n\n".join(paragraphs)


def parse_cue_format(text: str, *, decode_entities: bool = True) -> str:
    """
    Normalize a VTT or SRT body to prose.

    Both formats share the same block structure and differ only in their
    timestamp separator, which is discarded either way.

    Args:
        text: the raw caption file body
        decode_entities: whether cue text still carries HTML character
            references. Pass False for text an HTML parser has already decoded.

    Returns:
        normalized transcript text
    """
    return _turns_to_text(
        [
            _cue_speaker_and_text(payload, decode_entities=decode_entities)
            for payload in _cue_blocks(text)
        ]
    )


def parse_podcast_index_json(text: str) -> str:
    """
    Normalize a podcastindex JSON transcript to prose.

    ``body`` is fragmented mid-sentence by at least one host, so segments are
    merged by speaker rather than emitted one per paragraph.

    Args:
        text: the raw JSON body

    Returns:
        normalized transcript text, or "" if the payload is not the expected shape
    """
    try:
        payload = json.loads(text)
    except ValueError:
        log.warning("Transcript JSON could not be parsed")
        return ""
    segments = payload.get("segments") if isinstance(payload, dict) else None
    if not isinstance(segments, list):
        return ""
    turns = []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        body = str(segment.get("body") or "").strip()
        speaker = segment.get("speaker")
        # The speaker is a real field here, so there is no inline label to
        # strip: label-free and verbatim text are the same.
        turns.append((str(speaker).strip() if speaker else None, body, body))
    return _turns_to_text(turns)


def parse_html(text: str) -> str:
    """
    Normalize an HTML transcript to prose.

    Some hosts serve a real HTML document; Captivate serves the first cue as
    markup and the rest of the SRT file inside ``<p>`` tags. Both end up as
    text here, and a body that still contains cue timings is handed to the cue
    parser so the timecodes do not survive into the stored transcript.

    Args:
        text: the raw HTML body

    Returns:
        normalized transcript text
    """
    soup = bs(text, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()
    # Mark block boundaries before extracting rather than passing a separator
    # to get_text: a separator would also land between inline elements and
    # break sentences apart, while no separator at all would run consecutive
    # paragraphs together.
    for tag in soup.find_all(BLOCK_LEVEL_TAGS):
        tag.append("\n\n")
    extracted = soup.get_text()
    if "-->" in extracted:
        # get_text() has already resolved character references; decoding them a
        # second time would collapse a doubly-escaped "&amp;amp;" to a bare "&".
        return parse_cue_format(extracted, decode_entities=False)
    return parse_plain(extracted)


def parse_plain(text: str) -> str:
    """
    Normalize a plain-text transcript, preserving its paragraph breaks.

    Args:
        text: the raw text body

    Returns:
        normalized transcript text
    """
    paragraphs = [
        re.sub(r"\s+", " ", block).strip()
        for block in re.split(r"\n\s*\n", text.replace("\r\n", "\n"))
    ]
    return "\n\n".join(block for block in paragraphs if block)


PARSERS = {
    "text/plain": parse_plain,
    "text/vtt": parse_cue_format,
    "application/x-subrip": parse_cue_format,
    "application/srt": parse_cue_format,
    "application/json": parse_podcast_index_json,
    "text/html": parse_html,
}


def _served_type_matches(served_type: str, declared_type: str) -> bool:
    """
    Check that a response's Content-Type is consistent with the declared type.

    Hosts are loose about this in both directions — Captivate serves its
    ``application/srt`` file as ``text/plain`` and doctorpodcasting serves its
    ``text/vtt`` file as ``text/plain`` — so ``text/plain`` is accepted for any
    declared type. The point of the check is only to catch a host answering a
    caption request with an HTML error page, which would otherwise be stored as
    prose.

    Args:
        served_type: the response's Content-Type, without parameters
        declared_type: the type the feed's transcript tag claimed

    Returns:
        True if the body should be parsed
    """
    if not served_type or served_type == declared_type:
        return True
    if served_type == "text/plain":
        return True
    # The two spellings of SRT are the same format.
    srt_types = {"application/srt", "application/x-subrip"}
    return served_type in srt_types and declared_type in srt_types


def _fetch_candidate(candidate: TranscriptCandidate) -> str:
    """
    Fetch and normalize one transcript candidate.

    Args:
        candidate: the transcript to fetch

    Returns:
        the normalized transcript text, or "" if this candidate yielded nothing
    """
    url = candidate.url
    # One `except` around the request *and* the streamed read: a
    # ChunkedEncodingError or ReadTimeout part-way through the body is a
    # RequestException raised by iter_content, not by get(), and letting it
    # escape would abort the caller's loop and skip every remaining episode.
    try:
        response = _checked_response(url)
        if response is None:
            return ""
        try:
            served_type = (
                response.headers.get("Content-Type", "").split(";")[0].strip().lower()
            )
            if not _served_type_matches(served_type, candidate.media_type):
                log.warning(
                    "Transcript at %s declared %s but served %s, skipping",
                    url,
                    candidate.media_type,
                    served_type,
                )
                return ""
            body = _read_capped(response)
        finally:
            response.close()
    except requests.RequestException as exc:
        # Not fatal and not exceptional: fetch_transcript falls through to the
        # next format, so this is logged as a warning rather than a traceback.
        log.warning("Failed to fetch transcript from %s: %s", url, exc)
        return ""
    if not body:
        return ""
    return PARSERS[candidate.media_type](body)[:MAX_TRANSCRIPT_CHARS]


def fetch_transcript(entries: list[dict]) -> str:
    """
    Fetch and normalize the best usable transcript among a feed item's tags.

    Candidates are tried in preference order until one yields text: a broken
    url in the preferred format must not cost the episode a transcript the feed
    also published in another one.

    Args:
        entries: ``{"url", "type", "language"}`` dicts, in feed order

    Returns:
        the normalized transcript text, or "" if none could be fetched
    """
    for candidate in rank_transcript_candidates(entries):
        transcript = _fetch_candidate(candidate)
        if transcript:
            return transcript
    return ""
