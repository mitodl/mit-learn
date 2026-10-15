"""
Output contracts for the course profile LLM calls.

Taken from the course-profile prototype. A response that doesn't validate
against its schema is requested again, so the field descriptions are part of
the prompt.
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
class ConceptOut(Strict):
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
    lesson_ref: str | None = Field(
        None, description="Lesson id or title where this happens, if identifiable"
    )
    evidence: list[Evidence] = Field(min_length=1)


class SkillOut(Strict):
    label: str = Field(
        description=(
            "Specific ability phrased as 'Do X', e.g. 'Draw a free-body diagram for"
            " a block on an incline'"
        )
    )
    description: str
    evidence: list[Evidence] = Field(min_length=1)


class AssumedOut(Strict):
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


class AssessmentOut(Strict):
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
    concepts: list[ConceptOut]
    skills: list[SkillOut]
    assumed_knowledge: list[AssumedOut]
    assessment_expectations: list[AssessmentOut]
    extraction_notes: list[str] = Field(
        description="Gaps, ambiguities, material you could not use"
    )


# --------------------------------------------------------------------------- unit merge
class MergedClaim(Strict):
    part_claim_ids: list[str] = Field(
        min_length=1,
        description="Ids of the part claims this merges, e.g. ['P1:c3', 'P2:c1']",
    )


class MergedConcept(MergedClaim):
    label: str
    description: str
    kind: Literal["concept", "method", "skill", "tool", "application"]
    teaching_status: Literal["taught", "reviewed", "used", "mentioned"]
    lesson_ref: str | None = None


class MergedSkill(MergedClaim):
    label: str
    description: str


class MergedAssumed(MergedClaim):
    label: str
    description: str
    how_used: str
    flagged_as_prior: bool


class MergedAssessment(MergedClaim):
    label: str
    description: str
    tests_concept_labels: list[str]


class UnitMergeOut(Strict):
    summary: str = Field(
        description="3-5 sentence summary of what the whole unit teaches"
    )
    concepts: list[MergedConcept]
    skills: list[MergedSkill]
    assumed_knowledge: list[MergedAssumed]
    assessment_expectations: list[MergedAssessment]
    extraction_notes: list[str]


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
    lesson_titles: list[str]


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
    description: Statement
    objectives: list[Statement]
    prerequisites_status: Literal["stated", "explicitly_none", "not_found"]
    prerequisites: list[PrereqStatement]
    required_materials: list[Statement] = Field(
        description="What is graded or required vs. optional, as stated"
    )
    instructional_outline: list[OutlineEntry]
    conflicts: list[Conflict]
    notes: list[str]
