"""admin for main"""

from django.contrib import admin

from main import models


class TaskJobAdmin(admin.ModelAdmin):
    """TaskJob Admin"""

    model = models.TaskJob
    list_display = ("id", "task_name", "status", "created_on", "updated_on")
    list_filter = ("status", "task_name")
    readonly_fields = ("created_on", "updated_on")


admin.site.register(models.TaskJob, TaskJobAdmin)


class TaskBatchAdmin(admin.ModelAdmin):
    """TaskBatch Admin"""

    model = models.TaskBatch
    list_display = (
        "id",
        "job",
        "batch_key",
        "kind",
        "status",
        "updated_on",
    )
    list_filter = ("status", "kind")
    search_fields = ("batch_key",)
    readonly_fields = ("created_on", "updated_on")


admin.site.register(models.TaskBatch, TaskBatchAdmin)
