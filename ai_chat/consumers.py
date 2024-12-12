import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

log = logging.getLogger(__name__)


class RecommendationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user", {}).get("username", "anonymous")
        from ai_chat.agents import SearchAgent

        self.agent = SearchAgent()
        await super().connect()

    async def receive(self, text_data):
        # our webhook handling code goes here
        from ai_chat.serializers import ChatRequestSerializer

        text_data_json = json.loads(text_data)
        serializer = ChatRequestSerializer(data=text_data_json)
        serializer.is_valid(raise_exception=True)
        message_text = serializer.validated_data.pop("message", "")
        clear_history = serializer.validated_data.pop("clear_history", False)
        temperature = serializer.validated_data.pop("temperature", None)
        instructions = serializer.validated_data.pop("instructions", None)

        if clear_history:
            self.agent.agent.chat_history.clear()
        if temperature:
            self.agent.agent.agent_worker._llm.temperature = temperature  # noqa: SLF001
        if instructions:
            self.agent.agent.agent_worker._llm.instructions = instructions  # noqa: SLF001

        # do something with the user's message
        # show user's message
        await self.send(text_data=message_text)

        for chunk in self.agent.get_completion(message_text):
            await self.send(text_data=chunk)
