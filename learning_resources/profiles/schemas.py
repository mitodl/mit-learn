"""
Output contracts for the resource profile LLM calls.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Strict(BaseModel):
    """Reject fields the schema doesn't define"""

    model_config = ConfigDict(extra="forbid")


class Evidence(Strict):
    source_id: str = Field(
        description="Source ID exactly as written in the SOURCE header, e.g. S03"
    )
    passage: str = Field(
        min_length=10,
        max_length=700,
        description=(
            "Verbatim excerpt (about 10-60 words) copied exactly from that source."
            " Never paraphrase."
        ),
    )
    locator: str | None = Field(
        None,
        description=(
            "Timestamp [hh:mm:ss] for transcripts, 'p.N' for PDFs, or the section"
            " heading for pages"
        ),
    )


# --------------------------------------------------------------------------- unit
class ConceptOutput(Strict):
    label: str = Field(
        description=(
            "Short canonical name suitable for matching across courses,"
            " e.g. 'Newton's second law'"
        )
    )
    description: str = Field(
        description=(
            "1-2 sentences describing the concept as treated in this unit;"
            " self-contained"
        )
    )
    kind: Literal["concept", "method", "skill", "tool", "application"]
    teaching_status: Literal["taught", "reviewed", "used", "mentioned"] = Field(
        description=(
            "taught = defined, explained or derived here; reviewed = re-explained"
            " as material learners have seen before; used = applied in this unit"
            " without being explained; mentioned = named only"
        )
    )
    content_file_ref: str | None = Field(
        None,
        description=(
            "Source id or title of the content file where this happens, if identifiable"
        ),
    )
    evidence: list[Evidence] = Field(min_length=1)


class SkillOutput(Strict):
    label: str = Field(
        description=(
            "Specific ability phrased as 'Do X', e.g. 'Draw a free-body diagram for"
            " a block on an incline'"
        )
    )
    description: str
    evidence: list[Evidence] = Field(min_length=1)


class AssumedOutput(Strict):
    label: str = Field(
        description=(
            "Short canonical name of the assumed knowledge, e.g. 'Derivative of"
            " polynomial functions'"
        )
    )
    description: str
    how_used: str = Field(
        description="Where/how the material relies on it without explaining it"
    )
    flagged_as_prior: bool = Field(
        description=(
            "True if the material explicitly frames it as prior knowledge"
            " ('recall', 'you learned', 'from calculus')"
        )
    )
    evidence: list[Evidence] = Field(min_length=1)


class AssessmentOutput(Strict):
    label: str
    description: str = Field(
        description="What the assessment item asks the learner to do"
    )
    tests_concept_labels: list[str] = Field(
        description="Concept labels (from this unit or earlier) the item requires"
    )
    evidence: list[Evidence] = Field(min_length=1)


class UnitExtraction(Strict):
    summary: str = Field(description="3-5 sentence summary of what the unit teaches")
    concepts: list[ConceptOutput]
    skills: list[SkillOutput]
    assumed_knowledge: list[AssumedOutput]
    assessment_expectations: list[AssessmentOutput]
    extraction_notes: list[str] = Field(
        description="Gaps, ambiguities, material you could not use"
    )


# --------------------------------------------------------------------------- context
class Statement(Strict):
    text: str
    evidence: list[Evidence] = Field(min_length=1)


class PrereqStatement(Strict):
    label: str
    statement: str = Field(description="What the source says, closely paraphrased")
    kind: Literal["prerequisite", "corequisite", "recommended", "explicitly_none"]
    course_ref: str | None = Field(
        None, description="Referenced course number, e.g. 18.01SC"
    )
    evidence: list[Evidence] = Field(min_length=1)


class OutlineEntry(Strict):
    unit_label: str
    title: str


class Conflict(Strict):
    topic: str
    statements: list[Statement] = Field(min_length=2)
    assessment: str = Field(
        description=(
            "How the statements disagree and which is likely authoritative, if any"
        )
    )


class CourseContextOut(Strict):
    title: str
    stated_audience: list[Statement]
    description: Statement | None = None
    objectives: list[Statement]
    prerequisites_status: Literal["stated", "explicitly_none", "not_found"]
    prerequisites: list[PrereqStatement]
    required_materials: list[Statement] = Field(
        description="What is graded or required vs. optional, as stated"
    )
    instructional_outline: list[OutlineEntry]
    conflicts: list[Conflict]
    extraction_notes: list[str] = Field(
        description="Gaps, ambiguities, material you could not use"
    )
