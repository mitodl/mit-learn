"""DRF views for the ai_chat app."""

import logging
from uuid import uuid4

from django.http import StreamingHttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import views
from rest_framework.request import Request

from ai_chat import serializers
from ai_chat.agents_langgraph import SearchLangGraphAgent
from ai_chat.constants import AI_THREAD_COOKIE_KEY
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
        from ai_chat.agents import SearchAgent

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
        agent = SearchAgent(
            "Learning Resource Search AI Assistant",
            user_id=user_id,
            cache_key=f"{cache_id}_search_chat_history",
            save_history=True,
            **serializer.validated_data,
        )
        if clear_history:
            agent.clear_chat_history()
        return StreamingHttpResponse(
            agent.get_completion(message),
            content_type="text/event-stream",
            headers={"X-Accel-Buffering": "no"},
        )


class SearchAgentLangGraphView(SearchAgentView):
    """
    Same as SearchAgentView but calls the langgraph-based agent
    """

    def post(self, request: Request) -> StreamingHttpResponse:
        """Handle a POST request to the chatbot agent."""

        serializer = serializers.ChatRequestSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        if not request.session.session_key:
            request.session.save()
        # Make anonymous users share a common LiteLLM budget/rate limit.
        user_id = request.user.email if request.user.is_authenticated else "anonymous"
        message = serializer.validated_data.pop("message", "")
        clear_history = serializer.validated_data.pop("clear_history", False)

        thread_id = request.COOKIES.get(AI_THREAD_COOKIE_KEY)
        if not thread_id or clear_history:
            thread_id = uuid4()

        agent = SearchLangGraphAgent(
            "Learning Resource Search AI Assistant",
            user_id=user_id,
            thread_id=thread_id,
            **serializer.validated_data,
        )
        if clear_history:
            agent.clear_chat_history()
        response = StreamingHttpResponse(
            agent.get_completion(message),
            content_type="text/event-stream",
            headers={"X-Accel-Buffering": "no"},
        )
        response.set_cookie(AI_THREAD_COOKIE_KEY, thread_id)
        return response


class SyllabusAgentView(views.APIView):
    """
    DRF view for an AI agent that answers user queries
    by performing a relevant contentfile search for a
    specified course.
    """

    http_method_names = ["post"]
    serializer_class = serializers.SyllabusChatRequestSerializer
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
        from ai_chat.agents import SyllabusAgent

        serializer = serializers.SyllabusChatRequestSerializer(
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
        readable_id = (serializer.validated_data.pop("readable_id"),)
        clear_history = serializer.validated_data.pop("clear_history", False)
        agent = SyllabusAgent(
            "Learning Resource Search AI Assistant",
            user_id=user_id,
            cache_key=f"{cache_id}_search_chat_history",
            save_history=True,
            **serializer.validated_data,
        )
        if clear_history:
            agent.clear_chat_history()
        return StreamingHttpResponse(
            agent.get_completion(message, readable_id),
            content_type="text/event-stream",
            headers={"X-Accel-Buffering": "no"},
        )
