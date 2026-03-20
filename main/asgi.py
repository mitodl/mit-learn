import os

from django.core.asgi import get_asgi_application

# Set the default settings module for the 'asgi' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "main.settings")

# This is the ASGI application callable used by the server.
application = get_asgi_application()
