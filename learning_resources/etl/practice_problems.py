"""
Read the practice problems out of a PDF's structured markdown.

PDFs converted with OpenDataLoaderLLMConverter.convert_to_structured_markdown
start with a <!-- structure: {...} --> header and tag each node (problem, part,
solution, ...) of the document with a <!-- node: {...} --> comment before its
text (see learning_resources.converters.structure.export_structure_markdown).
"""

import json
import re
from dataclasses import dataclass, field

STRUCTURE_HEADER = re.compile(r"\A\s*<!-- structure: (?P<json>\{.*?\}) -->")
NODE_TAG = re.compile(r"^<!-- node: (?P<json>\{.*?\}) -->[ \t]*$", re.MULTILINE)
PAGE_MARKER = re.compile(r"^[ \t]*<!-- page: \d+ -->[ \t]*$", re.MULTILINE)
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
EXTRA_BLANK_LINES = re.compile(r"\n{3,}")
# a figure in display markdown, saved to storage (an absolute url)
DISPLAY_IMAGE = re.compile(r"!\[(?P<alt>[^\]]*)\]\((?P<url>https?://[^)\s]+)\)")

VALIDATED = "validated"
PROBLEM_ROLE = "problem"
PART_ROLE = "part"
SOLUTION_ROLE = "solution"
# document kinds whose problems are not learner tasks
NON_PROBLEM_KINDS = {"solutions", "student_work", "cover_only", "bibliography"}


@dataclass
class ProblemPart:
    """A lettered part of a problem"""

    label: str
    body: str


@dataclass
class ParsedProblem:
    """A problem read from structured markdown, with display-ready markdown"""

    node_id: str
    number: str
    title: str
    friendly_title: str
    statement: str
    parts: list[ProblemPart] = field(default_factory=list)
    solution: str = ""
    pages: list[int] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    points: str = ""

    @property
    def figure(self) -> dict | None:
        """The problem's first saved figure, {"url": ..., "alt": ...}, if any"""
        for markdown in [self.statement, *(part.body for part in self.parts)]:
            if match := DISPLAY_IMAGE.search(markdown):
                return {"url": match["url"], "alt": match["alt"]}
        return None

    @property
    def display_title(self) -> str:
        """The friendly title, else the printed title, else 'Problem N'"""
        return (
            self.friendly_title
            or self.title
            or (f"Problem {self.number}" if self.number else "Problem")
        )


@dataclass
class ParsedDocument:
    """The structure header of a document and its problems"""

    kind: str
    title: str
    problems: list[ParsedProblem]


@dataclass
class _Node:
    meta: dict
    chunks: list[str] = field(default_factory=list)

    @property
    def id(self) -> str:
        return self.meta["id"]

    @property
    def role(self) -> str:
        return self.meta.get("role") or ""

    @property
    def text(self) -> str:
        return "\n\n".join(chunk.strip() for chunk in self.chunks if chunk.strip())


def _load_comment_json(raw: str) -> dict | None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def read_structure_header(markdown: str | None) -> dict | None:
    """Return the structure header of structured markdown, if it has one"""
    match = STRUCTURE_HEADER.match(markdown or "")
    return _load_comment_json(match["json"]) if match else None


def clean_display_markdown(markdown: str) -> str:
    """
    Turn a node's converted markdown into markdown for display: page markers and
    other comments go, a region shows its image (or its transcription when its
    image was not saved), and an unsaved figure shows its description.
    """
    # the converter modules import litellm and OCR libraries, which must not
    # load when this module does (at boot, via the loaders)
    from learning_resources.converters.utils import (
        FIGURE_IMAGE,
        FIGURE_PLACEHOLDER,
        REGION_BLOCK,
    )

    def region(match: re.Match) -> str:
        figure = match["figure"].strip()
        return figure if FIGURE_IMAGE.search(figure) else match["transcription"].strip()

    text = PAGE_MARKER.sub("", markdown)
    text = REGION_BLOCK.sub(region, text)
    text = FIGURE_PLACEHOLDER.sub(
        lambda m: (
            f"*[Figure: {m['description'].strip()}]*"
            if m["description"].strip()
            else ""
        ),
        text,
    )
    # an image's title carries its figure id and location, not for display
    text = FIGURE_IMAGE.sub(lambda m: f"![{m['description']}]({m['link']})", text)
    text = HTML_COMMENT.sub("", text)
    return EXTRA_BLANK_LINES.sub("\n\n", text).strip()


