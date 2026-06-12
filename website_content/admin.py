"""Admin configuration for website_content app."""

from django.contrib import admin

from website_content.models import WebsiteContent, WebsiteContentImageUpload


@admin.register(WebsiteContent)
class WebsiteContentAdmin(admin.ModelAdmin):
    """Admin for WebsiteContent."""

    list_display = (
        "title",
        "content_type",
        "is_published",
        "publish_date",
        "user",
        "created_on",
    )
    list_filter = ("content_type", "is_published")
    search_fields = ("title", "slug", "author_name")
    readonly_fields = ("slug", "cover_image", "created_on", "updated_on")
    list_select_related = ("user",)
    ordering = ("-created_on",)


@admin.register(WebsiteContentImageUpload)
class WebsiteContentImageUploadAdmin(admin.ModelAdmin):
    """Admin for WebsiteContentImageUpload."""

    list_display = ("user", "created_at")
    list_select_related = ("user",)
    ordering = ("-created_at",)
