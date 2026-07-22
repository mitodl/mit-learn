"""Users models"""

import uuid

from django.contrib.auth.models import AbstractUser
from django.db.models import CharField, UUIDField
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

    def get_or_generate_unsubscribe_uuid(self) -> uuid.UUID:
        """Get the existing unsubscribe_uuid or generate a new one"""
        if self.unsubscribe_uuid is None:
            self.unsubscribe_uuid = uuid.uuid4()
            self.save(update_fields=["unsubscribe_uuid"])

        return self.unsubscribe_uuid
