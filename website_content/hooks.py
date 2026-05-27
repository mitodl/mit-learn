"""Pluggy hooks for website_content"""

import logging

import pluggy
from django.apps import apps
from django.conf import settings
from django.utils.module_loading import import_string

log = logging.getLogger(__name__)

app_config = apps.get_app_config("website_content")
hookspec = app_config.hookspec


class WebsiteContentHooks:
    """Pluggy hook specs for website_content"""

    @hookspec
    def website_content_published(self, content):
        """Trigger actions after a content item is published or updated"""


def get_plugin_manager():
    """Return the plugin manager for website_content hooks"""
    pm = pluggy.PluginManager(app_config.name)
    pm.add_hookspecs(WebsiteContentHooks)
    for module in settings.MITOL_WEBSITE_CONTENT_PLUGINS.split(","):
        if module:
            plugin_cls = import_string(module)
            pm.register(plugin_cls())

    return pm
