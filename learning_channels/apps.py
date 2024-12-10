"""apps for channels"""

from django.apps import AppConfig


class LearningChannelsConfig(AppConfig):
    """Config for LearningChannels"""

    name = "learning_channels"

    def ready(self):
        """
        Ready handler. Import signals.
        """
        import learning_channels.signals  # noqa: F401
        from learning_channels import schema  # noqa: F401se
