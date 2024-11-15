import logging

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import views
from rest_framework.permissions import AllowAny

from ai_chat.api import CourseRecommendationBot

log = logging.getLogger(__name__)


class ChatbotView(views.APIView):
    """DRF view for chatbot"""

    http_method_names = ["post"]
    permission_classes = [AllowAny]

    def post(self, request, format=None):
        message = request.data.get("message", "")
        bot = CourseRecommendationBot(settings.OPENAI_API_KEY)
        bot.setup_assistant()

        def stream_response():
            for text in bot.get_streaming_recommendations(message):
                log.info(f"VIEW text: {text}")
                yield text

        return StreamingHttpResponse(
            stream_response(), content_type="text/event-stream"
        )
