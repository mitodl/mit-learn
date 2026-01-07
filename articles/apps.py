from django.apps import AppConfig


class ArticlesConfig(AppConfig):
    name = "articles"

    def ready(self):
        """Import signal handlers when the app is ready"""
        import articles.signals  # noqa: F401
