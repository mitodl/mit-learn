"""
Reinstate the `article` resource type and move mirrored website content onto it.

0105 folded `article` into `document` and dropped the enum member, when nothing
created article resources. Website content is now mirrored into resources and
has to be distinguishable from documents ingested from external sources, so the
member comes back.

The data step matters: `sync_website_content_to_learning_resource` looks its row
up by (readable_id, resource_type), so without it every previously mirrored item
would be left behind as an orphaned `document` -- still carrying its old search
index entry -- while the next sync inserted a second row as an `article`.
"""

from django.db import migrations, models

from learning_resources.constants import (
    WEBSITE_CONTENT_READABLE_ID_PREFIX,
    LearningResourceType,
)

RESOURCE_TYPE_CHOICES = [(member.name, member.value) for member in LearningResourceType]


def _remap(apps, from_type, to_type):
    LearningResource = apps.get_model("learning_resources", "LearningResource")
    LearningResource.objects.filter(
        readable_id__startswith=WEBSITE_CONTENT_READABLE_ID_PREFIX,
        resource_type=from_type,
    ).update(
        resource_type=to_type,
        resource_category=LearningResourceType[to_type].value,
    )


def to_article(apps, schema_editor):
    """Move mirrored website content from `document` to `article`"""
    _remap(apps, LearningResourceType.document.name, LearningResourceType.article.name)


def to_document(apps, schema_editor):
    """Move it back, so the reverse leaves no rows on a type that is gone"""
    _remap(apps, LearningResourceType.article.name, LearningResourceType.document.name)


class Migration(migrations.Migration):
    """Add the `article` resource type and remap mirrored website content"""

    dependencies = [
        ("learning_resources", "0125_website_content_resource_unique"),
    ]

    operations = [
        migrations.AlterField(
            model_name="learningresource",
            name="resource_type",
            field=models.CharField(
                choices=RESOURCE_TYPE_CHOICES, db_index=True, max_length=24
            ),
        ),
        migrations.RunPython(to_article, to_document),
    ]
