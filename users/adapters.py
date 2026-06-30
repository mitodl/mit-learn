from django.contrib.auth import get_user_model
from django.db import transaction
from mitol.scim.adapters import UserAdapter

from authentication.hooks import get_plugin_manager
from profiles.models import Profile
from users.tasks import reindex_user_learning_paths

User = get_user_model()


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

        For existing users a SELECT FOR UPDATE row-level lock is acquired
        before writing so that concurrent SCIM PATCH requests for the same
        user (arriving on different pods) are serialized rather than
        racing each other, which previously produced HTTP 409 conflicts.

        After the database transaction commits, a Celery task is dispatched
        to re-index any learning paths owned by this user, keeping
        OpenSearch documents consistent without blocking the HTTP response
        with synchronous I/O.
        """
        newly_created = self.is_new_user
        user_pk = self.obj.pk
        with transaction.atomic():
            if not newly_created:
                # Lock the user row so concurrent PATCH requests for the
                # same user block here rather than racing to the UPDATE.
                User.objects.select_for_update().get(pk=self.obj.pk)
            super().save()
            if not newly_created:
                # Register the Celery dispatch inside the atomic block so
                # on_commit fires after the transaction commits, not immediately
                # (which would happen in autocommit mode if called outside).
                transaction.on_commit(
                    lambda: reindex_user_learning_paths.delay(user_pk)
                )
        if newly_created:
            pm = get_plugin_manager()
            hook = pm.hook
            hook.user_created(user=self.obj, user_data={})

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
