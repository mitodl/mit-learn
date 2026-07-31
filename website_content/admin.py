"""Admin configuration for website_content app."""

from django.contrib import admin, messages
from django.contrib.admin.utils import unquote
from safedelete.admin import SafeDeleteAdmin, SafeDeleteAdminFilter

from website_content.models import WebsiteContent, WebsiteContentImageUpload


@admin.register(WebsiteContent)
class WebsiteContentAdmin(SafeDeleteAdmin):
    """
    Admin for WebsiteContent.

    Soft-deleted rows stay visible here (struck through) so staff can undelete
    them, unlike the API where the default manager hides them.
    """

    # Read by SafeDeleteAdmin.highlight_deleted_field, which renders this field
    # struck through for soft-deleted rows, and by SafeDeleteAdmin.get_queryset,
    # which annotates it as _highlighted_field to keep the column sortable.
    field_to_highlight = "title"

    list_display = (
        "highlight_deleted_field",
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
    # `deleted` is editable=False, so it is only on the form because it is listed
    # here. Without it the change form for a soft-deleted row looks identical to
    # a live one.
    readonly_fields = ("slug", "cover_image", "deleted", "created_on", "updated_on")
    list_select_related = ("user",)
    # Avoid rendering every user in a <select> on the change form, which times
    # out in production. Uses an AJAX search widget instead.
    autocomplete_fields = ("user",)
    ordering = ("-created_on",)

    # Overridden only to name the column and restore sorting. SafeDeleteAdmin
    # ships this method with a placeholder short_description and expects you to
    # reassign it on the function itself, which would mutate the base class.
    @admin.display(description="Title", ordering="_highlighted_field")
    def highlight_deleted_field(self, obj):
        """Render the title, struck through if the row is soft-deleted."""
        return super().highlight_deleted_field(obj)

    def has_change_permission(self, request, obj=None):
        """Deny changes to soft-deleted published rows."""
        if obj is not None and obj.deleted and obj.is_published:
            # A bare save() undeletes (SafeDeleteModel.save defaults to
            # keep_deleted=False), which would restore a public URL and re-derive
            # its slug. Denying change makes Django serve the form read-only and
            # reject the POST, so restoring published content has to go through
            # the "Undelete selected" action. Deleted drafts stay editable --
            # restoring one of those is not publicly visible.
            return False
        return super().has_change_permission(request, obj)

    def change_view(self, request, object_id, form_url="", extra_context=None):
        """Surface a row's soft-deleted state, which the form does not convey."""
        obj = self.get_object(request, unquote(object_id))
        if obj is not None and obj.deleted:
            if self.has_change_permission(request, obj):
                # The change_form override renders this just above the submit row,
                # so it sits where the decision is made rather than off-screen at
                # the top of a long form.
                extra_context = {
                    **(extra_context or {}),
                    "deleted_warning": (
                        "This item is deleted. Saving this form will restore it."
                    ),
                }
            elif request.method == "GET":
                # Read-only, so there is no submit row for a note to sit beside,
                # and the point is to explain why the page is inert on arrival.
                self.message_user(
                    request,
                    "This item is deleted. It was published, so it cannot be "
                    'restored from this form -- use the "Undelete selected" '
                    "action on the list page.",
                    messages.WARNING,
                )
        return super().change_view(request, object_id, form_url, extra_context)

    def save_model(self, request, obj, form, change):
        """Confirm the restore when saving undeletes the row."""
        was_deleted = bool(obj.deleted)
        super().save_model(request, obj, form, change)
        if was_deleted:
            self.message_user(request, f"Restored {obj}.", messages.WARNING)


@admin.register(WebsiteContentImageUpload)
class WebsiteContentImageUploadAdmin(admin.ModelAdmin):
    """Admin for WebsiteContentImageUpload."""

    list_display = ("user", "created_at")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    ordering = ("-created_at",)
