"""Users models"""

from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Custom model for users"""

    class Meta:
        db_table = "auth_user"
