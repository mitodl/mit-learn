from django.apps import AppConfig
from pluggy import HookimplMarker, HookspecMarker


class ArticlesConfig(AppConfig):
    """Articles AppConfig"""

    name = "articles"

    hookimpl = HookimplMarker(name)
    hookspec = HookspecMarker(name)
