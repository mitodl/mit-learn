"""admin for learning_resources"""

import json

from django.contrib import admin
from django.contrib.admin import TabularInline
from django.contrib.admin.widgets import AdminTextareaWidget
from django.contrib.auth import get_permission_codename
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.forms import SimpleArrayField
from django.urls import reverse
from django.utils.html import format_html

from learning_resources import constants, models
from learning_resources.profiles import admin as profiles_admin  # noqa: F401


class LineSeparatedArrayField(SimpleArrayField):
    """
    Edit an ArrayField as one item per line instead of one comma-separated line.
    """

    def __init__(self, base_field, **kwargs):
        kwargs.setdefault("delimiter", "\n")
        super().__init__(base_field, **kwargs)

    def to_python(self, value):
        """Split on lines, dropping the blank ones and any carriage returns"""
        if isinstance(value, str):
            # A textarea submits CRLF, and a trailing newline or a gap
            # between entries would otherwise become an empty item.
            value = self.delimiter.join(
                line.strip() for line in value.splitlines() if line.strip()
            )
        return super().to_python(value)


class LearningResourceInstructorAdmin(admin.ModelAdmin):
    """Instructor Admin"""

    model = models.LearningResourceInstructor
    search_fields = ("full_name", "first_name", "last_name")


class LearningResourceTopicAdmin(admin.ModelAdmin):
    """Topic Admin"""

    model = models.LearningResourceTopic
    list_display = (
        "name",
        "parent",
    )
    search_fields = ("name",)
    fields = (
        "name",
        "parent",
        "topic_uuid",
        "icon",
    )
    readonly_fields = (
        "name",
        "parent",
        "topic_uuid",
        "icon",
    )


class LearningResourceDepartmentAdmin(admin.ModelAdmin):
    """Department Admin"""

    model = models.LearningResourceDepartment
    list_display = ("name", "department_id")
    search_fields = ("name", "department_id")


class LearningResourcePlatformAdmin(admin.ModelAdmin):
    """Platform Admin"""

    model = models.LearningResourcePlatform
    search_fields = ("platform",)


class ContentFileAdmin(admin.ModelAdmin):
    """Platform Admin"""

    model = models.ContentFile
    list_display = ("key", "run__run_id", "published", "release_date", "updated_on")
    list_filter = ("published",)
    list_select_related = ("run",)
    search_fields = ("key", "run__run_id")
    show_full_result_count = False

    def get_queryset(self, request):
        # content can run to megabytes a row and the list page never shows it
        return super().get_queryset(request).defer("content")


class UnitContentFileInline(TabularInline):
    """Read-only list of a unit's content files, in unit order"""

    model = models.UnitContentFile
    extra = 0
    fields = (
        "position",
        "relation",
        "content_file_link",
        "content_file_title",
        "file_type",
        "content_type",
        "published",
    )
    readonly_fields = (*fields, "content_file_key")
    ordering = ("position", "content_file_id")

    def get_fields(self, request, obj=None):
        fields = super().get_fields(request, obj)
        content_file_admin = self.admin_site.get_model_admin(models.ContentFile)
        if content_file_admin.has_view_permission(request):
            return fields
        # no link to a page the user would get a 403 on
        return [
            "content_file_key" if field == "content_file_link" else field
            for field in fields
        ]

    def get_queryset(self, request):
        # content can run to megabytes a file and the inline never shows it
        return (
            super()
            .get_queryset(request)
            .select_related("content_file")
            .defer(
                *(
                    f"content_file__{field}"
                    for field in constants.CONTENT_FILE_LARGE_FIELDS
                )
            )
        )

    def has_view_permission(self, request, obj=None):  # noqa: ARG002
        # the list is part of the unit's page: whoever can see the unit sees it
        opts = self.parent_model._meta  # noqa: SLF001
        return any(
            request.user.has_perm(
                f"{opts.app_label}.{get_permission_codename(action, opts)}"
            )
            for action in ("view", "change")
        )

    def has_add_permission(self, request, obj=None):  # noqa: ARG002
        return False

    def has_change_permission(self, request, obj=None):  # noqa: ARG002
        return False

    def has_delete_permission(self, request, obj=None):  # noqa: ARG002
        return False

    @admin.display(description="Content file")
    def content_file_link(self, obj):
        content_file = obj.content_file
        return format_html(
            '<a href="{}">{}</a>',
            reverse(
                "admin:learning_resources_contentfile_change", args=(content_file.id,)
            ),
            self.content_file_key(obj),
        )

    @admin.display(description="Content file")
    def content_file_key(self, obj):
        return obj.content_file.key or obj.content_file.id

    @admin.display(description="Title")
    def content_file_title(self, obj):
        return obj.content_file.title

    @admin.display(description="File type")
    def file_type(self, obj):
        return obj.content_file.file_type

    @admin.display(description="Content type")
    def content_type(self, obj):
        return obj.content_file.content_type

    @admin.display(boolean=True, description="Published")
    def published(self, obj):
        return obj.content_file.published


