"""Resource profile admin"""

from django.contrib import admin

from learning_resources.models import (
    ClaimEvidence,
    ClaimExtraction,
    ProfileClaim,
    ResourceProfileConfiguration,
    RunProfile,
)


class InputFilter(admin.SimpleListFilter):
    """
    A list filter with a text box, for fields with too many values to list,
    matching the value exactly.
    """

    template = "admin/learning_resources/input_filter.html"
    # the field path the value is matched against, like run__run_id
    field_path = None

    def lookups(self, request, model_admin):  # noqa: ARG002
        """There are no choices to list"""
        return ()

    def has_output(self):
        """Show the text box though there are no choices"""
        return True

    def get_facet_counts(self, pk_attname, filtered_qs):  # noqa: ARG002
        """There are no choices to count"""
        return {}

    def queryset(self, request, queryset):  # noqa: ARG002
        """Filter on the value when there is one"""
        value = (self.value() or "").strip()
        if value:
            return queryset.filter(**{self.field_path: value})
        return queryset

    def choices(self, changelist):
        """Yield the text box's value and the other parameters for the form to keep"""
        yield {
            "parameter_name": self.parameter_name,
            "value": self.value() or "",
            # the other filters, the search and the ordering; not the page
            "query_parts": [
                (name, value)
                for name, values in changelist.filter_params.items()
                if name != self.parameter_name
                for value in values
            ],
        }


class ProfileResourceFilter(InputFilter):
    """Filter a profile's rows by its learning resource's readable id"""

    title = "learning resource readable id"
    parameter_name = "readable_id"
    field_path = "profile__run__learning_resource__readable_id"


class ProfileRunFilter(InputFilter):
    """Filter a profile's rows by its run's run id"""

    title = "run id"
    parameter_name = "run_id"
    field_path = "profile__run__run_id"


class ResourceProfileConfigurationAdmin(admin.ModelAdmin):
    """ResourceProfileConfiguration Admin"""

    model = ResourceProfileConfiguration
    list_display = (
        "stage",
        "llm_model",
        "temperature",
        "max_file_tokens",
        "input_token_budget",
        "max_parts",
        "updated_on",
    )


class ClaimExtractionAdmin(admin.ModelAdmin):
    """ClaimExtraction Admin"""

    model = ClaimExtraction
    list_display = (
        "key",
        "level",
        "extractor_version",
        "model",
        "unit",
        "part",
        "run",
        "published",
        "created_on",
    )
    list_filter = ("published", "level", "model", "extractor_version")
    search_fields = ("key", "unit__external_id", "unit__run__run_id", "run__run_id")
    raw_id_fields = ("unit", "run")
    show_full_result_count = False

    def get_queryset(self, request):
        """Leave out the large fields the list doesn't show"""
        # outputs run to hundreds of kilobytes a row and the list never shows them
        return super().get_queryset(request).defer("output", "raw_response")


class RunProfileAdmin(admin.ModelAdmin):
    """RunProfile Admin"""

    model = RunProfile
    list_display = ("id", "run", "status", "run_extraction", "updated_on")
    list_filter = ("status",)
    search_fields = ("run__run_id", "run__learning_resource__readable_id")
    raw_id_fields = ("run", "run_extraction")
    readonly_fields = ("invalidation_counts",)

    def get_queryset(self, request):
        """Load the list's foreign keys without the extraction's large fields"""
        # the run's __str__ shows its resource's platform, and the extraction's
        # output and raw response are too large to load for its __str__
        return (
            super()
            .get_queryset(request)
            .select_related("run__learning_resource__platform", "run_extraction")
            .defer("run_extraction__output", "run_extraction__raw_response")
        )


class ClaimEvidenceInline(admin.TabularInline):
    """ClaimEvidence Inline"""

    model = ClaimEvidence
    extra = 0
    raw_id_fields = ("content_file",)
    fields = ("content_file", "locator", "verified", "passage")
    readonly_fields = fields


class ProfileClaimAdmin(admin.ModelAdmin):
    """ProfileClaim Admin"""

    model = ProfileClaim
    list_display = (
        "display_id",
        "kind",
        "level",
        "label",
        "resource_readable_id",
        "run_id",
        "unit",
    )
    list_filter = (ProfileResourceFilter, ProfileRunFilter, "kind", "level")
    search_fields = ("label", "uid", "display_id", "profile__run__run_id")
    raw_id_fields = ("profile", "unit", "extraction", "cited_claims", "cited_units")
    inlines = [ClaimEvidenceInline]
    list_select_related = ("profile__run__learning_resource", "unit")
    show_full_result_count = False

    @admin.display(
        description=ProfileResourceFilter.title,
        ordering=ProfileResourceFilter.field_path,
    )
    def resource_readable_id(self, obj):
        """Return the profile's learning resource's readable id"""
        return obj.profile.run.learning_resource.readable_id

    @admin.display(
        description=ProfileRunFilter.title, ordering=ProfileRunFilter.field_path
    )
    def run_id(self, obj):
        """Return the profile's run's run id"""
        return obj.profile.run.run_id


admin.site.register(ResourceProfileConfiguration, ResourceProfileConfigurationAdmin)
admin.site.register(ClaimExtraction, ClaimExtractionAdmin)
admin.site.register(RunProfile, RunProfileAdmin)
admin.site.register(ProfileClaim, ProfileClaimAdmin)
