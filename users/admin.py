"""Users admin"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as ContribUserAdmin

from users.models import User


@admin.register(User)
class UserAdmin(ContribUserAdmin):
    """Admin for User"""

    readonly_fields = (
        *ContribUserAdmin.readonly_fields,
        "scim_id",
        "scim_username",
        "scim_external_id",
    )

    fieldsets = (
        *ContribUserAdmin.fieldsets,
        (
            "Identity provider",
            {
                "fields": ("is_sso_user",),
                "description": (
                    "Blank until it is first determined from Keycloak. Clear it "
                    "to have it re-read, or set it explicitly to override — "
                    "unsetting it lets a user manage their own email and "
                    "password here."
                ),
            },
        ),
        ("SCIM", {"fields": ("scim_id", "scim_username", "scim_external_id")}),
    )
