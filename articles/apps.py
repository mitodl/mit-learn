from django.apps import AppConfig
from pluggy import HookimplMarker, HookspecMarker


class ArticlesConfig(AppConfig):
    """Articles AppConfig"""

    name = "articles"

    hookimpl = HookimplMarker(name)
    hookspec = HookspecMarker(name)

    def ready(self):
        """Import signals when the app is ready"""
        import articles.signals  # noqa: F401
