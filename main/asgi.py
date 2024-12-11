import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

import ai_chat.routing

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "main.settings_ai")

application = ProtocolTypeRouter(
    {
        "http": get_asgi_application(),
        "websocket": AuthMiddlewareStack(
            URLRouter(ai_chat.routing.websocket_urlpatterns)
        ),
    }
)
