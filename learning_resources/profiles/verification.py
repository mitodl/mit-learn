"""
Check the passages a model quotes as evidence against the text it was given.
"""

import re
import unicodedata
from typing import NamedTuple

# Locator markers in our own source text. Stripped before comparing, so a
# quote that runs across a transcript block or page boundary still matches.
_MARKER = re.compile(r"\[(?:\d{1,2}:\d{2}:\d{2}|page \d+)\]")
_ELLIPSIS = re.compile(r"\.\.\.|…")

EXACT = "exact"
FUZZY = "fuzzy"
UNVERIFIED = "unverified"
UNKNOWN_SOURCE = "unknown_source"

# share of a passage's word trigrams that must appear in the source
FUZZY_TRIGRAM_RATIO = 0.8
# too few words to judge a near match: one wrong word fails the whole quote
MIN_FUZZY_WORDS = 6
# fragments shorter than this, between ellipses, are skipped
MIN_FRAGMENT_CHARS = 10


class PassageMatch(NamedTuple):
    """How a quoted passage matched its source"""

    verified: str
    # character offsets into the source text, when the passage is found in it
    # up to whitespace
    span_start: int | None = None
    span_end: int | None = None


def normalize(text: str) -> str:
    """Lowercase and drop punctuation, for comparing quotes"""
    text = unicodedata.normalize("NFKC", text).lower()
    text = re.sub(r"[^\w]+", " ", text.replace("_", " "))
    return " ".join(text.split())


def _trigrams(words: list[str]) -> set[tuple[str, ...]]:
    return {tuple(words[i : i + 3]) for i in range(len(words) - 2)}


def _find_span(passage: str, source: str) -> tuple[int, int] | None:
    """Return the span of `passage` in `source`, ignoring differences in whitespace"""
    words = passage.split()
    if not words:
        return None
    pattern = r"\s+".join(re.escape(word) for word in words)
    if re.match(r"\w", words[0]):
        pattern = r"(?<!\w)" + pattern
    if re.search(r"\w$", words[-1]):
        pattern += r"(?!\w)"
    match = re.search(pattern, source)
    return (match.start(), match.end()) if match else None


def verify_passage(passage: str, source: str) -> PassageMatch:  # noqa: PLR0911
    """
    Check a quoted passage against the source text it claims to come from.

    Args:
        passage (str): the passage the model quoted
        source (str): the text of the source, as it was sent to the model

    Returns:
        PassageMatch: exact when the passage is in the source after
            normalizing case, punctuation and whitespace; fuzzy when nearly
            all of it is, or when every fragment of a quote joined with
            ellipses is; unverified otherwise
    """
    span = _find_span(passage, source)
    if span:
        return PassageMatch(EXACT, *span)
    plain_source = normalize(_MARKER.sub(" ", source))
    plain_passage = normalize(_MARKER.sub(" ", passage))
    if not plain_passage or not plain_source:
        return PassageMatch(UNVERIFIED)
    if f" {plain_passage} " in f" {plain_source} ":
        return PassageMatch(EXACT)
    fragments = [
        fragment
        for fragment in _ELLIPSIS.split(passage)
        if len(fragment.strip()) >= MIN_FRAGMENT_CHARS
    ]
    if len(fragments) > 1:
        matches = [verify_passage(fragment, source) for fragment in fragments]
        if all(match.verified in (EXACT, FUZZY) for match in matches):
            return PassageMatch(FUZZY)
    passage_words = plain_passage.split()
    if len(passage_words) < MIN_FUZZY_WORDS:
        return PassageMatch(UNVERIFIED)
    wanted = _trigrams(passage_words)
    found = wanted & _trigrams(plain_source.split())
    if len(found) / len(wanted) >= FUZZY_TRIGRAM_RATIO:
        return PassageMatch(FUZZY)
    return PassageMatch(UNVERIFIED)


def verify_evidence(evidence: dict, texts: dict[str, str]) -> dict:
    """
    Return an evidence item with its verification added.

    Args:
        evidence (dict): an Evidence item, as dumped from the model's output
        texts (dict of str: str): the text sent to the model, by source id.
            Only sources in the same call can be cited.

    Returns:
        dict: the evidence with `verified`, `span_start` and `span_end` set
    """
    source = texts.get(evidence["source_id"])
    match = (
        PassageMatch(UNKNOWN_SOURCE)
        if source is None
        else verify_passage(evidence["passage"], source)
    )
    return {**evidence, **match._asdict()}


def verify_all_evidence(value, texts: dict[str, str]):
    """
    Verify every evidence item in a dumped model output, at any depth.

    Args:
        value: a model output dumped to plain data
        texts (dict of str: str): the text sent to the model, by source id

    Returns:
        the same structure, with every evidence list's items verified
    """
    if isinstance(value, list):
        return [verify_all_evidence(item, texts) for item in value]
    if isinstance(value, dict):
        return {
            key: (
                [verify_evidence(item, texts) for item in item_value]
                if key == "evidence"
                else verify_all_evidence(item_value, texts)
            )
            for key, item_value in value.items()
        }
    return value
