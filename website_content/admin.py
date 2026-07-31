"""Admin configuration for website_content app."""

from django.contrib import admin
from safedelete.admin import SafeDeleteAdmin, SafeDeleteAdminFilter, highlight_deleted

from website_content.models import WebsiteContent, WebsiteContentImageUpload


@admin.register(WebsiteContent)
class WebsiteContentAdmin(SafeDeleteAdmin):
    """
    Admin for WebsiteContent.

    Soft-deleted rows stay visible here (struck through) so staff can undelete
    them, unlike the API where the default manager hides them.
    """

    # highlight_deleted strikes through this field for soft-deleted rows.
    field_to_highlight = "title"

    list_display = (
        highlight_deleted,
        "content_type",
        "is_published",
        "publish_date",
        "user",
        "created_on",
        *SafeDeleteAdmin.list_display,
    )
    list_filter = (
        "content_type",
        "is_published",
        SafeDeleteAdminFilter,
        *SafeDeleteAdmin.list_filter,
    )
    search_fields = ("title", "slug", "author_name")
    readonly_fields = ("slug", "cover_image", "created_on", "updated_on")
    list_select_related = ("user",)
    # Avoid rendering every user in a <select> on the change form, which times
    # out in production. Uses an AJAX search widget instead.
    autocomplete_fields = ("user",)
    ordering = ("-created_on",)


@admin.register(WebsiteContentImageUpload)
class WebsiteContentImageUploadAdmin(admin.ModelAdmin):
    """Admin for WebsiteContentImageUpload."""

    list_display = ("user", "created_at")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    ordering = ("-created_at",)
