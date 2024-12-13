import json
import logging

from llama_index.core.base.llms.types import ChatMessage

from channels.generic.websocket import AsyncWebsocketConsumer

log = logging.getLogger(__name__)


class RecommendationAgentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Connect to the websocket and initialize the AI agent."""
        user = self.scope.get("user", None)
        self.username = user.username if user else "anonymous"
        log.info("Username is %s", self.username)
        from ai_chat.agents import SearchAgent

        self.agent = SearchAgent()
        await super().connect()

    async def receive(self, text_data: str) -> str:
        """Send the message to the AI agent and return its response."""
        from ai_chat.serializers import ChatRequestSerializer

        try:
            text_data_json = json.loads(text_data)
            serializer = ChatRequestSerializer(data=text_data_json)
            serializer.is_valid(raise_exception=True)
            message_text = serializer.validated_data.pop("message", "")
            clear_history = serializer.validated_data.pop("clear_history", False)
            temperature = serializer.validated_data.pop("temperature", None)
            instructions = serializer.validated_data.pop("instructions", None)
            model = serializer.validated_data.pop("model", None)

            if clear_history:
                self.agent.agent.chat_history.clear()
            if model:
                self.agent.agent.agent_worker._llm.model = model  # noqa: SLF001
            if temperature:
                self.agent.agent.agent_worker._llm.temperature = temperature  # noqa: SLF001
            if instructions:
                self.agent.agent.agent_worker.prefix_messages = [
                    ChatMessage(content=instructions, role="system")
                ]

            for chunk in self.agent.get_completion(message_text):
                log.info("Sending chunk: %s", chunk)
                await self.send(text_data=chunk)
        except:  # noqa: E722
            log.exception("Error in RecommendationAgentConsumer")
        finally:
            # This is a bit hacky, but it works for now
            await self.send(text_data="!endResponse")
