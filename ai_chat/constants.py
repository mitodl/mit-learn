"""Constants for the AI Chat application."""

from named_enum import ExtendedEnum


class AIModelAPI(ExtendedEnum):
    """
    Enum for AI model APIs.  Add new AI APIs here.
    """

    openai = "openai"


GROUP_STAFF_AI_SYTEM_PROMPT_EDITORS = "ai_system_prompt_editors"
AI_ANONYMOUS_USER = "anonymous"
