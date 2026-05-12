from django.apps import AppConfig
from pluggy import HookimplMarker, HookspecMarker


class WebsiteContentConfig(AppConfig):
    """WebsiteContent AppConfig"""

    name = "website_content"

    hookimpl = HookimplMarker(name)
    hookspec = HookspecMarker(name)

    def ready(self):
        """Import tasks when the app is ready"""
        import website_content.tasks  # noqa: F401
