"""Tests for rendering resource profile sources"""

import pytest

from learning_resources.factories import (
    ContentFileFactory,
    UnitContentFileFactory,
    UnitFactory,
)
from learning_resources.models import UnitContentFile
from learning_resources.profiles.sources import (
    CHARS_PER_TOKEN,
    FILE_BUDGET_SHARE,
    Source,
    pack_parts,
    truncate,
    unit_sources,
)


def test_truncate_fits():
    """Text under the limit is unchanged"""
    assert truncate("short text", 10) == ("short text", 10)


def test_truncate_at_page_marker():
    """Long text is cut at the last page marker before the limit"""
    page = "word " * 300
    text = f"[page 1] {page}[page 2] {page}[page 3] {page}"
    truncated, included = truncate(text, max_tokens=len(text) // CHARS_PER_TOKEN - 100)
    kept, marker = truncated.split("\n[... truncated:")
    assert kept == f"[page 1] {page}[page 2] {page}".rstrip()
    assert included == len(f"[page 1] {page}[page 2] {page}")
    assert f"of {len(text):,} characters" in marker


def test_truncate_hard_cut():
    """Text with no break in the second half of the limit is cut at the limit"""
    text = "x" * 1000
    truncated, included = truncate(text, max_tokens=100)
    assert included == 400
    assert truncated.startswith("x" * 400 + "\n[... truncated: the first 400 of 1,000")


@pytest.mark.django_db
def test_unit_sources():
    """A unit's published files with text are rendered in order, with position ids"""
    unit = UnitFactory.create()
    files = [
        ContentFileFactory.create(
            run=unit.run,
            content=f"text {index}",
            title=f"T{index}",
        )
        for index in range(4)
    ]
    files[1].content = ""
    files[1].save()
    files[3].published = False
    files[3].save()
    for position, content_file in reversed(list(enumerate(files))):
        UnitContentFileFactory.create(
            unit=unit,
            content_file=content_file,
            position=position,
            relation=UnitContentFile.Relation.ASSESSMENT,
        )

    sources = unit_sources(unit, max_file_tokens=100)

    assert [source.content_file_id for source in sources] == [files[0].id, files[2].id]
    assert [source.source_id for source in sources] == ["S01", "S02"]
    assert sources[1].text == "text 2"
    files[2].refresh_from_db()
    assert sources[1].checksum == files[2].checksum
    assert sources[1].header == (
        f"=== SOURCE S02 | type={files[2].content_type} | title='T2'"
        " | relation=assessment ==="
    )
    assert sources[1].block == f"{sources[1].header}\ntext 2\n=== END S02 ===\n"
    assert not sources[1].truncated


@pytest.mark.django_db
@pytest.mark.parametrize("budget", [None, 500])
def test_unit_sources_fit_budget(budget):
    """A file over a share of the input budget is truncated to fit it"""
    unit = UnitFactory.create()
    for position, text in enumerate(["Short file.", "A long transcript. " * 500]):
        UnitContentFileFactory.create(
            unit=unit,
            content_file=ContentFileFactory.create(run=unit.run, content=text),
            position=position,
        )

    short, long = unit_sources(unit, max_file_tokens=25000, budget=budget)

    assert short.text == "Short file."
    assert long.truncated is (budget is not None)
    if budget is not None:
        assert long.tokens <= budget * FILE_BUDGET_SHARE
        assert long.tokens > budget * FILE_BUDGET_SHARE / 2
        assert long.text.endswith("characters of this file are included ...]")


def _source(index, tokens):
    """Return a source whose block is the given number of tokens"""
    # the block adds a newline, the END line and a newline around the text
    chars = tokens * CHARS_PER_TOKEN - len(f"\n\n=== END S{index:02d} ===\n")
    return Source(
        source_id=f"S{index:02d}",
        content_file_id=index,
        checksum="",
        header="",
        text="x" * chars,
        included_chars=chars,
        total_chars=chars,
    )


@pytest.mark.parametrize(
    ("tokens", "budget", "expected"),
    [
        ([100, 100, 100], 300, [[1, 2, 3]]),
        ([100, 100, 100], 250, [[1, 2], [3]]),
        ([100, 50, 100, 100], 150, [[1, 2], [3], [4]]),
        # a source over the budget by itself is a part of its own
        ([50, 400, 50], 100, [[1], [2], [3]]),
        ([], 100, []),
    ],
)
def test_pack_parts(tokens, budget, expected):
    """Sources are packed in order into parts that fit the budget"""
    sources = [_source(index, count) for index, count in enumerate(tokens, 1)]
    assert [source.tokens for source in sources] == tokens

    parts = pack_parts(sources, budget)

    assert [[source.content_file_id for source in part] for part in parts] == expected
