"""Tests for resource profile evidence verification"""

import pytest

from learning_resources.profiles.verification import (
    EXACT,
    FUZZY,
    UNKNOWN_SOURCE,
    UNVERIFIED,
    normalize,
    verify_all_evidence,
    verify_passage,
)

SOURCE = (
    "[00:01:30] Newton's second law says that the net force on a body equals\n"
    "its mass times its acceleration. [page 2] We will use free-body diagrams"
    " to find the net force acting on each block in the system."
)


def test_normalize():
    """Normalize lowercases and drops punctuation and extra whitespace"""
    assert normalize("  Newton's  2nd\nLaw!  ") == "newton s 2nd law"


def test_verify_passage_exact_with_span():
    """A verbatim passage is exact, with its span in the source"""
    passage = "the net force on a body equals its mass times its acceleration"
    match = verify_passage(passage, SOURCE)
    assert match.verified == EXACT
    assert SOURCE[match.span_start : match.span_end] == (
        "the net force on a body equals\nits mass times its acceleration"
    )


def test_verify_passage_exact_across_markers():
    """A passage is exact after normalizing case, punctuation and locator markers"""
    passage = "Its mass times its acceleration. We will use free-body diagrams"
    match = verify_passage(passage, SOURCE)
    assert match.verified == EXACT
    assert match.span_start is None


def test_verify_passage_fuzzy():
    """A passage with a small difference is fuzzy"""
    passage = (
        "We will use free-body diagrams to find the net force acting on every"
        " block in the system."
    )
    assert verify_passage(passage, SOURCE).verified == FUZZY


def test_verify_passage_ellipsis():
    """A passage joining verbatim fragments with an ellipsis is fuzzy"""
    passage = (
        "Newton's second law says that the net force... free-body diagrams to find"
    )
    assert verify_passage(passage, SOURCE).verified == FUZZY


@pytest.mark.parametrize(
    "passage",
    [
        "Energy is conserved in every closed system that we consider here",
        "acting force",
        "",
    ],
)
def test_verify_passage_unverified(passage):
    """A passage that isn't in the source is unverified"""
    assert verify_passage(passage, SOURCE).verified == UNVERIFIED


def test_verify_all_evidence():
    """Every evidence list is verified, at any depth, against its own source"""
    passage = "We will use free-body diagrams"
    output = {
        "summary": "text",
        "concepts": [
            {
                "label": "Newton's second law",
                "evidence": [
                    {"source_id": "S01", "passage": passage, "locator": None},
                    {"source_id": "S09", "passage": passage, "locator": None},
                ],
            }
        ],
        "description": {
            "text": "about",
            "evidence": [{"source_id": "S02", "passage": passage, "locator": None}],
        },
    }
    verified = verify_all_evidence(output, {"S01": SOURCE, "S02": "nothing"})
    concept_evidence = verified["concepts"][0]["evidence"]
    assert concept_evidence[0]["verified"] == EXACT
    assert concept_evidence[0]["span_start"] is not None
    assert concept_evidence[1]["verified"] == UNKNOWN_SOURCE
    assert verified["description"]["evidence"][0]["verified"] == UNVERIFIED
    assert verified["summary"] == "text"
