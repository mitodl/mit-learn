"""apps for channels"""

from django.apps import AppConfig


class ChannelsConfig(AppConfig):
    """Config for Channels"""

    name = "channels"

    def ready(self):
        """Ready handler."""
        from channels import schema  # noqa: F401
