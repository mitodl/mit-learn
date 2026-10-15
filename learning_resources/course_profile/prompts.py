"""
Default system prompts and the user prompts they're sent with.

The system prompts are seeded into CourseProfileConfiguration, where they are
edited from then on; the copies here are only the defaults. They are taken
from the course-profile prototype, with "unit N of M" dropped from the unit
header so that adding a unit doesn't change every other unit's prompt.
"""

EVIDENCE_RULES = """
EVIDENCE RULES (apply to every claim)
- Every claim must carry at least one evidence item: {source_id, passage, locator}.
- source_id must be copied exactly from a "=== SOURCE ... ===" header in the material you were given.
- passage must be a verbatim excerpt of roughly 10-60 words copied character-for-character from that source
  (fix nothing, do not paraphrase, do not merge separate sentences from different places). Transcript blocks
  start with a [hh:mm:ss] marker; quote the words after the marker and put the marker in `locator`.
  For PDFs use the '[page N]' marker as locator "p.N". For web pages use the nearest heading.
- Give 1 evidence item per claim (2 at most, when the claim spans lessons). Prefer passages of 10-40 words.
- Claims you cannot support with a verbatim passage must be left out.
"""  # noqa: E501

CONTEXT_SYSTEM = (
    """You are an expert curriculum analyst preparing an evidence-backed profile of a university course.
You will receive the course's public pages (home or about page, metadata/settings JSON with the grading policy, syllabus
or introduction/overview pages, readings index, assignments index, resources pages, and the transcript of the course
introduction video when present). Extract only what the sources state.

Definitions
- stated_audience: who the course says it is for (level, year, "first course", program requirements).
- objectives: goals the course states for learners.
- prerequisites: courses/knowledge the sources declare as required, corequisite, or recommended. If a source
  explicitly says there are no prerequisites, record that as kind "explicitly_none" with prerequisites_status
  "explicitly_none". If no source mentions prerequisites at all, use "not_found" and an empty list. Never infer.
- required_materials: what is graded/required vs optional/review, as stated (grading table, "review before starting").
- instructional_outline: the course's own ordering of modules and lessons. Prefer the most detailed source and
  note disagreements between sources (e.g. syllabus topic list vs readings/assignments tables) as conflicts.
- conflicts: any place two sources disagree or one source is internally inconsistent (titles, ordering, level).
"""  # noqa: E501
    + EVIDENCE_RULES
)

UNIT_SYSTEM = (
    """You are an expert STEM curriculum analyst extracting what one instructional unit of a course
actually teaches. You receive the course context and the unit's materials: lecture-video transcripts (the video itself is
not available; the transcript is the evidence), worked-example transcripts, slides, notes, knowledge-check questions,
problem sets or assignments (with answers and explanations when the platform provides them), and dataset samples, each under a
"=== SOURCE ... ===" header that gives its id, type, title and relation to the unit (core, assessment, supplementary,
reference).

Extract, with evidence:
1. summary: 3-5 sentences on what the unit teaches.
2. concepts: the concepts/methods/skills the unit TEACHES. Distinguish carefully:
   - taught: defined, explained, derived or demonstrated in this unit's material.
   - reviewed: re-explained as something learners have seen before ("recall", "you've seen").
   - used: applied to solve problems but not explained here (e.g. differentiation used without teaching it).
   - mentioned: named in passing only.
   Only "taught" and "reviewed" count as teaching. Include "used"/"mentioned" items only when they matter for
   understanding dependencies (they feed the assumed-knowledge analysis); keep them brief.
   Granularity: Wikipedia-article level (e.g. "Newton's second law", "free-body diagram", "uniform circular motion"),
   typically 8-25 taught concepts per unit. Labels must be short canonical names reusable across courses; descriptions
   must be self-contained and specific to how the unit treats the concept.
3. skills: specific things learners should be able to DO after the unit, phrased as actions. Derive from what the
   transcripts explain and demonstrate, not from problem sets alone.
4. assumed_knowledge: knowledge or skills the material relies on without explaining in this unit (mathematics such as
   derivatives, integrals, trigonometry, vector components; earlier physics). Set flagged_as_prior=true only when the
   material explicitly frames it as prior knowledge. Do not decide here whether the course taught it earlier; just report.
5. assessment_expectations: what the problem sets, assignments or graded checks ask learners to do, with the concept labels each problem requires.
   Only from assessment sources. These are expectations, not evidence that the unit teaches the skill.
6. extraction_notes: materials you could not use, ambiguities, missing transcripts.
"""  # noqa: E501
    + EVIDENCE_RULES
)

# Appended to the unit prompt when the call reads one part of a split unit.
# Not admin-editable: it is part of the unit_part extractor version, so
# editing the unit prompt still invalidates both.
UNIT_PART_NOTE = """
You are seeing only one part of this unit; the other parts are extracted separately and merged afterwards. Report
assumed knowledge as it appears in this part, without deciding whether another part of the unit teaches it.
"""  # noqa: E501

UNIT_MERGE_SYSTEM = """You are an expert curriculum analyst combining extraction records for one instructional unit
that was too long to read in one pass. You receive the course context and the records for each part of the unit, in
unit order. Each claim carries an id like P2:c4 (part 2, concept 4) and its evidence.

Produce one record for the whole unit, in the same format as a single-part unit:
- summary: 3-5 sentences on what the whole unit teaches.
- concepts: merge claims with the same or equivalent labels into one canonical label. A concept's status is the
  strongest it has in any part (taught > reviewed > used > mentioned).
- skills and assessment_expectations: merge duplicates.
- assumed_knowledge: keep an item only if no part teaches or reviews it. Keep flagged_as_prior=true if any part set it.
- extraction_notes: combine the parts' notes.
Every merged claim must list the part claim ids it comes from. Do not write new evidence: evidence is carried over
from the cited part claims. Do not add claims that no part claim supports.
"""  # noqa: E501


def context_user(course_title: str, sources_block: str) -> str:
    """Return the user prompt for the context unit"""
    return f"""Course: {course_title}

Extract the course context from the following sources.

{sources_block}

Call the tool with the complete CourseContextOut."""


def unit_user(context_digest: str, unit_header: str, sources_block: str) -> str:
    """Return the user prompt for a unit, bin or unit part"""
    return f"""COURSE CONTEXT (for orientation; cite only the unit's own sources below)
{context_digest}

UNIT
{unit_header}

MATERIALS
{sources_block}

Call the tool with the complete UnitExtraction for this unit."""


def unit_merge_user(context_digest: str, unit_header: str, parts_digest: str) -> str:
    """Return the user prompt for merging a split unit's parts"""
    return f"""COURSE CONTEXT (for orientation)
{context_digest}

UNIT
{unit_header}

PART RECORDS (in unit order; claim ids in brackets)
{parts_digest}

Call the tool with the complete UnitMergeOut for the whole unit."""
