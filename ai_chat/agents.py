"""Agent/service classes for the ai_chat app"""

import json
import logging
from abc import ABC, abstractmethod
from typing import Optional

import pydantic
import requests
from django.conf import settings
from django.core.cache import caches
from django.utils.module_loading import import_string
from llama_index.agent.openai import OpenAIAgent
from llama_index.core.agent import AgentRunner
from llama_index.core.base.llms.types import ChatMessage
from llama_index.core.constants import DEFAULT_TEMPERATURE
from llama_index.core.tools import FunctionTool, ToolMetadata
from llama_index.llms.openai import OpenAI
from openai import BadRequestError
from pydantic import Field

from ai_chat.constants import AIModelAPI
from ai_chat.utils import enum_zip
from learning_resources.constants import LearningResourceType, LevelType, OfferedBy

log = logging.getLogger(__name__)


class BaseChatAgentService(ABC):
    """Base service class for an AI chat agent"""

    INSTRUCTIONS = "Provide instructions for the AI assistant"
    JOB_ID = "BASECHAT_JOB"
    TASK_NAME = "BASECHAT_TASK"

    def __init__(  # noqa: PLR0913
        self,
        name,
        *,
        model=settings.AI_MODEL,
        temperature=DEFAULT_TEMPERATURE,
        instructions=None,
        user_id=None,
        save_history=False,
        cache_key=None,
        cache_timeout=settings.AI_CACHE_TIMEOUT,
    ):
        self.assistant_name = name
        self.ai = settings.AI_MODEL_API
        self.model_id = "gpt-4o"
        self.model = model
        self.save_history = save_history
        self.temperature = temperature
        self.instructions = instructions or self.INSTRUCTIONS
        self.user_id = user_id
        if settings.AI_PROXY_CLASS:
            self.proxy = import_string(f"ai_chat.proxy.{settings.AI_PROXY_CLASS}")()
        else:
            self.proxy = None
        if save_history:
            if not cache_key:
                msg = "cache_key must be set to save chat history"
                raise ValueError(msg)
            self.cache = caches["redis"]  # Save user's chat history to redis cache
            self.cache_timeout = cache_timeout
            self.cache_key = cache_key
        else:
            self.cache = None
            self.cache_timeout = None
            self.cache_key = ""
        self.agent = None

    def get_or_create_chat_history_cache(self, agent: AgentRunner) -> None:
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
            if self.proxy:
                self.proxy.create_proxy_user(self.user_id)
            self.cache.set(self.cache_key, "", timeout=self.cache_timeout)

    def create_agent(self) -> AgentRunner:
        """Create an AgentRunner for the relevant AI source"""
        if self.ai == AIModelAPI.openai.value:
            return self.create_openai_agent()
        else:
            error = f"AI source {self.ai} is not supported"
            raise NotImplementedError(error)

    @abstractmethod
    def create_openai_agent(self) -> OpenAIAgent:
        """Create an OpenAI agent"""

    def save_chat_history(self) -> None:
        """Save the chat history to the cache"""
        chat_history = [
            {
                "role": message.role,
                "content": message.content,
            }
            for message in self.agent.chat_history
            if message.role != "tool" and message.content
        ]
        self.cache.set(self.cache_key, json.dumps(chat_history), timeout=3600)

    def clear_chat_history(self) -> None:
        """Clear the chat history from the cache"""
        if self.save_history:
            self.cache.delete(self.cache_key)
            self.get_or_create_chat_history_cache(self.agent)

    @abstractmethod
    def get_comment_metadata(self):
        """Yield markdown comments to send hidden metdata in the response"""

    def run_streaming_agent(self, message) -> str:
        """
        Run the AI assistant with the provided user message
        and yield the response as it comes in
        """
        if not self.agent:
            error = "Create agent before running"
            raise ValueError(error)
        response = self.agent.stream_chat(
            message,
        )
        response_gen = response.response_gen
        try:
            yield from response_gen
        except BadRequestError as error:
            yield f"<!-- {error.response.json()} -->\n\n"
        if self.save_history:
            self.save_chat_history()
        yield f"\n\n<!-- {self.get_comment_metadata()} -->\n\n"


