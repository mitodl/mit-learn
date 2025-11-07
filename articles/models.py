"""ckeditor models"""

from django.db import models

from main.models import TimestampedModel


class Article(TimestampedModel):
    """
    Stores rich-text content created by staff members.
    """

    json = models.JSONField(default={})
    title = models.CharField(max_length=255)
