"""Resource profile admin"""

from django.contrib import admin

from learning_resources.models import (
    ClaimExtraction,
    ResourceProfileConfiguration,
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
        "updated_on",
    )


class ClaimExtractionAdmin(admin.ModelAdmin):
    """ClaimExtraction Admin"""

    model = ClaimExtraction
    list_display = ("key", "level", "extractor_version", "model", "unit", "created_on")
    list_filter = ("level", "model", "extractor_version")
    search_fields = ("key", "unit__external_id", "unit__run__run_id")
    raw_id_fields = ("unit",)
    show_full_result_count = False

    def get_queryset(self, request):
        # outputs run to hundreds of kilobytes a row and the list never shows them
        return super().get_queryset(request).defer("output", "raw_response")


admin.site.register(ResourceProfileConfiguration, ResourceProfileConfigurationAdmin)
admin.site.register(ClaimExtraction, ClaimExtractionAdmin)
