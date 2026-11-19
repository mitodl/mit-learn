"""Resource profile admin"""

from django.contrib import admin

from learning_resources.models import (
    ClaimEvidence,
    ClaimExtraction,
    ProfileClaim,
    ProfileStatement,
    ResourceProfileConfiguration,
    RunProfile,
)


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
    list_display = ("id", "run", "status", "resource_extraction", "updated_on")
    list_filter = ("status",)
    search_fields = ("run__run_id", "run__learning_resource__readable_id")
    raw_id_fields = ("run", "resource_extraction")
    readonly_fields = ("row_counts",)

    def get_queryset(self, request):
        """Load the list's foreign keys without the extraction's large fields"""
        # the run's __str__ shows its resource's platform, and the extraction's
        # output and raw response are too large to load for its __str__
        return (
            super()
            .get_queryset(request)
            .select_related("run__learning_resource__platform", "resource_extraction")
            .defer("resource_extraction__output", "resource_extraction__raw_response")
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
    list_display = ("display_id", "kind", "level", "label", "profile", "unit")
    list_filter = ("kind", "level")
    search_fields = ("label", "uid", "display_id", "profile__run__run_id")
    raw_id_fields = ("profile", "unit", "extraction", "cites")
    inlines = [ClaimEvidenceInline]
    list_select_related = ("profile", "unit")
    show_full_result_count = False


class ProfileStatementAdmin(admin.ModelAdmin):
    """ProfileStatement Admin"""

    model = ProfileStatement
    list_display = ("section", "position", "text", "profile")
    list_filter = ("section",)
    search_fields = ("text", "profile__run__run_id")
    raw_id_fields = ("profile", "claims", "units")
    list_select_related = ("profile",)
    show_full_result_count = False


admin.site.register(ResourceProfileConfiguration, ResourceProfileConfigurationAdmin)
admin.site.register(ClaimExtraction, ClaimExtractionAdmin)
admin.site.register(RunProfile, RunProfileAdmin)
admin.site.register(ProfileClaim, ProfileClaimAdmin)
admin.site.register(ProfileStatement, ProfileStatementAdmin)
