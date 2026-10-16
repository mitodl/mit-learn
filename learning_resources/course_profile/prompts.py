"""
The combined prompts: the course material for a call, sent alongside the
stage's system prompt.

The system prompts themselves are in CourseProfileConfiguration, seeded by
migration 0132. The unit header leaves out "unit N of M" so that adding a unit
doesn't change every other unit's prompt.
"""


def context_unit_combined_prompt(course_title: str, sources_block: str) -> str:
    """Return the combined prompt for the context unit"""
    return f"""Course: {course_title}

Extract the course context from the following sources.

{sources_block}

Call the tool with the complete CourseContextOut."""


def unit_combined_prompt(
    context_digest: str, unit_header: str, sources_block: str
) -> str:
    """Return the combined prompt for a unit or bin"""
    return f"""COURSE CONTEXT (for orientation; cite only the unit's own sources below)
{context_digest}

UNIT
{unit_header}

MATERIALS
{sources_block}

Call the tool with the complete UnitExtraction for this unit."""
