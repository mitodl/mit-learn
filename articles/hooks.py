"""Pluggy hooks for articles"""

import logging

import pluggy
from django.apps import apps
from django.conf import settings
from django.utils.module_loading import import_string

log = logging.getLogger(__name__)

app_config = apps.get_app_config("articles")
hookspec = app_config.hookspec


class ArticlesHooks:
    """Pluggy hook specs for articles"""

    @hookspec
    def article_published(self, article):
        """Trigger actions after an article is published or updated"""


def get_plugin_manager():
    """Return the plugin manager for articles hooks"""
    pm = pluggy.PluginManager(app_config.name)
    pm.add_hookspecs(ArticlesHooks)
    for module in settings.MITOL_ARTICLES_PLUGINS.split(","):
        if module:
            plugin_cls = import_string(module)
            pm.register(plugin_cls())

    return pm
