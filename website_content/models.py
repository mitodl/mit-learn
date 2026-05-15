"""website_content models"""

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from main.models import TimestampedModel
from profiles.utils import article_image_upload_uri
from website_content.constants import (
    CONTENT_TYPE_CHOICES,
    CONTENT_TYPE_NEWS,
)


class WebsiteContent(TimestampedModel):
    """
    Stores rich-text content created by staff members.

    The `content_type` field distinguishes between different kinds of authored
    content (e.g. "news" posts vs standalone "article" pages).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,  # optional for admin forms
    )
    content = models.JSONField(default=dict)
    title = models.CharField(max_length=255)
    author_name = models.TextField(blank=True, default="")
    slug = models.SlugField(max_length=255, unique=True, blank=True, null=True)
    is_published = models.BooleanField(default=False)
    publish_date = models.DateTimeField(null=True, blank=True)
    content_type = models.CharField(
        max_length=50,
        choices=CONTENT_TYPE_CHOICES,
        default=CONTENT_TYPE_NEWS,
    )

    def save(self, *args, **kwargs):
        previous = WebsiteContent.objects.get(pk=self.pk) if self.pk else None
        was_published = getattr(previous, "is_published", None)

        slug = self.slug or None

        if not was_published and self.is_published:
            if not self.publish_date:
                self.publish_date = timezone.now()

            max_length = self._meta.get_field("slug").max_length

            base_slug = slugify(self.title)[:max_length]
            slug = base_slug
            counter = 1

            while WebsiteContent.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                suffix = f"-{counter}"
                slug = f"{base_slug[: max_length - len(suffix)]}{suffix}"
                counter += 1

        self.slug = slug
        super().save(*args, **kwargs)

    def get_url(self):
        """
        Return the relative URL for this content item.
        """
        if not self.slug:
            return None
        if self.content_type == CONTENT_TYPE_NEWS:
            return f"/news/{self.slug}"
        return f"/articles/{self.slug}"


class WebsiteContentImageUpload(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    image_file = models.ImageField(
        null=True, upload_to=article_image_upload_uri, max_length=2083, editable=False
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"WebsiteContentImageUpload({self.user_id})"