def _part_label(meta: dict) -> str:
    return str(meta.get("part") or "").strip("(). ")


def _read_nodes(markdown: str) -> list[_Node]:
    """Return the tagged nodes in source order, each with all of its text"""
    nodes: dict[str, _Node] = {}
    matches = list(NODE_TAG.finditer(markdown))
    for i, match in enumerate(matches):
        meta = _load_comment_json(match["json"])
        if not meta or not meta.get("id"):
            continue
        end = matches[i + 1].start() if i + 1 < len(matches) else len(markdown)
        # a node's text can be split by other nodes (a problem continued after
        # its solution); every piece follows a tag of its own
        node = nodes.setdefault(meta["id"], _Node(meta=meta))
        node.chunks.append(markdown[match.end() : end])
    return list(nodes.values())


def _problem(problem: _Node, nodes: list[_Node]) -> ParsedProblem | None:
    """Assemble a problem from its node and its descendants' nodes"""
    from learning_resources.converters.structure import _strip_heading

    by_id = {n.id: n for n in nodes}

    def owner(node: _Node) -> _Node | None:
        """Return the nearest ancestor that is this problem or one of its parts"""
        parent = by_id.get(node.meta.get("parent_id"))
        while parent:
            if parent.id == problem.id or (
                parent.role == PART_ROLE and owner(parent) is not None
            ):
                return parent
            parent = by_id.get(parent.meta.get("parent_id"))
        return None

    number = str(problem.meta.get("number") or problem.meta.get("problem") or "")
    stem = [_strip_heading(problem.text, number)]
    parts: dict[str, list[str]] = {}
    labels: dict[str, str] = {}
    solutions: list[str] = []
    pages = set(problem.meta.get("pages") or [])
    for node in nodes:
        if node.id == problem.id or (container := owner(node)) is None:
            continue
        pages.update(node.meta.get("pages") or [])
        if node.role == SOLUTION_ROLE:
            label = _part_label(node.meta)
            solutions.append(f"**({label})** {node.text}" if label else node.text)
        elif node.role == PART_ROLE:
            label = _part_label(node.meta)
            labels[node.id] = label
            parts[node.id] = [
                _strip_heading(node.text, number, label),
                *parts.get(node.id, []),
            ]
        elif container.id == problem.id:
            stem.append(node.text)
        else:
            parts.setdefault(container.id, []).append(node.text)
            labels.setdefault(container.id, _part_label(container.meta))

    statement = clean_display_markdown("\n\n".join(stem))
    problem_parts = [
        ProblemPart(label=labels[node_id], body=body)
        for node_id, texts in parts.items()
        if (body := clean_display_markdown("\n\n".join(texts)))
    ]
    if problem.meta.get("statement_available") is False or not (
        statement or problem_parts
    ):
        return None
    topics = problem.meta.get("topics")
    return ParsedProblem(
        node_id=problem.id,
        number=number,
        title=str(problem.meta.get("title") or ""),
        friendly_title=str(problem.meta.get("friendly_title") or ""),
        statement=statement,
        parts=problem_parts,
        solution=clean_display_markdown("\n\n".join(solutions)),
        pages=sorted(p for p in pages if isinstance(p, int)),
        topics=[str(t) for t in topics] if isinstance(topics, list) else [],
        points=str(problem.meta.get("points") or ""),
    )


def parse_structured_problems(markdown: str | None) -> ParsedDocument | None:
    """
    Return the problems of a PDF's structured markdown, or None if it was not
    structured or its structure was not validated. Problems whose statement is
    not in the file (a solutions file) are left out.
    """
    header = read_structure_header(markdown)
    if not header or header.get("status") != VALIDATED:
        return None
    kind = str(header.get("kind") or "")
    nodes = _read_nodes(markdown)
    problems = (
        []
        if kind in NON_PROBLEM_KINDS
        else [
            problem
            for node in nodes
            if node.role == PROBLEM_ROLE and (problem := _problem(node, nodes))
        ]
    )
    return ParsedDocument(
        kind=kind, title=str(header.get("title") or ""), problems=problems
    )
