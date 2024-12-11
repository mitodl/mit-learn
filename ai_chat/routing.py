from django.urls import path

from . import consumers

websocket_urlpatterns = [
    # other websocket URLs here
    path(r"ws/chat_agent/", consumers.ChatConsumer.as_asgi(), name="chat_agent"),
]
