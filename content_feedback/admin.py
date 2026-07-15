"""Admin configuration for content_feedback."""

from django.contrib import admin

from content_feedback.models import ContentFeedback


@admin.register(ContentFeedback)
class ContentFeedbackAdmin(admin.ModelAdmin):
    """Content feedback admin configuration (read-only)."""

    list_display = (
        "user",
        "course_id",
        "block_type",
        "block_usage_key",
        "sentiment",
        "created_on",
    )
    list_filter = ("sentiment",)
    search_fields = ("course_id", "block_usage_key", "comment")
    ordering = ("-created_on",)
    readonly_fields = (
        "user",
        "course_id",
        "course_name",
        "block_usage_key",
        "block_type",
        "block_display_name",
        "unit_title",
        "url",
        "sentiment",
        "comment",
        "created_on",
        "updated_on",
    )

    def has_add_permission(self, request):  # noqa: ARG002
        """Disallow creating records in the admin; they come only via the API."""
        return False

    def has_delete_permission(self, request, obj=None):  # noqa: ARG002
        """Feedback records are not deletable from the admin."""
        return False
