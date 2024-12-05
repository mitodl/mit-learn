"""DRF views for the ai_chat app."""

import logging

from django.http import StreamingHttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import views
from rest_framework.request import Request

from ai_chat import serializers
from ai_chat.agents import SearchAgentService
from ai_chat.permissions import SearchAgentPermissions

log = logging.getLogger(__name__)


class SearchAgentView(views.APIView):
    """
    DRF view for an AI agent that answers user queries
    by performing a relevant learning resources search.
    """

    http_method_names = ["post"]
    serializer_class = serializers.ChatRequestSerializer
    permission_classes = (SearchAgentPermissions,)  # Add IsAuthenticated

    @extend_schema(
        responses={
            (200, "text/event-stream"): {
                "description": "Chatbot response",
                "type": "string",
            }
        }
    )
    def post(self, request: Request) -> StreamingHttpResponse:
        """Handle a POST request to the chatbot agent."""
        serializer = serializers.ChatRequestSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        if not request.session.session_key:
            request.session.save()
        cache_id = (
            request.user.email
            if request.user.is_authenticated
            else request.session.session_key
        )
        # Make anonymous users share a common LiteLLM budget/rate limit.
        user_id = request.user.email if request.user.is_authenticated else "anonymous"
        message = serializer.validated_data.pop("message", "")
        clear_history = serializer.validated_data.pop("clear_history", False)
        agent_service = SearchAgentService(
            "Learning Resource Search AI Assistant",
            user_id=user_id,
            cache_key=f"{cache_id}_search_chat_history",
            save_history=True,
            **serializer.validated_data,
        )
        if clear_history:
            agent_service.clear_chat_history()
        return StreamingHttpResponse(
            agent_service.run_streaming_agent(message),
            content_type="text/event-stream",
            headers={"X-Accel-Buffering": "no"},
        )
