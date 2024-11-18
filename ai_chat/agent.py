import json
import logging
from enum import Enum
from typing import Optional

import pydantic
import requests
from django.conf import settings
from django.core.cache import caches
from llama_index.agent.openai import OpenAIAgent, OpenAIAssistantAgent
from llama_index.core.base.llms.types import ChatMessage
from llama_index.core.tools import FunctionTool, ToolMetadata
from llama_index.llms.openai import OpenAI

from learning_resources.constants import LearningResourceType, LevelType, OfferedBy

INSTRUCTIONS = f"""You are a helpful MIT learning resource recommendation
assistant. Use the provided function to search the MIT catalog and provide relevant
recommendations based on the user's message.If the user asks subsequent questions about
those results, answer using the information provided in that response.

If a user asks for resources "offered by" or "from" an institution,
you should include the offered_by parameter based on the following
dictionary: {OfferedBy.as_dict()}  DO NOT USE THE offered_by FILTER OTHERWISE.

If the user mentions courses, programs, videos, or podcasts in particular, filter
the search by resource_category.  DO NOT USE THE resource_type FILTER OTHERWISE.

If the user asks what other courses are taught by a particular instructor,
search the catalog for courses taught by that instructor.

If the user asks for introductory, intermediate, or advanced courses,
use the level filter. DO NOT USE THE level FILTER OTHERWISE.

Always explain your reasoning for recommending specific resources.

Always answer questions only based on searching the MIT catalog.
Do not use any other information.
"""

log = logging.getLogger(__name__)


def enum_zip(label: str, names: list[str]) -> Enum:
    """Create a new enum from a list"""
    return Enum(label, dict(zip(names, names)))


class SearchToolSchema(pydantic.BaseModel):
    q: str
    resource_type: Optional[
        Enum(
            "resource_type",
            dict(zip(LearningResourceType.names(), LearningResourceType.names())),
        )
    ]
    level: Optional[Enum("level", dict(zip(LevelType.names(), LevelType.names())))]
    free: Optional[bool]
    offered_by: Optional[
        Enum("offered_by", dict(zip(OfferedBy.names(), OfferedBy.names())))
    ]
    limit: Optional[int]


class FunctionAgentService:
    """Service class for the AI function agent"""

    def __init__(self, request, model="gpt-4o", cache_timeout=3600):
        self.assistant_name = "Learning Resource AI Assistant"
        self.model_id = "gpt-4o"
        self.instruction = INSTRUCTIONS
        self.request = request
        self.session = request.session
        self.model = model
        self.cache = caches["redis"]  # Save user's chat history to redis cache
        self.cache_timeout = cache_timeout
        self.cache_key = f"{request.session.session_key}_chat_history"
        self.agent = self.get_or_create_agent()

    def search_courses(self, q: str, **kwargs) -> str:
        """Query the MIT API for courses"""
        params = {"q": q}

        valid_params = {
            "level": kwargs.get("level"),
            "resource_type": kwargs.get("resource_type"),
            "free": kwargs.get("free"),
            "offered_by": kwargs.get("offered_by"),
            "limit": kwargs.get("limit"),
        }
        params.update({k: v for k, v in valid_params.items() if v is not None})
        log.info("Querying MIT API with parameters: %s", json.dumps(params))
        try:
            response = requests.get(
                settings.AI_MIT_SEARCH_URL, params=params, timeout=30
            )
            response.raise_for_status()
            # Simplify the response to only include the main properties
            results = []
            main_properties = [
                "title",
                "url",
                "description",
                "offered_by",
                "free",
                "resource_type",
                "instructors",
                "certification",
                "level",
            ]
            for result in response.json().get("results", []):
                results.append({k: result.get(k) for k in main_properties})  # noqa: PERF401
            return json.dumps(results)
        except requests.exceptions.RequestException as e:
            log.exception("Error querying MIT API")
            return json.dumps({"error": str(e)})

    def get_or_create_chat_history_cache(self, agent):
        """
        Get the user chat history from the cache,
        or create an empty cache key if it doesn't exist
        """
        if self.cache_key in self.cache:
            try:
                for message in json.loads(self.cache.get(self.cache_key)):
                    agent.chat_history.append(ChatMessage(**dict(message.items())))
            except json.JSONDecodeError:
                self.cache.set(self.cache_key, "[]", timeout=self.cache_timeout)
        else:
            self.cache.set(self.cache_key, "", timeout=self.cache_timeout)

    def get_or_create_agent(self):
        """Create the agent with any state for this particular user session"""
        llm = OpenAI(model=self.model)
        agent = OpenAIAgent.from_tools(
            [self.create_search_tool()],
            llm=llm,
            verbose=True,
            system_prompt=INSTRUCTIONS,
        )
        self.get_or_create_chat_history_cache(agent)
        return agent

    def get_or_create_assistant(self):
        """
        Create an assistant with any state for this particular user session
        Not used here.  Llamaindex equivalent of this function is in assistant.py
        """

        if "assistant_id" in self.session:
            log.info("Loading existing assistant")
            return OpenAIAssistantAgent.from_existing(self.session["assistant_id"])
        else:
            log.info("Creating new assistant")
            assist_agent = OpenAIAssistantAgent.from_new(
                name="Course Tutor",
                instructions=INSTRUCTIONS,
                openai_tools=[],
                tools=[self.create_search_tool()],
            )
            self.session["assistant_id"] = assist_agent.id
            return assist_agent

    def create_search_tool(self):
        metadata = ToolMetadata(
            name="search_courses",
            description="Search for learning resources in the MIT catalog",
            fn_schema=SearchToolSchema,
        )
        return FunctionTool.from_defaults(
            fn=self.search_courses, tool_metadata=metadata
        )

    def save_chat_history(self):
        """Save the chat history to the user session"""
        chat_history = [
            {
                "role": message.role,
                "content": message.content,
            }
            for message in self.agent.chat_history
            if message.role != "tool" and message.content
        ]
        self.cache.set(self.cache_key, json.dumps(chat_history), timeout=3600)

    def run_agent(self, message):
        """Run the AI assistant with the provided user message"""
        if message == "CLEAR HISTORY":
            # Clear the user's chat history cache
            self.cache.set(self.cache_key, "[]", timeout=3600)
            yield ("Chat history cleared")
        else:
            response = self.agent.stream_chat(message)
            response_gen = response.response_gen
            for token in response_gen:  # noqa: UP028
                yield token
            self.save_chat_history()
