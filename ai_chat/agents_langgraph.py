"""Agent service classes for the AI chatbots"""

import json
import logging
from abc import ABC, abstractmethod
from collections.abc import Generator
from typing import Optional
from uuid import uuid4

import posthog
from django.conf import settings
from django.utils.module_loading import import_string
from langchain_core.messages import SystemMessage, ToolMessage
from langchain_core.messages.ai import AIMessageChunk
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph
from langgraph.graph.graph import CompiledGraph
from langgraph.prebuilt import ToolNode, tools_condition
from openai import BadRequestError

from ai_chat import tools
from ai_chat.constants import AgentState, AIModelAPI
from ai_chat.utils import get_postgres_saver
from learning_resources.constants import OfferedBy

log = logging.getLogger(__name__)

DEFAULT_TEMPERATURE = 0.1


"""
Use postgres to save memory persistently by thread if configured,
otherwise use temporary memory.  Reccomend not using the postgres
saver until we have a Django ORM-friendly alternate implementation.
"""
CHAT_MEMORY = get_postgres_saver() if settings.AI_PERSISTENT_MEMORY else MemorySaver()


class BaseLangGraphAgent(ABC):
    """
    Base service class for an AI chat agent
    """

    INSTRUCTIONS = "Provide instructions for the AI assistant"

    # For LiteLLM tracking purposes
    JOB_ID = "BASECHAT_JOB"
    TASK_NAME = "BASECHAT_TASK"

    def __init__(  # noqa: PLR0913
        self,
        name: str,
        *,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        instructions: Optional[str] = None,
        user_id: Optional[str] = None,
        thread_id: Optional[str] = None,
        save_history: Optional[bool] = False,
    ):
        """Initialize the AI chat agent service"""
        self.assistant_name = name
        self.ai = settings.AI_MODEL_API
        self.model = model or settings.AI_MODEL
        self.save_history = save_history
        self.temperature = temperature or DEFAULT_TEMPERATURE
        self.instructions = instructions or self.INSTRUCTIONS
        self.user_id = user_id
        self.config = {"configurable": {"thread_id": thread_id or uuid4().hex}}
        self.memory = CHAT_MEMORY  # retain chat history
        if settings.AI_PROXY_CLASS:
            self.proxy = import_string(f"ai_chat.proxy.{settings.AI_PROXY_CLASS}")()
        else:
            self.proxy = None
        self.agent = None

    def modify_messages(self, messages: list):
        """Template for messages, including the system prompt"""
        return ChatPromptTemplate.from_messages(
            [
                ("system", self.INSTRUCTIONS),
                ("placeholder", "{messages}"),
            ]
        ).invoke({"messages": messages})

    def create_tools(self):
        """Create any tools required by the agent"""
        return []

    def get_llm(self, **kwargs):
        if self.ai == AIModelAPI.openai.value:
            llm = ChatOpenAI(
                model=self.model,
                **(self.proxy.get_api_kwargs() if self.proxy else {}),
                **(self.proxy.get_additional_kwargs(self) if self.proxy else {}),
                **kwargs,
            )
            if self.temperature:
                llm.temperature = self.temperature
            self.llm = llm
            return llm
        else:
            raise NotImplementedError

    def create_agent(self) -> CompiledGraph:
        """Create a graph for the relevant LLM and tools"""

        tools = self.create_tools()
        llm = self.get_llm()
        if tools:
            llm = llm.bind_tools(tools)

        def get_chatbot(state: AgentState) -> dict:
            """Set up the chatbot with initial prompt"""
            if len(state["messages"]) == 1:
                state["messages"].insert(0, SystemMessage(self.INSTRUCTIONS))
            return {"messages": [llm.invoke(state["messages"])]}

        graph_builder = StateGraph(AgentState)
        graph_builder.add_node("chatbot", get_chatbot)
        if tools:
            graph_builder.add_node("tools", ToolNode(tools=tools))

        graph_builder.add_conditional_edges(
            "chatbot",
            tools_condition,
        )
        graph_builder.add_edge("tools", "chatbot")
        graph_builder.set_entry_point("chatbot")

        return graph_builder.compile(checkpointer=self.memory)

    @abstractmethod
    def get_comment_metadata(self):
        """Yield markdown comments to send hidden metdata in the response"""

    def get_completion(
        self, message: str, *, debug: bool = settings.AI_DEBUG
    ) -> Generator[str, None, None]:
        """
        Send the user message to the agent and yield the response as
        it comes in.

        Append the response with debugging metadata and/or errors.
        """
        full_response = ""
        if not self.agent:
            error = "Create agent before running"
            raise ValueError(error)
        try:
            response_generator = self.agent.stream(
                {"messages": [{"role": "user", "content": message}]},
                self.config,
                stream_mode="messages",
            )
            for chunk in response_generator:
                if isinstance(chunk[0], AIMessageChunk):
                    full_response += chunk[0].content
                    yield chunk[0].content
        except BadRequestError as error:
            # Format and yield an error message inside a hidden comment
            if hasattr(error, "response"):
                error = error.response.json()
            else:
                error = {
                    "error": {"message": "An error has occurred, please try again"}
                }
            if (
                error["error"]["message"].startswith("Budget has been exceeded")
                and not settings.AI_DEBUG
            ):  # Friendlier message for end user
                error["error"]["message"] = (
                    "You have exceeded your AI usage limit. Please try again later."
                )
            yield f"<!-- {json.dumps(error)} -->".encode()
        except Exception:
            yield '<!-- {"error":{"message":"An error occurred, please try again"}} -->'
            log.exception("Error running AI agent")
        if debug:
            yield f"\n\n<!-- {self.get_comment_metadata()} -->\n\n".encode()
        if settings.POSTHOG_PROJECT_API_KEY:
            hog_client = posthog.Posthog(
                settings.POSTHOG_PROJECT_API_KEY, host=settings.POSTHOG_API_HOST
            )
            hog_client.capture(
                self.user_id,
                event=self.JOB_ID,
                properties={
                    "question": message,
                    "answer": full_response,
                    "metadata": self.get_comment_metadata(),
                    "user": self.user_id,
                },
            )


