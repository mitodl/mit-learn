"""ckeditor models"""

from django.conf import settings
from django.db import models

from main.models import TimestampedModel
from profiles.utils import article_image_upload_uri
from django.utils.text import slugify


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
    slug = models.SlugField(max_length=255, unique=True, blank=True, null=True)
    is_published = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        previous = Article.objects.get(pk=self.pk) if self.pk else None
        was_published = getattr(previous, "is_published", None)

        # Always initialize slug
        slug = self.slug or None

        if not was_published and self.is_published:
            max_length = self._meta.get_field("slug").max_length

            base_slug = slugify(self.title)[:max_length]
            slug = base_slug
            counter = 1

            # Prevent collisions
            while Article.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                suffix = f"-{counter}"
                slug = f"{base_slug[: max_length - len(suffix)]}{suffix}"
                counter += 1

        self.slug = slug
        super().save(*args, **kwargs)


class ArticleImageUpload(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    image_file = models.ImageField(
        null=True, upload_to=article_image_upload_uri, max_length=2083, editable=False
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ArticleImageUpload({self.user_id})"
