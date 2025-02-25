"""Users admin"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as ContribUserAdmin
from hijack.contrib.admin import HijackUserAdminMixin

from users.models import User


@admin.register(User)
class UserAdmin(ContribUserAdmin, HijackUserAdminMixin):
    """Admin for User"""

    readonly_fields = (
        *ContribUserAdmin.readonly_fields,
        "scim_id",
        "scim_username",
        "scim_external_id",
    )

    fieldsets = (
        *ContribUserAdmin.fieldsets,
        ("SCIM", {"fields": ("scim_id", "scim_username", "scim_external_id")}),
    )
