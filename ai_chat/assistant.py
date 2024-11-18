import json
import logging
import time

import requests
from django.conf import settings
from openai import OpenAI

from learning_resources.constants import OfferedBy

INSTRUCTIONS = f"""You are a helpful MIT learning resource recommendation
assistant. When users ask about learning resources, use the provided functions
to search the MIT catalog and provide relevant recommendations based on their
interests and requirements. If the user asks subsequent questions
about those results, answer using the information provided in that response.

If a user asks for resources "offered by" or "from" an institution,
you should include the offered_by parameter based on the following
dictionary: {OfferedBy.as_dict()}

If the user mentions courses, programs, videos, or podcasts, filter
the search by resource_category.

Always explain your reasoning for recommending specific resources.

Always answer questions only based on searching the MIT catalog.
Do not use any other information.
"""

log = logging.getLogger(__name__)

ASSISTANT_TOOLS = [
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
]


class AssistantService:
    """Service class for the AI assistant"""

    def __init__(self, request):
        self.openAI = OpenAI(api_key=settings.OPENAI_API_KEY)

        self.assistant_name = "Learning Resource AI Assistant"
        self.model_id = "gpt-4o"
        self.instruction = INSTRUCTIONS
        self.request = request
        self.session = request.session
        self.assistant = self.get_or_create_assistant()
        self.thread = self.get_or_create_thread()

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
        url = "https://api.learn.mit.edu/api/v1/learning_resources_search/"
        log.info("Querying MIT API with parameters: %s", json.dumps(params))
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            results = []
            main_properties = [
                "title",
                "url",
                "description",
                "offered_by",
                "free",
                "resource_type",
            ]
            results = {
                k: result.get(k)
                for k in main_properties
                for result in response.json().get("results", [])
            }
            return json.dumps(results)
        except requests.exceptions.RequestException as e:
            log.exception("Error querying MIT API")
            return json.dumps({"error": str(e)})

    def get_or_create_assistant(self):
        """Get or create the assistant for this particular user session"""
        if "assistant_id" in self.session:
            log.info("Getting assistant")
            return self.openAI.beta.assistants.retrieve(self.session["assistant_id"])
        else:
            log.info("Creating assistant")
            assistant = self.create_assistant()
            self.session["assistant_id"] = assistant.id
            return assistant

    def get_or_create_thread(self):
        """Get or create the thread for this particular user session"""
        if "thread_id" in self.session:
            log.info("Getting thread")
            return self.openAI.beta.threads.retrieve(self.session["thread_id"])
        else:
            log.info("Creating thread")
            thread = self.create_thread()
            self.session["thread_id"] = thread.id
            return thread

    def create_assistant(self):
        """Create the AI assistant for this user session"""
        return self.openAI.beta.assistants.create(
            name=self.assistant_name,
            instructions=self.instruction,
            model=self.model_id,
            tools=ASSISTANT_TOOLS,
        )

    def create_thread(self):
        """Create a new conversation thread"""
        return self.openAI.beta.threads.create()

    def add_message_to_thread(self, role, message):
        """Add a message to the conversation thread"""
        return self.openAI.beta.threads.messages.create(
            thread_id=self.thread.id,
            role=role,
            content=message,
        )

    def run_assistant(self, message):
        """Run the AI assistant with the provided user message"""
        message = self.add_message_to_thread("user", message)
        action_response = None

        run = self.openAI.beta.threads.runs.create(
            thread_id=self.thread.id,
            assistant_id=self.assistant.id,
        )
        run = self.wait_for_update(run)

        if run.status == "failed":
            log.info("Run failed")
            return None
        elif run.status == "requires_action":
            log.info("Run requires action")
            action_response = self.handle_require_action(run)
        else:
            log.info("Run completed")
            action_response = self.get_last_assistant_message()

        return action_response

    def handle_require_action(self, run):
        """Handle the required action from the AI assistant"""
        # Get the tool outputs by executing the required functions
        tool_calls = run.required_action.submit_tool_outputs.tool_calls
        log.info(tool_calls)
        tool_outputs = self.generate_tool_outputs(tool_calls)

        # Submit the tool outputs back to the Assistant
        run = self.openAI.beta.threads.runs.submit_tool_outputs(
            thread_id=self.thread.id, run_id=run.id, tool_outputs=tool_outputs
        )

        run = self.wait_for_update(run)

        if run.status == "failed":
            log.info("Run failed")
            return None
        elif run.status == "completed":
            return self.get_last_assistant_message()
        return None

    def wait_for_update(self, run):
        """Wait for the run to complete"""
        while run.status in ("queued", "in_progress"):
            run = self.openAI.beta.threads.runs.retrieve(
                thread_id=self.thread.id,
                run_id=run.id,
            )
            time.sleep(1)
            log.info(run.status)

        return run

    def get_last_assistant_message(self):
        """Return the last message from the AI assistant in the conversation"""
        messages = self.openAI.beta.threads.messages.list(thread_id=self.thread.id)
        if messages.data[0].role == "assistant":
            message = messages.data[0]
            for content_block in message.content:
                if content_block.type == "text":
                    return content_block.text.value
        return None

    def generate_tool_outputs(self, tool_calls):
        """
        Call the AI Assistant tool functions (ie search_courses) and return outputs
        """
        tool_outputs = []

        for tool_call in tool_calls:
            function_name = tool_call.function.name
            arguments = tool_call.function.arguments
            tool_call_id = tool_call.id

            args_dict = json.loads(arguments)

            if hasattr(self, function_name):
                function_to_call = getattr(self, function_name)
                output = function_to_call(**args_dict)

                tool_outputs.append(
                    {
                        "tool_call_id": tool_call_id,
                        "output": output,
                    }
                )

        return tool_outputs
