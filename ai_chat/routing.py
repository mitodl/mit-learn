from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    # other websocket URLs here
    re_path(
        r"ws/chat_agent/", consumers.RecommendationConsumer.as_asgi(), name="chat_agent"
    ),
]