class SearchAgentService(BaseChatAgentService):
    """Service class for the AI search function agent"""

    JOB_ID = "SEARCH_JOB"
    TASK_NAME = "SEARCH_TASK"

    INSTRUCTIONS = f"""You are a helpful MIT learning resource recommendation
assistant. Use the provided tool to search the MIT catalog for results then
recommend the best 1 or 2 based on the user's message. If the user asks subsequent
questions about those results, answer using the information provided in that
response.  Make the title of the resource a clickable link.

Always run the tool to answer questions only based on the function search results.
VERY IMPORTANT: NEVER USE ANY INFORMATION OUTSIDE OF THE FUNCTION RESULTS TO
ANSWER QUESTIONS.

If a user asks for resources "offered by" or "from" an institution,
you should include the offered_by parameter based on the following
dictionary: {OfferedBy.as_dict()}  DO NOT USE THE offered_by FILTER OTHERWISE.

If the user mentions courses, programs, videos, or podcasts in particular, filter
the search by resource_type.  DO NOT USE THE resource_type FILTER OTHERWISE.
You MUST combine multiple resource types in one request like this:
"resource_type=course&resource_type=program". Do not attempt more than one query per
user message. If the user asks for podcasts, filter by both "podcast" and
"podcast_episode".

If the user asks what other courses are taught by a particular instructor,
search the catalog for courses taught by that instructor.

If the user asks for introductory, intermediate, or advanced courses,
use the level filter. DO NOT USE THE level FILTER OTHERWISE.

Do not use the certificate filer unless the user specifically asks for
resources that do or do not offer certificates.

Always explain your reasoning for recommending specific resources.
    """

    class SearchToolSchema(pydantic.BaseModel):
        """Schema for searching MIT learning resources.

        Attributes:
            q: The search query string
            resource_type: Filter by type of resource (course, program, etc)
            level: Filter by difficulty level
            free: Filter for free resources only
            certificate: Filter for resources offering certificates
            offered_by: Filter by institution offering the resource
        """

        q: str = Field(description="Search query to find learning resources")
        resource_type: Optional[
            list[enum_zip("resource_type", LearningResourceType)]
        ] = Field(default=None, description="Type of learning resource to search for")
        level: Optional[list[enum_zip("level", LevelType)]] = Field(
            default=None, description="Difficulty level of the resource"
        )
        free: Optional[bool] = Field(
            default=None, description="Whether the resource is free to access"
        )
        certificate: Optional[bool] = Field(
            default=None,
            description="Whether the resource offers a certificate upon completion",
        )
        offered_by: Optional[enum_zip("offered_by", OfferedBy)] = Field(
            default=None, description="Institution that offers the resource"
        )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "q": "machine learning",
                    "resource_type": ["course"],
                    "level": ["introductory", "undergraduate"],
                    "free": True,
                    "certificate": False,
                    "offered_by": "MIT",
                }
            ]
        }
    }

    def __init__(  # noqa: PLR0913
        self,
        name,
        *,
        model=settings.AI_MODEL,
        temperature=DEFAULT_TEMPERATURE,
        instructions=None,
        user_id=None,
        save_history=True,
        cache_key=None,
        cache_timeout=settings.AI_CACHE_TIMEOUT,
    ):
        super().__init__(
            name,
            model=model,
            temperature=temperature,
            instructions=instructions,
            save_history=save_history,
            user_id=user_id,
            cache_key=cache_key,
            cache_timeout=cache_timeout,
        )
        self.temperature = temperature
        self.search_parameters = []
        self.search_results = []
        self.agent = self.create_agent()
        self.create_agent()

    def search_courses(self, q: str, **kwargs) -> str:
        """
        Query the MIT API for learning resources, and
        return simplified results as a JSON string
        """

        params = {"q": q, "limit": settings.AI_MIT_SEARCH_LIMIT}

        valid_params = {
            "level": kwargs.get("level"),
            "resource_type": kwargs.get("resource_type"),
            "free": kwargs.get("free"),
            "offered_by": kwargs.get("offered_by"),
            "certificate": kwargs.get("certificate"),
        }
        params.update({k: v for k, v in valid_params.items() if v is not None})
        log.info("Querying MIT API with parameters: %s", json.dumps(params))
        self.search_parameters.append(params)
        try:
            response = requests.get(
                settings.AI_MIT_SEARCH_URL, params=params, timeout=30
            )
            response.raise_for_status()
            # Simplify the response to only include the main properties
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
            results = [
                {k: result.get(k) for k in main_properties}
                for result in response.json().get("results", [])
            ]
            self.search_results.append(results)
            return json.dumps(results)
        except requests.exceptions.RequestException as e:
            log.exception("Error querying MIT API")
            return json.dumps({"error": str(e)})

    def create_openai_agent(self) -> OpenAIAgent:
        """Create an OpenAI agent"""

        llm = OpenAI(
            model=self.model,
            **(self.proxy.get_api_kwargs() if self.proxy else {}),
            additional_kwargs=(
                self.proxy.get_additional_kwargs(self) if self.proxy else {}
            ),
        )
        if self.temperature:
            llm.temperature = self.temperature
        agent = OpenAIAgent.from_tools(
            [self.create_search_tool()],
            llm=llm,
            verbose=True,
            system_prompt=self.instructions,
        )
        if self.save_history:
            self.get_or_create_chat_history_cache(agent)
        return agent

    def create_search_tool(self) -> FunctionTool:
        """Create the search tool for the AI agent"""
        metadata = ToolMetadata(
            name="search_courses",
            description="Search for learning resources in the MIT catalog",
            fn_schema=self.SearchToolSchema,
        )
        return FunctionTool.from_defaults(
            fn=self.search_courses, tool_metadata=metadata
        )

    def get_comment_metadata(self):
        """Yield markdown comments to send hidden metadata in the response"""
        metadata = {
            "metadata": {
                "search_parameters": self.search_parameters,
                "search_results": self.search_results,
                "system_prompt": self.instructions,
            }
        }
        return json.dumps(metadata)
