"""Users models"""

import uuid

from django.contrib.auth.models import AbstractUser
from django.db.models import BooleanField, CharField, UUIDField
from django_scim.models import AbstractSCIMUserMixin

from main.models import TimestampedModel


class User(AbstractUser, AbstractSCIMUserMixin, TimestampedModel):
    """Custom model for users"""

    global_id = CharField(max_length=255, null=True, unique=True)  # noqa: DJ001

    unsubscribe_uuid = UUIDField(
        null=True,
        unique=True,
        default=None,
    )

    # Null until first needed, then filled in from Keycloak's federated identity
    # links (see authentication.api.is_sso_user). Stored rather than derived on
    # each read because it effectively never changes on its own, and because
    # making it editable is useful: clearing the flag grants someone local
    # credentials, so they can keep an account after leaving the organization
    # that provided their identity.
    is_sso_user = BooleanField(
        null=True,
        default=None,
        help_text=(
            "Authenticates via an external identity provider, so cannot change "
            "their own email or password. Blank until determined from Keycloak."
        ),
    )

    def get_or_generate_unsubscribe_uuid(self) -> uuid.UUID:
        """Get the existing unsubscribe_uuid or generate a new one"""
        if self.unsubscribe_uuid is None:
            self.unsubscribe_uuid = uuid.uuid4()
            self.save(update_fields=["unsubscribe_uuid"])

        return self.unsubscribe_uuid
