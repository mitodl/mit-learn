"""Users models"""

from django.contrib.auth.models import AbstractUser
from django.db.models import UUIDField
from django_scim.models import AbstractSCIMUserMixin

from main.models import TimestampedModel


class User(AbstractUser, AbstractSCIMUserMixin, TimestampedModel):
    """Custom model for users"""

    global_id = UUIDField(unique=True, null=True)
