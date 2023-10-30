"""Pluggy hooks for learning_resources"""
import logging

import pluggy
from django.apps import apps
from django.conf import settings
from django.utils.module_loading import import_string

log = logging.getLogger(__name__)

app_config = apps.get_app_config("learning_resources")
hookspec = app_config.hookspec


class LearningResourceHooks:
    """Pluggy hooks specs for authentication"""

    @hookspec
    def resource_upserted(self, resource):
        """Trigger actions after a learning resource is created or updated"""

    @hookspec
    def resource_removed(self, resource):
        """Trigger actions after a learning resource is unpublished or removed"""


def get_plugin_manager():
    """Return the plugin manager for authentication hooks"""
    pm = pluggy.PluginManager(app_config.name)
    pm.add_hookspecs(LearningResourceHooks)
    for module in settings.MITOPEN_LEARNING_RESOURCES_PLUGINS.split(","):
        if module:
            plugin_cls = import_string(module)
            pm.register(plugin_cls())

    return pm
