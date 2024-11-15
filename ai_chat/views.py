import logging

import markdown2
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import views
from rest_framework.response import Response

from ai_chat import serializers
from ai_chat.assistant import AssistantService
from ai_chat.serializers import ChatResponseSerializer

log = logging.getLogger(__name__)


@extend_schema_view(
    post=extend_schema(
        parameters=[serializers.ChatRequestSerializer()],
        responses=serializers.ChatResponseSerializer(),
    ),
)
class ChatbotView(views.APIView):
    """DRF view for chatbot"""

    http_method_names = ["post"]
    serializer_class = serializers.ChatRequestSerializer

    def post(self, request):
        serializer = serializers.ChatRequestSerializer(data=request.data)
        serializer.is_valid()
        assistant_service = AssistantService(request)
        assistant_response = assistant_service.run_assistant(serializer.data["message"])
        response_serializer = ChatResponseSerializer(
            data={"ai_response": markdown2.markdown(assistant_response)}
        )
        response_serializer.is_valid()
        return Response(response_serializer.data)