class UnitAdmin(admin.ModelAdmin):
    """
    Read-only Unit Admin. The ETL owns units: each load overwrites them and
    replaces any whose external_id it no longer finds.
    """

    model = models.Unit
    list_display = (
        "title",
        "kind",
        "position",
        "run__run_id",
        "external_id",
        "content_file_count",
        "updated_on",
    )
    list_filter = (
        "kind",
        "run__learning_resource__platform",
        "run__learning_resource__etl_source",
    )
    list_select_related = ("run",)
    search_fields = (
        "title",
        "external_id",
        "run__run_id",
        "run__learning_resource__readable_id",
    )
    fields = (
        "run",
        "external_id",
        "kind",
        "title",
        "position",
        "url",
        "created_on",
        "updated_on",
    )
    readonly_fields = fields
    inlines = (UnitContentFileInline,)
    show_full_result_count = False

    def get_queryset(self, request):
        return super().get_queryset(request).with_content_file_count()

    def has_add_permission(self, request):  # noqa: ARG002
        return False

    def has_change_permission(self, request, obj=None):  # noqa: ARG002
        return False

    def has_delete_permission(self, request, obj=None):  # noqa: ARG002
        return False

    @admin.display(description="Content files", ordering="content_file_count")
    def content_file_count(self, obj):
        return obj.content_file_count


class TutorProblemFileAdmin(admin.ModelAdmin):
    """TutorProblemFile Admin"""

    model = models.TutorProblemFile
    list_display = (
        "problem_title",
        "file_name",
        "type",
        "file_extension",
        "run__run_id",
        "updated_on",
    )
    list_select_related = ("run",)
    list_filter = ("type", "file_extension")
    search_fields = ("problem_title", "file_name", "source_path", "run__run_id")
    autocomplete_fields = ("run",)
    show_full_result_count = False

    def get_queryset(self, request):
        # content can run to megabytes a row and the list page never shows it
        return super().get_queryset(request).defer("content")


class LearningResourceOfferorAdmin(admin.ModelAdmin):
    """Offeror Admin"""

    model = models.LearningResourceOfferor
    search_fields = ("name",)


class LearningResourceRunAdmin(admin.ModelAdmin):
    """LearningResourceRun Admin"""

    model = models.LearningResourceRun

    search_fields = ("run_id", "title", "learning_resource__readable_id")
    list_display = ("run_id", "title", "start_date", "enrollment_start")
    list_filter = (
        "semester",
        "year",
        "learning_resource__platform",
        "learning_resource__offered_by",
        "learning_resource__etl_source",
        "learning_resource__resource_type",
    )
    autocomplete_fields = ("instructors", "learning_resource")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.for_serialization()


class LearningResourceRunInline(TabularInline):
    """Inline list items for course/program runs"""

    model = models.LearningResourceRun
    extra = 0
    show_change_link = True
    fields = (
        "run_id",
        "enrollment_start",
        "start_date",
        "semester",
        "year",
        "published",
    )


class LearningResourceContentTagAdmin(admin.ModelAdmin):
    """LearningResourceContentTag admin"""

    model = models.LearningResourceContentTag
    search_fields = ("name",)


class LearningResourceViewEventAdmin(admin.ModelAdmin):
    """LearningResourceViewEvent admin"""

    @admin.display(
        description="Platform", ordering="learning_resource__platform__platform_code"
    )
    def event_platform(self, event):
        """Display the event's platform"""

        return event.learning_resource.platform

    @admin.display(description="Readable ID", ordering="learning_resource__readable_id")
    def event_readable_id(self, event):
        """Display the event's readable ID"""

        return event.learning_resource.readable_id

    model = models.LearningResourceViewEvent
    list_display = (
        "event_platform",
        "event_readable_id",
        "event_date",
    )
    readonly_fields = (
        "learning_resource",
        "event_date",
    )
    sortable_by = ("event_date", "event_platform", "event_readable_id")


class CourseInline(TabularInline):
    """Inline list items for Courses"""

    model = models.Course
    extra = 0
    show_change_link = True


class LearningPathInline(TabularInline):
    """Inline list items for LearningPaths"""

    model = models.LearningPath
    extra = 0
    show_change_link = True
    readonly_fields = ("author",)


class VideoInline(TabularInline):
    """Inline Video objects"""

    model = models.Video
    show_change_link = True


