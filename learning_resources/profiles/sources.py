"""
Render a unit's content files as the source text sent to the model.
"""

import re
from dataclasses import dataclass, replace

from learning_resources.models import ContentFile, Unit, UnitContentFile

# Token counts are estimated from length, so the ETL needs no tokenizer.
CHARS_PER_TOKEN = 4

# Places a long file can be cut cleanly: a page marker, a transcript block or
# a heading. A cut before the second half of the allowed text is worse than a
# hard cut.
_BREAK = re.compile(
    r"\[page \d+\]|\[\d{1,2}:\d{2}:\d{2}\]|^#{1,6} |\n\s*\n", re.MULTILINE
)


def estimate_tokens(text: str) -> int:
    """Estimate the number of tokens in text"""
    return -(-len(text) // CHARS_PER_TOKEN)


@dataclass(frozen=True)
class Source:
    """One content file as it is sent to the model"""

    # S01, S02, ... in unit order. Ids are positions, not database ids, so a
    # result cached for one run's unit is valid for another run's unit with
    # the same files.
    source_id: str
    content_file_id: int
    checksum: str
    header: str
    # the file's text as sent, after truncation
    text: str
    # how much of the file's text was kept, and how long it is
    included_chars: int
    total_chars: int

    @property
    def truncated(self) -> bool:
        """Whether the file was cut to fit the per-file limit"""
        return self.included_chars < self.total_chars

    @property
    def block(self) -> str:
        """The source as it appears in the prompt"""
        return f"{self.header}\n{self.text}\n=== END {self.source_id} ===\n"

    @property
    def tokens(self) -> int:
        """Estimated tokens for the source's block"""
        return estimate_tokens(self.block)

    def cache_input(self) -> str:
        """Return what the source contributes to a cache key: its text"""
        return self.text

    def summary(self) -> dict:
        """
        Describe the source in a stored extraction.

        The content file id is left out: the extraction is reused by any unit
        with the same files, so its sources are found by position and checksum
        in whichever unit reads it.
        """
        return {
            "source_id": self.source_id,
            "checksum": self.checksum,
            "included_chars": self.included_chars,
            "total_chars": self.total_chars,
            "truncated": self.truncated,
        }


def truncate(text: str, max_tokens: int) -> tuple[str, int]:
    """
    Cut text that is over the per-file limit, keeping its beginning.

    Args:
        text (str): the file's text
        max_tokens (int): the most tokens to keep

    Returns:
        tuple of (str, int): the text unchanged when it fits; otherwise its
            beginning, cut at the last page marker, transcript block, heading
            or paragraph before the limit, followed by a marker saying how
            much was kept. And how many characters of the text were kept.
    """
    limit = max_tokens * CHARS_PER_TOKEN
    if len(text) <= limit:
        return text, len(text)
    breaks = [match.start() for match in _BREAK.finditer(text, 0, limit)]
    cut = next((pos for pos in reversed(breaks) if pos >= limit // 2), limit)
    return text[:cut].rstrip() + _truncation_marker(cut, len(text)), cut


def _truncation_marker(included_chars: int, total_chars: int) -> str:
    return (
        f"\n[... truncated: the first {included_chars:,} of {total_chars:,}"
        " characters of this file are included ...]"
    )


# the most tokens truncate() adds after the kept text, for files up to a
# trillion characters
_MAX_TRUNCATION_MARKER_TOKENS = estimate_tokens(_truncation_marker(10**12, 10**12))
# share of the input budget one file may fill, leaving room for the course
# outline, the unit header and the estimate's error
FILE_BUDGET_SHARE = 0.9


def _fit_to_budget(
    source: Source, full_text: str, input_token_budget: int | None
) -> Source:
    """
    Return the source, truncated further from its file's full text if its
    block is over FILE_BUDGET_SHARE of the input budget, so that it fits one
    part of a split unit.
    """
    if input_token_budget is None:
        return source
    max_block_tokens = int(input_token_budget * FILE_BUDGET_SHARE)
    if source.tokens <= max_block_tokens:
        return source
    # the block's tokens are at most its text's plus the rest's
    overhead = estimate_tokens(f"{source.header}\n\n=== END {source.source_id} ===\n")
    included, included_chars = truncate(
        full_text, max(1, max_block_tokens - overhead - _MAX_TRUNCATION_MARKER_TOKENS)
    )
    return replace(source, text=included, included_chars=included_chars)


def _header(source_id: str, content_file: ContentFile, relation: str) -> str:
    material = content_file.content_type or content_file.file_type or "file"
    title = content_file.title or content_file.content_title or ""
    return (
        f"=== SOURCE {source_id} | type={material} | title={title!r}"
        f" | relation={relation} ==="
    )


def pack_parts(sources: list[Source], input_token_budget: int) -> list[list[Source]]:
    """
    Pack a unit's sources, in unit order, into consecutive parts under a budget.

    A source is never split across parts. One that is over the budget by
    itself is a part of its own; unit_sources truncates files so none is,
    when it is given the budget.

    Args:
        sources (list of Source): the unit's sources, in unit order
        input_token_budget (int): the most estimated tokens of source text in
            one part

    Returns:
        list of list of Source: the parts, in unit order; a single part when
            every source fits in one call
    """
    parts: list[list[Source]] = []
    part_tokens = 0
    for source in sources:
        if not parts or part_tokens + source.tokens > input_token_budget:
            parts.append([])
            part_tokens = 0
        parts[-1].append(source)
        part_tokens += source.tokens
    return parts


def unit_sources(
    unit: Unit, max_file_tokens: int, input_token_budget: int | None = None
) -> list[Source]:
    """
    Return the sources for a unit's published files with text, in unit order.

    Args:
        unit (Unit): the unit, bin or context unit
        max_file_tokens (int): the per-file limit, see truncate()
        input_token_budget (int | None): the most tokens one call may read; a file whose
            block would be over FILE_BUDGET_SHARE of it is truncated further,
            so it fits one part of a split unit

    Returns:
        list of Source: one per file with text
    """
    links = (
        UnitContentFile.objects.filter(unit=unit, content_file__published=True)
        .select_related("content_file")
        .order_by("position", "id")
    )
    sources = []
    for link in links:
        content_file = link.content_file
        text = (content_file.content or "").strip()
        if not text:
            continue
        source_id = f"S{len(sources) + 1:02d}"
        header = _header(source_id, content_file, link.relation)
        included, included_chars = truncate(text, max_file_tokens)
        source = Source(
            source_id=source_id,
            content_file_id=content_file.id,
            checksum=content_file.checksum or "",
            header=header,
            text=included,
            included_chars=included_chars,
            total_chars=len(text),
        )
        sources.append(_fit_to_budget(source, text, input_token_budget))
    return sources
