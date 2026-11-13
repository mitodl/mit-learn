"""Tests for reading practice problems from structured markdown"""

import json

import pytest

from learning_resources.etl.practice_problems import (
    clean_display_markdown,
    parse_structured_problems,
    read_structure_header,
)


def _header(status="validated", kind="problem_set", title="Problem Set 1"):
    data = {
        "pipeline_version": "source-spans-2.1",
        "status": status,
        "kind": kind,
        "title": title,
        "source_sha256": "abc",
    }
    return f"<!-- structure: {json.dumps(data)} -->\n"


def _node(node_id, role, parent_id=None, **fields):
    data = {
        "id": node_id,
        "role": role,
        "parent_id": parent_id,
        "problem": fields.pop("problem", None),
        "part": fields.pop("part", None),
        "pages": fields.pop("pages", [1]),
        **fields,
    }
    return f"\n<!-- node: {json.dumps(data)} -->\n\n"


def structured_markdown(status="validated", kind="problem_set"):
    """Structured markdown as export_structure_markdown writes it"""
    figure = (
        '![a velocity plot](https://example.com/p1_1.png "p1_1 page=1 '
        'bbox=[1.0,2.0,3.0,4.0] page_size=[612.0,792.0]")'
    )
    return (
        _header(status=status, kind=kind)
        + "<!-- page: 1 -->\n\n"
        + _node(
            "n1",
            "problem",
            problem="1",
            number="1",
            title="Problem 1",
            friendly_title="Car and Bicycle Rider",
            topics=["Kinematics"],
            points="10",
        )
        + "## Problem 1\n\nA car moves at speed $v_0$.\n"
        + _node("n2", "part", "n1", problem="1", part="a")
        + "(a) Find $v(t)$.\n\n<!-- region p1_1 -->\n"
        + f"{figure}\n\n<details><summary>Transcription</summary>\n\n"
        + "v against t\n\n</details>\n<!-- /region -->\n"
        + _node("n3", "solution", "n2", problem="1", part="a")
        + "**Solution:** $v = v_0$.\n\n<!-- page: 2 -->\n"
        + _node("n4", "part", "n1", problem="1", part="(b)", pages=[2])
        + "(b) Find $x(t)$.\n"
        + _node("n5", "example", "n4", problem="1", part="b", pages=[2])
        + "For example, at $t = 1$.\n"
        + _node("n6", "problem", problem="2", number="2", title="Problem 2", pages=[2])
        + "## Problem 2\n\nCompute $\\int_0^1 x\\,dx$.\n\n"
        + '<!-- figure id=p2_1 page=2 bbox=[1.0,2.0,3.0,4.0] page_size=[612.0,792.0] description="a shaded area" -->\n'
        + _node(
            "n7",
            "problem",
            problem="3",
            number="3",
            title="Problem 3",
            statement_available=False,
            pages=[2],
        )
        + _node("n8", "solution", "n7", problem="3", pages=[2])
        + "The answer is 4.\n"
    )


def test_read_structure_header():
    """The header is read from structured markdown only"""
    assert read_structure_header(structured_markdown())["kind"] == "problem_set"
    assert read_structure_header("# Just markdown") is None
    assert read_structure_header(None) is None


def test_parse_structured_problems():
    """Problems are read with their parts, solutions, pages and fields"""
    document = parse_structured_problems(structured_markdown())
    assert document.kind == "problem_set"
    assert document.title == "Problem Set 1"
    # problem 3's statement is not in the file
    first, second = document.problems

    assert first.node_id == "n1"
    assert first.number == "1"
    assert first.display_title == "Car and Bicycle Rider"
    assert first.statement == "A car moves at speed $v_0$."
    assert [(p.label, p.body) for p in first.parts] == [
        ("a", "Find $v(t)$.\n\n![a velocity plot](https://example.com/p1_1.png)"),
        ("b", "Find $x(t)$.\n\nFor example, at $t = 1$."),
    ]
    assert first.solution == "**(a)** **Solution:** $v = v_0$."
    assert first.pages == [1, 2]
    assert first.topics == ["Kinematics"]
    assert first.points == "10"
    # its first saved figure, from part (a)
    assert first.figure == {
        "url": "https://example.com/p1_1.png",
        "alt": "a velocity plot",
    }

    assert second.display_title == "Problem 2"
    assert second.statement == (
        "Compute $\\int_0^1 x\\,dx$.\n\n*[Figure: a shaded area]*"
    )
    assert second.parts == []
    # an unsaved figure is not an image
    assert second.figure is None


@pytest.mark.parametrize(
    "markdown",
    [
        None,
        "",
        "## Problem 1\n\nNot structured.",
        structured_markdown(status="needs_review"),
    ],
)
def test_parse_structured_problems_unstructured(markdown):
    """Markdown that was not structured, or failed its checks, has no problems"""
    assert parse_structured_problems(markdown) is None


def test_parse_structured_problems_solutions_file():
    """A solutions file's problems are not learner tasks"""
    document = parse_structured_problems(structured_markdown(kind="solutions"))
    assert document.kind == "solutions"
    assert document.problems == []


def test_parse_structured_problems_split_node():
    """A node split by another node keeps all of its text"""
    markdown = (
        _header()
        + _node("n1", "problem", problem="1", number="1")
        + "## Problem 1\n\nStart.\n"
        + _node("n2", "solution", "n1", problem="1")
        + "Answer.\n"
        + _node("n1", "problem", problem="1", number="1")
        + "Continued.\n"
    )
    [problem] = parse_structured_problems(markdown).problems
    assert problem.statement == "Start.\n\nContinued."
    assert problem.solution == "Answer."


def test_clean_display_markdown_region_without_image():
    """A region whose image was not saved shows its transcription"""
    markdown = (
        "Before.\n\n<!-- region p1_1 -->\n"
        '<!-- figure id=p1_1 page=1 bbox=[1.0,2.0,3.0,4.0] page_size=[1.0,1.0] description="a box" -->'
        "\n\n<details><summary>Transcription</summary>\n\nBoxed text.\n\n"
        "</details>\n<!-- /region -->\n\n\n\nAfter."
    )
    assert clean_display_markdown(markdown) == "Before.\n\nBoxed text.\n\nAfter."
