"""Admin configuration for website_content app."""

from django.contrib import admin
from safedelete.admin import SafeDeleteAdmin

from website_content.models import WebsiteContent, WebsiteContentImageUpload


class DeletedListFilter(admin.SimpleListFilter):
    """
    Filter on soft-deleted state, listing everything by default.

    Replaces safedelete's own SafeDeleteAdminFilter, which excludes soft-deleted
    rows whenever no value is selected -- so they are invisible until you know
    to reach for the filter, which is a poor way to find something you want to
    undelete. Here "All" means all, and the two explicit lookups narrow it.
    """

    title = "deleted"
    parameter_name = "deleted"

    def lookups(self, request, model_admin):  # noqa: ARG002
        """Return the narrowing choices; Django adds "All" itself."""
        return (("no", "Not deleted"), ("yes", "Deleted only"))

    def queryset(self, request, queryset):  # noqa: ARG002
        """Narrow by soft-deleted state, or return everything for "All"."""
        if self.value() == "no":
            return queryset.filter(deleted__isnull=True)
        if self.value() == "yes":
            return queryset.filter(deleted__isnull=False)
        return queryset


@admin.register(WebsiteContent)
class WebsiteContentAdmin(SafeDeleteAdmin):
    """
    Admin for WebsiteContent.

    Soft-deleted rows are listed here (struck through) so staff can find and
    undelete them, unlike the API where the default manager hides them.
    Undeleting is done with the "Undelete selected" action; the change form
    deliberately does not undelete (see save_model).
    """

    # highlight_deleted_field strikes through this field for soft-deleted rows.
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
    # SafeDeleteAdmin.list_filter is deliberately not spread in: it is a raw date
    # filter on `deleted`, which rendered a second, near-identically titled
    # "deleted" filter next to this one.
    list_filter = (
        "content_type",
        "is_published",
        DeletedListFilter,
    )
    search_fields = ("title", "slug", "author_name")
    readonly_fields = ("slug", "cover_image", "created_on", "updated_on")
    list_select_related = ("user",)
    # Avoid rendering every user in a <select> on the change form, which times
    # out in production. Uses an AJAX search widget instead.
    autocomplete_fields = ("user",)
    ordering = ("-created_on",)

    # Overridden purely for the display metadata: SafeDeleteAdmin labels the
    # column "Override this name (see docs)", and assigning short_description on
    # the inherited function would mutate it for every SafeDeleteAdmin subclass.
    # "_highlighted_field" is the F() annotation SafeDeleteAdmin.get_queryset
    # adds for field_to_highlight, which makes the column sortable.
    @admin.display(description="Title", ordering="_highlighted_field")
    def highlight_deleted_field(self, obj):
        """Render the title, struck through when the row is soft-deleted."""
        return super().highlight_deleted_field(obj)

    def has_change_permission(self, request, obj=None):
        """
        Deny edits to soft-deleted published content.

        Undeleting it would put it straight back on the live site, so it has to
        go through the explicit "Undelete selected" action instead. Django also
        rejects a POST to the change form when this is False, so the rule holds
        even if someone hand-crafts the request. Deleted drafts stay editable.
        """
        if obj is not None and obj.deleted and obj.is_published:
            return False
        return super().has_change_permission(request, obj)

    def save_model(self, request, obj, form, change):  # noqa: ARG002
        """
        Save the row without resurrecting it.

        SafeDeleteModel.save() undeletes by default, so a bare Save on the
        change form would silently undelete with nothing on the form saying so.
        Undeleting is an explicit act: use the "Undelete selected" action.
        """
        obj.save(keep_deleted=True)


@admin.register(WebsiteContentImageUpload)
class WebsiteContentImageUploadAdmin(admin.ModelAdmin):
    """Admin for WebsiteContentImageUpload."""

    list_display = ("user", "created_at")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    ordering = ("-created_at",)
