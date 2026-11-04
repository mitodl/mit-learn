"""Admin for channels"""

import logging

from django.contrib import admin
from django.db import transaction
from django.utils.html import format_html

from channels.api import clear_featured_caches, purge_channel_pages
from channels.models import Channel
from main.utils import clear_views_cache

log = logging.getLogger(__name__)


def _url_fields(channel):
    """Return the fields a channel's `channel_url` is built from"""
    return (channel.channel_type, channel.name, channel.published)


def _clear_channel_caches_on_commit(urls, *, url_changed, featured_changed=False):
    """
    After commit, clear cached responses for an admin channel write and purge
    the channels' pages from Fastly; best-effort, never raises.

    `urls` are the `channel_url`s to purge. Nothing else clears the channel
    responses or pages on a write, so without this an editor's change waits
    out both caches.

    `url_changed` means a channel's `channel_url` appeared, moved or went
    away. Topics, offerors and departments carry that URL into most cached
    responses, learning resources included, so only a full clear reaches them
    all. Search results are read from the index, so they keep the old URL
    until the resources are reindexed.

    `featured_changed` means a channel's featured list changed, which the
    featured rows and the homepage show.
    """

    def _clear():
        try:
            clear_views_cache(key_prefix=None if url_changed else "channels")
        except Exception:
            log.exception("Failed to clear channel view caches for %s", urls)
        try:
            # A full clear already covers the featured rows, so only the page
            # purges are left to do.
            if featured_changed and not url_changed:
                clear_featured_caches(urls)
            else:
                purge_channel_pages(urls, homepage=url_changed)
        except Exception:
            log.exception("Failed to purge channel pages for %s", urls)

    transaction.on_commit(_clear)


class ChannelAdmin(admin.ModelAdmin):
    """Channel admin model"""

    def save_model(self, request, obj, form, change):
        """Save the channel, then clear its cached responses."""
        before = Channel.objects.filter(pk=obj.pk).first() if change else None
        super().save_model(request, obj, form, change)
        # Both URLs: a rename leaves the old page cached under the old path,
        # and an unpublished channel's channel_url is None.
        urls = sorted(
            {channel.channel_url for channel in (before, obj) if channel} - {None}
        )
        _clear_channel_caches_on_commit(
            urls,
            url_changed=before is None or _url_fields(before) != _url_fields(obj),
            featured_changed=before is None
            or before.featured_list_id != obj.featured_list_id,
        )

    def delete_model(self, request, obj):
        """Delete the channel, then clear its cached responses."""
        urls = [obj.channel_url] if obj.channel_url else []
        super().delete_model(request, obj)
        _clear_channel_caches_on_commit(urls, url_changed=True)

    def delete_queryset(self, request, queryset):
        """Bulk-delete channels, then clear their cached responses."""
        urls = [channel.channel_url for channel in queryset if channel.channel_url]
        super().delete_queryset(request, queryset)
        _clear_channel_caches_on_commit(urls, url_changed=True)

    def channel_widget_list(self, instance):
        """Render a link to the WidgetList admin URL"""
        return (
            format_html(
                '<a href="/admin/widgets/widgetlist/{0}/change/"'
                ' target="_blank">WidgetList {0}</a>',
                instance.widget_list.pk,
            )
            if instance.widget_list
            else "No widget"
        )

    model = Channel
    exclude = ("widget_list",)
    search_fields = ("name", "title")
    autocomplete_fields = ("featured_list",)
    list_display = ("title", "name", "channel_type")
    list_filter = ("channel_type",)
    readonly_fields = (
        "channel_widget_list",
        "updated_on",
        "created_on",
    )


admin.site.register(Channel, ChannelAdmin)
