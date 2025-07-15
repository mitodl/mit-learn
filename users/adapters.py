from mitol.scim.adapters import UserAdapter

from authentication.hooks import get_plugin_manager
from profiles.models import Profile


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

    def _save_related(self):
        """
        Save models related to the user
        """
        self.obj.profile.user = self.obj
        self.obj.profile.save()
        pm = get_plugin_manager()
        hook = pm.hook
        hook.user_created(user=self.obj, user_data=self.to_dict())

    def _handle_replace_nested_path(self, nested_path, nested_value):
        """Per-path replacement handling"""
        if nested_path.first_path == ("fullName", None, None):
            self.obj.profile.name = nested_value
        elif nested_path.first_path == ("emailOptIn", None, None):
            self.obj.profile.email_optin = nested_value == 1
        else:
            return super()._handle_replace_nested_path(nested_path, nested_value)

        return True
