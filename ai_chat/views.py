import logging

import markdown2
from django.http import StreamingHttpResponse
from rest_framework import views
from rest_framework.response import Response

from ai_chat import serializers
from ai_chat.agent import FunctionAgentService
from ai_chat.assistant import AssistantService

log = logging.getLogger(__name__)


class ChatbotAssistantView(views.APIView):
    """DRF view for chatbot using OpenAI Assistant API"""

    http_method_names = ["post"]
    serializer_class = serializers.ChatRequestSerializer

    def post(self, request):
        serializer = serializers.ChatRequestSerializer(data=request.data)
        serializer.is_valid()
        assistant_service = AssistantService(request)
        assistant_response = assistant_service.run_assistant(serializer.data["message"])
        return Response({"ai_response": markdown2.markdown(assistant_response)})


class ChatbotAgentView(views.APIView):
    """DRF view for chatbot function-calling agent using LlamaIndex"""

    http_method_names = ["post"]
    serializer_class = serializers.ChatRequestSerializer
    permission_classes = ()

    def post(self, request):
        serializer = serializers.ChatRequestSerializer(data=request.data)
        serializer.is_valid()

        assistant_service = FunctionAgentService(request)
        return StreamingHttpResponse(
            assistant_service.run_agent(serializer.data["message"]),
            content_type="text/event-stream",
        )
