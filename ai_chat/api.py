import json
import logging
import os
from typing import override

import requests
from openai import AssistantEventHandler, OpenAI

from learning_resources.constants import OfferedBy

log = logging.getLogger(__name__)


def search_courses(q: str, **kwargs) -> dict:
    """Query the MIT API for courses"""
    params = {"q": q}

    valid_params = {
        "level": kwargs.get("level"),
        "resource_type": kwargs.get("resource_type"),
        "free": kwargs.get("free"),
        "offered_by": kwargs.get("offered_by"),
        "limit": kwargs.get("limit"),
    }
    log.info(f"Valid params: {valid_params}")
    params.update({k: v for k, v in valid_params.items() if v is not None})
    url = "https://api.learn.mit.edu/api/v1/learning_resources_search/"
    log.info(f"Querying MIT API with parameters: {params}")
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        log.info(f"Error querying MIT API: {e}")
        return {"error": str(e)}


def initiate_chat(*, stream: bool = False):
    # Initialize the bot
    openai_api_key = os.getenv("OPENAI_API_KEY")
    bot = CourseRecommendationBot(openai_api_key)
    bot.setup_assistant()

    log.info("Resource Recommendation Chatbot initialized. Type 'quit' to exit.")

    while True:
        user_input = input("\nWhat kind of resources are you interested in? ")

        if user_input.lower() == "quit":
            break

        if stream:
            bot.get_streaming_recommendations(user_input)
        else:
            response = bot.get_course_recommendations(user_input)
            log.info(f"\nAssistant: {response}")


class CourseRecommendationBot:
    def __init__(self, openai_api_key: str):
        self.client = OpenAI(api_key=openai_api_key)
        self.assistant = None
        self.thread = None

    def setup_assistant(self) -> None:
        """Create an OpenAI Assistant with specific instructions for course recommendations"""

        self.assistant = self.client.beta.assistants.create(
            name="Resource Recommendation Assistant",
            instructions=f"""You are a helpful MIT learning resource recommendation assistant.
            When users ask about learning resources, use the provided functions to search the MIT catalog
            and provide relevant recommendations based on their interests and requirements.

            If a user asks for resources "offered by" or "from" an institution, you should include the offered_by
            parameter based on the following dictionary: {OfferedBy.as_dict()}

            If the user mentions courses, programs, videos, or podcasts, filter the search by resource_category.

            Always explain your reasoning for recommending specific resources.

            Always answer questions only based on searching the MIT catalog.  Do not use any other information.
            """,
            model="gpt-4o",
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "search_courses",
                        "description": "Search for learning resources in the MIT catalog",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "q": {
                                    "type": "string",
                                    "description": "Search query for courses",
                                },
                                "resource_type": {
                                    "type": "string",
                                    "description": "Type of resource",
                                    "enum": [
                                        "course",
                                        "program",
                                        "video",
                                        "podcast_episode",
                                    ],
                                    "optional": True,
                                },
                                "level": {
                                    "type": "string",
                                    "description": "Level of the resource",
                                    "enum": [
                                        "introductory",
                                        "intermediate",
                                        "advanced",
                                    ],
                                    "optional": True,
                                },
                                "free": {
                                    "type": "boolean",
                                    "description": "Whether the resource is free",
                                    "optional": True,
                                },
                                "offered_by": {
                                    "type": "string",
                                    "description": "Institution offering the resource",
                                    "enum": OfferedBy.names(),
                                    "optional": True,
                                },
                                "limit": {
                                    "type": "integer",
                                    "description": "Maximum number of results to return",
                                    "optional": True,
                                },
                            },
                            "required": ["q"],
                        },
                    },
                }
            ],
        )

    def create_thread(self) -> None:
        """Create a new conversation thread"""
        self.thread = self.client.beta.threads.create()

    def get_course_recommendations(self, user_query: str) -> str:
        """Process user query and return course recommendations"""
        if not self.thread:
            self.create_thread()

        # Add the user's message to the thread
        self.client.beta.threads.messages.create(
            thread_id=self.thread.id, role="user", content=user_query
        )

        # Run the assistant
        run = self.client.beta.threads.runs.create(
            thread_id=self.thread.id, assistant_id=self.assistant.id
        )

        # Wait for the run to complete and handle tool calls
        while True:
            run_status = self.client.beta.threads.runs.retrieve(
                thread_id=self.thread.id, run_id=run.id
            )

            if run_status.status == "completed":
                break
            elif run_status.status == "requires_action":
                tool_calls = run_status.required_action.submit_tool_outputs.tool_calls
                tool_outputs = []

                for tool_call in tool_calls:
                    if tool_call.function.name == "search_courses":
                        log.info(f"Arguments: {tool_call.function.arguments}")
                        arguments = json.loads(tool_call.function.arguments)
                        query = arguments.pop("q")
                        results = search_courses(query, **arguments)
                        tool_outputs.append(
                            {
                                "tool_call_id": tool_call.id,
                                "output": json.dumps(results),
                            }
                        )

                # Submit tool outputs back to the assistant
                self.client.beta.threads.runs.submit_tool_outputs(
                    thread_id=self.thread.id, run_id=run.id, tool_outputs=tool_outputs
                )
            elif run_status.status == "failed":
                return "Sorry, I encountered an error while processing your request."

        # Get the assistant's response
        messages = self.client.beta.threads.messages.list(thread_id=self.thread.id)

        # Return the latest assistant message
        for message in messages.data:
            if message.role == "assistant":
                return message.content[0].text.value

        return "No response generated."

    def get_streaming_recommendations(self, user_query: str) -> str:
        if not self.thread:
            self.create_thread()
        self.client.beta.threads.messages.create(
            thread_id=self.thread.id, role="user", content=user_query
        )
        with self.client.beta.threads.runs.stream(
            thread_id=self.thread.id,
            assistant_id=self.assistant.id,
            event_handler=EventHandler(self.client),
        ) as stream:
            stream.until_done()


class EventHandler(AssistantEventHandler):
    def __init__(self, client):
        super().__init__()
        self.client = client

    @override
    def on_event(self, event):
        # Retrieve events that are denoted with 'requires_action'
        # since these will have our tool_calls
        if event.event == "thread.run.requires_action":
            run_id = event.data.id  # Retrieve the run ID from the event data
            self.handle_requires_action(event.data, run_id)

    def handle_requires_action(self, data, run_id):
        tool_outputs = []

        for tool in data.required_action.submit_tool_outputs.tool_calls:
            if tool.function.name == "search_courses":
                arguments = json.loads(tool.function.arguments)
                query = arguments.pop("q")
                results = search_courses(query, **arguments)
                tool_outputs.append(
                    {"tool_call_id": tool.id, "output": json.dumps(results)}
                )

        # Submit all tool_outputs at the same time
        self.submit_tool_outputs(tool_outputs, run_id)

    def submit_tool_outputs(self, tool_outputs, run_id):
        # Use the submit_tool_outputs_stream helper
        with self.client.beta.threads.runs.submit_tool_outputs_stream(
            thread_id=self.current_run.thread_id,
            run_id=self.current_run.id,
            tool_outputs=tool_outputs,
            event_handler=EventHandler(self.client),
        ) as stream:
            for text in stream.text_deltas:
                log.info(text, end="", flush=True)
                # log.info(f"Flushed?: {text}")
                # yield text
