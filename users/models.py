"""Users models"""

from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Custom model for users"""
