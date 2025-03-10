"""Users models"""

from django.contrib.auth.models import AbstractUser
from django.db.models import CharField
from django_scim.models import AbstractSCIMUserMixin

from main.models import TimestampedModel


class User(AbstractUser, AbstractSCIMUserMixin, TimestampedModel):
    """Custom model for users"""

    global_id = CharField(blank=True, max_length=255, unique=True)