class SearchLangGraphAgent(BaseLangGraphAgent):
    """Service class for the AI search function agent"""

    JOB_ID = "recommendation_agent"
    TASK_NAME = "recommendation_task"

    INSTRUCTIONS = f"""You are an assistant helping users find courses from a catalog
of learning resources. Users can ask about specific topics, levels, or recommendations
based on their interests or goals.

Your job:
1. Understand the user's intent AND BACKGROUND based on their message.
2. Use the available function to gather information or recommend courses.
3. Provide a clear, user-friendly explanation of your recommendations if search results
are found.


Run the tool to find learning resources that the user is interested in,
and answer only based on the function search
results. VERY IMPORTANT: NEVER USE ANY INFORMATION OUTSIDE OF THE MIT SEARCH RESULTS TO
ANSWER QUESTIONS.  If no results are returned, say you could not find any relevant
resources.  Don't say you're going to try again.  Ask the user if they would like to
modify their preferences or ask a different question.

Here are some guidelines on when to use the possible filters in the search function:

q: The area of interest requested by the user.  NEVER INCLUDE WORDS SUCH AS "advanced"
or "introductory" IN THIS PARAMETER! If the user asks for introductory, intermediate,
or advanced courses, do not include that in the search query, but examine the search
results to determine which most closely match the user's desired education level and/or
their educational background (if either is provided) and choose those results to return
to the user.  If the user asks what other courses are taught by a particular instructor,
search the catalog for courses taught by that instructor using the instructor's name
as the value for this parameter.

offered_by: If a user asks for resources "offered by" or "from" an institution,
you should include this parameter based on the following
dictionary: {OfferedBy.as_dict()}  DO NOT USE THE offered_by FILTER OTHERWISE.

certification: true if the user is interested in resources that offer certificates,
false if the user does not want resources with a certificate offered.  Do not use
this filter if the user does not indicate a preference.

free: true if the user is interested in free resources, false if the user is only
interested in paid resources. Do not used this filter if the user does not indicate
a preference.

resource_type: If the user mentions courses, programs, videos, or podcasts in
particular, filter the search by this parameter.  DO NOT USE THE resource_type FILTER
OTHERWISE. You MUST combine multiple resource types in one request like this:
"resource_type=course&resource_type=program". Do not attempt more than one query per
user message. If the user asks for podcasts, filter by both "podcast" and
"podcast_episode".

Respond in this format:
- If the user's intent is unclear, ask clarifying questions about users preference on
price, certificate
- Understand user background from the message history, like their level of education.
- After the function executes, rerank results based on user background and recommend
1 or 2 courses to the user
- Make the title of each resource a clickable link.

VERY IMPORTANT: NEVER USE ANY INFORMATION OUTSIDE OF THE MIT SEARCH RESULTS TO ANSWER
QUESTIONS.

Here are some sample user prompts, each with a guide on how to respond to them:

Prompt: “I\'d like to learn some advanced mathematics that I may not have had exposure
to before, as a physics major.”
Expected Response: Ask some follow-ups about particular interests (e.g., set theory,
analysis, topology. Maybe ask whether you are more interested in applied math or theory.
Then perform the search based on those interests and send the most relevant results back
based on the user's answers.

Prompt: “As someone with a non-science background, what courses can I take that will
prepare me for the AI future.”
Expected Output: Maybe ask whether the user wants to learn how to program, or just use
AI in their discipline - does this person want to study machine learning? More info
needed. Then perform a relevant search and send back the best results.

And here are some recommended search parameters to apply for sample user prompts:

User: "I am interested in learning advanced AI techniques"
Search parameters: {{"q": "AI techniques"}}

User: "I am curious about AI applications for business"
Search parameters: {{"q": "AI business"}}

User: "I want free basic courses about climate change from OpenCourseware"
Search parameters: {{"q": "climate change", "free": true, "resource_type": ["course"],
"offered_by": "ocw"}}

User: "I want to learn some advanced mathematics"
Search parameters: {{"q": "mathematics"}}
    """

    def __init__(  # noqa: PLR0913
        self,
        name: str,
        *,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        instructions: Optional[str] = None,
        user_id: Optional[str] = None,
        thread_id: Optional[str] = None,
        save_history: Optional[bool] = False,
    ):
        """Initialize the AI search agent service"""
        super().__init__(
            name,
            model=model or settings.AI_MODEL,
            temperature=temperature,
            instructions=instructions,
            save_history=save_history,
            user_id=user_id,
            thread_id=thread_id,
        )
        self.search_parameters = []
        self.search_results = []
        self.agent = self.create_agent()

    def create_tools(self):
        """Create tools required by the agent"""
        return [tools.search_courses]

    def get_comment_metadata(self) -> str:
        """
        Yield markdown comments to send hidden metadata in the response
        """
        thread_id = self.config["configurable"]["thread_id"]
        metadata = {"thread_id": thread_id}
        state = list(self.agent.get_state_history(self.config))
        if state:
            tool_messages = [
                t
                for t in state[0].values.get("messages", [])
                if t.__class__ == ToolMessage
            ]
            if tool_messages:
                content = json.loads(tool_messages[-1].content or {})
                metadata = {
                    "metadata": {
                        "search_parameters": content.get("metadata", {}).get(
                            "parameters", []
                        ),
                        "search_results": content.get("results", []),
                        "thread_id": thread_id,
                    }
                }
        return json.dumps(metadata)
