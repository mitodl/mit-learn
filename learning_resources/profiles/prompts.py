def context_unit_combined_prompt(
    course_title: str, sources_block: str, part_note: str | None = None
) -> str:
    """
    Return the combined prompt for the context unit, or for one part of it
    when the context unit is split
    """
    part = f"\n{part_note}\n" if part_note else ""
    return f"""Course: {course_title}
{part}
Extract the course context from the following sources.

{sources_block}

Call the tool with the complete CourseContextOut."""


def context_merge_combined_prompt(course_title: str, parts_block: str) -> str:
    """Return the combined prompt that merges the parts of a split context unit"""
    return f"""Course: {course_title}

PART RECORDS (parts of the course context in order; item ids in brackets)
{parts_block}

Call the tool with the complete ContextMergeExtraction for the whole course context."""


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


def unit_merge_combined_prompt(
    course_outline: str, unit_header: str, parts_block: str
) -> str:
    """Return the combined prompt that merges the parts of a split unit"""
    return f"""COURSE (for orientation)
{course_outline}

UNIT
{unit_header}

PART RECORDS (parts in unit order; claim ids in brackets)
{parts_block}

Call the tool with the complete UnitMergeExtraction for the whole unit."""


def run_combined_prompt(context_block: str, units_block: str) -> str:
    """Return the combined prompt for a run"""
    return f"""COURSE CONTEXT CLAIMS
{context_block}

UNIT RECORDS (units in course order, then bins; claim ids in brackets)
{units_block}

Call the tool with the complete RunExtraction."""
