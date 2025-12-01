"""ckeditor models"""

from django.conf import settings
from django.db import models

from main.models import TimestampedModel


class Article(TimestampedModel):
    """
    Stores rich-text content created by staff members.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,   # optional for admin forms
    )
    content = models.JSONField(default={})
    title = models.CharField(max_length=255)
