"""Admin for channels"""

from django.contrib import admin
from django.db import transaction
from django.utils.html import format_html

from channels.api import clear_featured_caches
from channels.models import Channel
from main.utils import clear_views_cache


def _clear_channel_caches_on_commit(urls):
    """
    After commit, clear the cached channel and featured-row responses, and
    hard-purge the channels' pages and the homepage from Fastly.

    `urls` are the `channel_url`s to purge. Every write gets the same clear,
    whatever it changed. Topic, offeror and department responses also embed
    `channel_url`, so after an add, publish, unpublish or delete those cached
    copies keep the old value until they expire.

    Each callback is robust: a failure is logged, and doesn't skip the other
    or fail the admin request.
    """
    transaction.on_commit(lambda: clear_views_cache(key_prefix="channels"), robust=True)
    transaction.on_commit(lambda: clear_featured_caches(urls), robust=True)


class ChannelAdmin(admin.ModelAdmin):
    """Channel admin model"""

    def get_readonly_fields(self, request, obj=None):
        """
        Lock an existing channel's name and type. They make up its URL, which
        external links point at, so changing one needs redirects set up too.
        """
        readonly = super().get_readonly_fields(request, obj)
        return (*readonly, "name", "channel_type") if obj else readonly

    def save_model(self, request, obj, form, change):
        """Save the channel, then clear its cached responses."""
        # The URL from before the save too: unpublishing sets channel_url to
        # None, which would leave the page cached.
        before = Channel.objects.filter(pk=obj.pk).first() if change else None
        super().save_model(request, obj, form, change)
        urls = sorted(
            {channel.channel_url for channel in (before, obj) if channel} - {None}
        )
        _clear_channel_caches_on_commit(urls)

    def delete_model(self, request, obj):
        """Delete the channel, then clear its cached responses."""
        urls = [obj.channel_url] if obj.channel_url else []
        super().delete_model(request, obj)
        _clear_channel_caches_on_commit(urls)

    def delete_queryset(self, request, queryset):
        """Bulk-delete channels, then clear their cached responses."""
        urls = [channel.channel_url for channel in queryset if channel.channel_url]
        super().delete_queryset(request, queryset)
        _clear_channel_caches_on_commit(urls)

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
