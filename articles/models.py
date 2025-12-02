"""ckeditor models"""

from django.conf import settings
from django.db import models

from main.models import TimestampedModel
from profiles.utils import article_image_upload_uri


class Article(TimestampedModel):
    """
    Stores rich-text content created by staff members.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,  # optional for admin forms
    )
    content = models.JSONField(default={})
    title = models.CharField(max_length=255)


class ArticleImageUpload(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    image_file = models.ImageField(
        null=True, upload_to=article_image_upload_uri, max_length=2083, editable=False
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ArticleImageUpload({self.user_id})"
