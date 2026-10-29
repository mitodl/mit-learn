def context_unit_combined_prompt(course_title: str, sources_block: str) -> str:
    """Return the combined prompt for the context unit"""
    return f"""Course: {course_title}

Extract the course context from the following sources.

{sources_block}

Call the tool with the complete CourseContextOut."""


def unit_combined_prompt(
    course_outline: str, unit_header: str, sources_block: str
) -> str:
    """Return the combined prompt for a unit or bin"""
    return f"""COURSE (for orientation; cite only the unit's own sources below)
{course_outline}

UNIT
{unit_header}

MATERIALS
{sources_block}

Call the tool with the complete UnitExtraction for this unit."""
