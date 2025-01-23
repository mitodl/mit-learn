"""Constants for the AI Chat application."""

from typing import Annotated

from langgraph.graph.message import add_messages
from named_enum import ExtendedEnum
from typing_extensions import TypedDict


class AIModelAPI(ExtendedEnum):
    """
    Enum for AI model APIs.  Add new AI APIs here.
    """

    openai = "openai"


class AgentState(TypedDict):
    """
    Hold the state of each agent (ie messages)
    """

    messages: Annotated[list, add_messages]


GROUP_STAFF_AI_SYTEM_PROMPT_EDITORS = "ai_system_prompt_editors"
AI_ANONYMOUS_USER = "anonymous"
AI_THREAD_COOKIE_KEY = "ai_thread_id"
