"""ckeditor models"""

from django.db import models
from django.conf import settings

from profiles.utils import (
    article_image_upload_uri
)
from main.models import TimestampedModel


class Article(TimestampedModel):
    """
    Stores rich-text content created by staff members.
    """

    content = models.JSONField(default={})
    title = models.CharField(max_length=255)

class ArticleImageUpload(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    image_file = models.ImageField(
        null=True,
        upload_to=article_image_upload_uri,
        max_length=2083,
        editable=False
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ArticleImageUpload({self.user_id})"
