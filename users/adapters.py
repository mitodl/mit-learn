from django.contrib.auth import get_user_model
from django.db import transaction
from mitol.scim.adapters import UserAdapter

from authentication.hooks import get_plugin_manager
from profiles.models import Profile
from users.tasks import reindex_user_learning_paths

User = get_user_model()

# User model fields managed by SCIM (set by UserAdapter.from_dict()).
# _save_user() restricts writes to these columns so that non-SCIM data
# loaded before this request is not written back over a concurrent update.
_SCIM_USER_FIELDS = (
    "email",
    "username",
    "first_name",
    "last_name",
    "is_active",
    "scim_username",
    "scim_external_id",
    "global_id",
)


class LearnUserAdapter(UserAdapter):
    """
    Custom adapter to extend django_scim library.  This is required in order
    to extend the profiles.models.Profile model to work with the
    django_scim library.
    """

    @property
    def display_name(self):
        """
        Return the displayName of the user per the SCIM spec.
        """
        return (
            self.obj.profile.name
            if getattr(self.obj, "profile", None) is not None
            else ""
        )

    def from_dict(self, d):
        """
        Consume a ``dict`` conforming to the SCIM User Schema, updating the
        internal user object with data from the ``dict``.

        Please note, the user object is not saved within this method. To
        persist the changes made by this method, please call ``.save()`` on the
        adapter. Eg::

            scim_user.from_dict(d)
            scim_user.save()
        """
        super().from_dict(d)

        self.obj.profile = getattr(self.obj, "profile", Profile())
        self.obj.profile.name = d.get("fullName", d.get("name", ""))
        self.obj.profile.email_optin = d.get("emailOptIn", 1) == 1

    def save(self):
        """
        Save the user object and any related objects, such as the profile.
        Triggers the new-user plugin hook after creation.
        """
        newly_created = self.is_new_user
        super().save()
        if newly_created:
            pm = get_plugin_manager()
            hook = pm.hook
            hook.user_created(user=self.obj, user_data={})

    def _save_user(self):
        """
        Serialize concurrent SCIM PATCH requests and schedule async reindexing.

        Runs inside the transaction.atomic() from the parent save(). For existing
        users, SELECT FOR UPDATE serializes concurrent PATCH requests for the same
        user. update_fields restricts writes to SCIM-managed columns so that
        non-SCIM data from before this request cannot overwrite a concurrent
        update. After commit, dispatches async re-indexing for learning paths
        owned by this user to keep OpenSearch documents consistent.
        """
        if not self.is_new_user:
            User.objects.select_for_update().get(pk=self.obj.pk)
            self.obj.save(update_fields=_SCIM_USER_FIELDS)
            user_pk = self.obj.pk
            transaction.on_commit(lambda: reindex_user_learning_paths.delay(user_pk))
        else:
            super()._save_user()

    def _save_related(self):
        """
        Save models related to the user
        """
        self.obj.profile.user = self.obj
        self.obj.profile.save()

    def _handle_replace_nested_path(self, nested_path, nested_value):
        """Per-path replacement handling"""
        if nested_path.first_path == ("fullName", None, None):
            self.obj.profile.name = nested_value
        elif nested_path.first_path == ("emailOptIn", None, None):
            self.obj.profile.email_optin = nested_value == 1
        else:
            return super()._handle_replace_nested_path(nested_path, nested_value)

        return True
