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
