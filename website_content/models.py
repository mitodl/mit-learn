"""website_content models"""

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from safedelete.managers import SafeDeleteManager
from safedelete.models import SOFT_DELETE, SafeDeleteModel
from safedelete.queryset import SafeDeleteQueryset

from main.models import TimestampedModel
from main.utils import now_in_utc
from website_content.constants import WebsiteContentType
from website_content.utils import (
    extract_image_from_content,
    website_content_image_upload_uri,
)


class WebsiteContentQuerySet(SafeDeleteQueryset):
    """
    Subclassed QuerySet for WebsiteContentManager
    """

    def update(self, **kwargs):
        """
        Automatically update updated_on timestamp when .update(). This mirrors
        TimestampedModelQuerySet, which is bypassed because SafeDeleteModel
        supplies its own queryset.
        """
        if "updated_on" not in kwargs:
            kwargs["updated_on"] = now_in_utc()
        return super().update(**kwargs)


class WebsiteContentManager(SafeDeleteManager):
    """
    Default manager for WebsiteContent.

    Hides soft-deleted rows and keeps TimestampedModel's updated_on behavior.
    """

    _queryset_class = WebsiteContentQuerySet


class WebsiteContent(TimestampedModel, SafeDeleteModel):
    """
    Stores rich-text content created by staff members.

    The `content_type` field distinguishes between different kinds of authored
    content (e.g. "news" posts vs standalone "article" pages).

    Deletes are soft: `delete()` stamps `deleted` and the default manager hides
    the row from every query, keeping it available for recovery/audit. Pass
    `force_policy=HARD_DELETE` to remove a row for real, or use
    `all_objects` / `deleted_objects` to query soft-deleted rows.
    """

    _safedelete_policy = SOFT_DELETE

    # Declared explicitly: TimestampedModel precedes SafeDeleteModel in the MRO,
    # so its plain manager would otherwise win and expose soft-deleted rows.
    objects = WebsiteContentManager()

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
        choices=WebsiteContentType.as_tuple(),
        default=WebsiteContentType.news.name,
    )
    cover_image = models.URLField(max_length=2083, blank=True, default="")

    def save(self, *args, **kwargs):
        """Auto-populate slug and cover_image before persisting."""
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
        image_data = extract_image_from_content(self.content)
        self.cover_image = image_data.get("url", "") if image_data else ""

        super().save(*args, **kwargs)

    def get_url(self):
        """
        Return the relative URL for this content item.
        """
        if not self.slug:
            return None
        if self.content_type == WebsiteContentType.news.name:
            return f"/news/{self.slug}"
        return f"/articles/{self.slug}"


class WebsiteContentImageUpload(models.Model):
    """Tracks image files uploaded through the website content editor."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    image_file = models.ImageField(
        null=True,
        upload_to=website_content_image_upload_uri,
        max_length=2083,
        editable=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        """Return a string representation."""
        return f"WebsiteContentImageUpload({self.user_id})"
