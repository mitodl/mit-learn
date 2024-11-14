from django.apps import AppConfig


class OpenapiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "openapi"

    def ready(self):
        from openapi import schema  # noqa: F401
