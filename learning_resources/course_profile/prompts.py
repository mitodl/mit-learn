"""
The combined prompts: the course material for a call, sent alongside the
stage's system prompt.

The system prompts themselves are in CourseProfileConfiguration, seeded by
migration 0132. The unit header leaves out "unit N of M" so that adding a unit
doesn't change every other unit's prompt.
"""

# Appended to the unit prompt when the call reads one part of a split unit.
# Not admin-editable: it is part of the unit_part extractor version, so
# editing the unit prompt still invalidates both.
UNIT_PART_NOTE = """
You are seeing only one part of this unit; the other parts are extracted separately and merged afterwards. Report
assumed knowledge as it appears in this part, without deciding whether another part of the unit teaches it.
"""  # noqa: E501


def context_unit_combined_prompt(course_title: str, sources_block: str) -> str:
    """Return the combined prompt for the context unit"""
    return f"""Course: {course_title}

Extract the course context from the following sources.

{sources_block}

Call the tool with the complete CourseContextOut."""


def unit_combined_prompt(
    context_digest: str, unit_header: str, sources_block: str
) -> str:
    """Return the combined prompt for a unit, bin or unit part"""
    return f"""COURSE CONTEXT (for orientation; cite only the unit's own sources below)
{context_digest}

UNIT
{unit_header}

MATERIALS
{sources_block}

Call the tool with the complete UnitExtraction for this unit."""


def unit_merge_combined_prompt(
    context_digest: str, unit_header: str, parts_digest: str
) -> str:
    """Return the combined prompt for merging a split unit's parts"""
    return f"""COURSE CONTEXT (for orientation)
{context_digest}

UNIT
{unit_header}

PART RECORDS (in unit order; claim ids in brackets)
{parts_digest}

Call the tool with the complete UnitMergeOut for the whole unit."""