class VideoPlaylistInline(TabularInline):
    """Inline VideoPlaylist objects"""

    model = models.VideoPlaylist
    fk_name = "learning_resource"
    extra = 0
    show_change_link = True
    fields = ("channel", "parent_learning_resource")
    autocomplete_fields = ("parent_learning_resource",)


class VideoChannelPlaylistInline(TabularInline):
    """Inline VideoPlaylist objects for a VideoChannel"""

    model = models.VideoPlaylist
    fk_name = "channel"
    extra = 0
    show_change_link = True
    fields = ("channel",)


class ProgramInline(TabularInline):
    """Inline Program objects"""

    model = models.Program
    show_change_link = True


class PodcastInline(TabularInline):
    """Inline Podcast objects"""

    model = models.Podcast
    show_change_link = True


class PodcastEpisodeInline(TabularInline):
    """Inline podcast episode objects"""

    model = models.PodcastEpisode
    show_change_link = True


class LearningResourceAdmin(admin.ModelAdmin):
    """LearningResource Admin"""

    model = models.LearningResource
    search_fields = ("readable_id", "title")
    list_display = (
        "readable_id",
        "title",
        "platform",
        "etl_source",
        "require_summaries",
        "offered_by",
        "resource_type",
        "published",
    )
    list_filter = ("platform", "offered_by", "etl_source", "resource_type", "published")
    inlines = [
        CourseInline,
        LearningResourceRunInline,
        LearningPathInline,
        ProgramInline,
        PodcastInline,
        PodcastEpisodeInline,
        VideoInline,
        VideoPlaylistInline,
    ]
    autocomplete_fields = ("topics",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.for_serialization()

    def get_search_results(self, request, queryset, search_term):
        """Match a bare primary key as well as the `search_fields`.

        A resource is identified by its id in plenty of places -- an admin URL,
        a log line, a bug report -- and pasting one of those in is the quickest
        way to find it. Naming `=id` in `search_fields` would find it too, but
        by comparing `id::text` against every row, which is the comparison
        Django's own documentation gives this override to avoid.

        Anything `int` will not read -- a word, a superscript, a digit in a
        circle -- falls through to the `search_fields` match alone.
        """
        results, may_have_duplicates = super().get_search_results(
            request, queryset, search_term
        )
        try:
            pk = int(search_term)
        except ValueError:
            pass
        else:
            results |= queryset.filter(pk=pk)
        return results, may_have_duplicates


class UserListAdmin(admin.ModelAdmin):
    """UserList Admin"""

    model = models.UserList
    search_fields = ("title", "author__username", "author__email")
    list_display = ("title", "author", "created_on", "updated_on")
    readonly_fields = ("author",)


class VideoChannelAdmin(admin.ModelAdmin):
    """VideoChannel Admin"""

    model = models.VideoChannel
    list_display = ("title", "channel_id", "published")
    search_fields = ("title", "channel_id")
    list_filter = ("published",)
    inlines = (VideoChannelPlaylistInline,)


class ContentSummarizerConfigurationAdmin(admin.ModelAdmin):
    """ContentSummarizerConfiguration Admin"""

    model = models.ContentSummarizerConfiguration
    list_display = (
        "llm_model",
        "platform",
        "allowed_content_types",
        "allowed_extensions",
        "is_active",
    )


class CredentialMetadataConfigurationAdmin(admin.ModelAdmin):
    """CredentialMetadataConfiguration Admin"""

    model = models.CredentialMetadataConfiguration
    list_display = (
        "field",
        "resource_type",
        "llm_model",
        "temperature",
        "retrieval_query",
        "is_active",
    )
    list_filter = ("is_active", "resource_type")


class CredentialMetadataGenerationLogAdmin(admin.ModelAdmin):
    """CredentialMetadataGenerationLog Admin"""

    model = models.CredentialMetadataGenerationLog
    list_display = (
        "learning_resource",
        "field",
        "llm_model",
        "context_tokens",
        "latency_ms",
        "created_on",
    )
    list_filter = ("field", "llm_model")
    search_fields = ("learning_resource__readable_id", "learning_resource__title")
    readonly_fields = [field.name for field in model._meta.fields]  # noqa: SLF001

    def get_queryset(self, request):
        # context_text runs tens of KB a row and nothing on the list page shows
        # it.
        return super().get_queryset(request).defer("context_text")

    def has_add_permission(self, request):  # noqa: ARG002
        return False

    def has_change_permission(self, request, obj=None):  # noqa: ARG002
        return False

    def has_delete_permission(self, request, obj=None):  # noqa: ARG002
        return False


class CredentialMetadataAdmin(admin.ModelAdmin):
    """CredentialMetadata Admin"""

    model = models.CredentialMetadata
    list_display = (
        "learning_resource",
        "description",
        "criteria",
        "created_on",
        "updated_on",
    )
    search_fields = ("learning_resource__readable_id", "learning_resource__title")
    readonly_fields = ("created_on", "updated_on")
    raw_id_fields = ("learning_resource",)
    # `criteria` is the only ArrayField here. Without this it renders as a
    # one-line TextInput beside `description`'s textarea, too small to read
    # the values it holds.
    formfield_overrides = {
        ArrayField: {
            "form_class": LineSeparatedArrayField,
            "widget": AdminTextareaWidget,
        }
    }


class ETLSourceOwnershipAdmin(admin.ModelAdmin):
    """ETLSourceOwnership Admin"""

    model = models.ETLSourceOwnership
    list_display = ("etl_source", "resource_type", "owner", "shadow", "updated_on")
    list_filter = ("etl_source", "owner", "shadow")
    search_fields = ("etl_source", "resource_type")


class ETLShadowRunAdmin(admin.ModelAdmin):
    """Read-only admin for the reports shadow runs save"""

    model = models.ETLShadowRun
    list_display = (
        "created_on",
        "etl_source",
        "resource_type",
        "pipeline",
        "created",
        "unpublished",
        "updated",
        "unchanged",
        "failed",
    )
    list_filter = ("etl_source", "resource_type", "pipeline")
    fields = (
        "created_on",
        "etl_source",
        "resource_type",
        "pipeline",
        "error",
        "counts_json",
        "details_json",
    )
    readonly_fields = fields

    def get_queryset(self, request):
        """Leave the report bodies out of the list, which shows only counts"""
        queryset = super().get_queryset(request)
        if request.resolver_match.url_name.endswith("_changelist"):
            return queryset.defer("details")
        return queryset

    def has_add_permission(self, request):  # noqa: ARG002
        return False

    def has_change_permission(self, request, obj=None):  # noqa: ARG002
        return False

    def has_delete_permission(self, request, obj=None):  # noqa: ARG002
        return False

    @admin.display(description="Created")
    def created(self, obj):
        return obj.counts.get("created")

    @admin.display(description="Unpublished")
    def unpublished(self, obj):
        return obj.counts.get("unpublished")

    @admin.display(description="Updated")
    def updated(self, obj):
        return obj.counts.get("updated")

    @admin.display(description="Unchanged")
    def unchanged(self, obj):
        return obj.counts.get("unchanged")

    @admin.display(boolean=True, description="Load failed")
    def failed(self, obj):
        return bool(obj.error)

    @admin.display(description="Counts")
    def counts_json(self, obj):
        return _pretty_json(obj.counts)

    @admin.display(description="Details")
    def details_json(self, obj):
        return _pretty_json(obj.details)


def _pretty_json(value):
    return format_html("<pre>{}</pre>", json.dumps(value, indent=2, sort_keys=True))


admin.site.register(models.LearningResourceTopic, LearningResourceTopicAdmin)
admin.site.register(models.LearningResourceInstructor, LearningResourceInstructorAdmin)
admin.site.register(models.LearningResource, LearningResourceAdmin)
admin.site.register(models.LearningResourceRun, LearningResourceRunAdmin)
admin.site.register(models.LearningResourceDepartment, LearningResourceDepartmentAdmin)
admin.site.register(models.LearningResourcePlatform, LearningResourcePlatformAdmin)
admin.site.register(models.LearningResourceOfferor, LearningResourceOfferorAdmin)
admin.site.register(models.LearningResourceViewEvent, LearningResourceViewEventAdmin)
admin.site.register(models.LearningResourceContentTag, LearningResourceContentTagAdmin)
admin.site.register(models.UserList, UserListAdmin)
admin.site.register(models.VideoChannel, VideoChannelAdmin)
admin.site.register(models.ContentFile, ContentFileAdmin)
admin.site.register(models.TutorProblemFile, TutorProblemFileAdmin)
admin.site.register(models.Unit, UnitAdmin)
admin.site.register(
    models.ContentSummarizerConfiguration, ContentSummarizerConfigurationAdmin
)
admin.site.register(
    models.CredentialMetadataConfiguration, CredentialMetadataConfigurationAdmin
)
admin.site.register(
    models.CredentialMetadataGenerationLog, CredentialMetadataGenerationLogAdmin
)
admin.site.register(models.CredentialMetadata, CredentialMetadataAdmin)


admin.site.register(models.ETLSourceOwnership, ETLSourceOwnershipAdmin)
admin.site.register(models.ETLShadowRun, ETLShadowRunAdmin)
