from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    # other websocket URLs here
    re_path(
        r"ws/recommendation_agent/",
        consumers.RecommendationAgentConsumer.as_asgi(),
        name="recommendation_agent",
    ),
]
