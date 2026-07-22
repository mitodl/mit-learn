from django.db import migrations


def unpublish_micromasters_resources(apps, schema_editor):
    """Unpublish and deindex any remaining micromasters resources"""
    # Real model/utils (not apps.get_model) so the pluggy unpublished hooks
    # fire and deindex the resources from OpenSearch/Qdrant
    from learning_resources.models import LearningResource
    from learning_resources.utils import resource_unpublished_actions

    for resource in LearningResource.objects.filter(
        etl_source="micromasters", published=True
    ):
        resource.published = False
        resource.save()
        resource_unpublished_actions(resource)


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0116_learningresourcerun_is_b2b_is_variant"),
    ]

    operations = [
        migrations.RunPython(
            unpublish_micromasters_resources, migrations.RunPython.noop
        ),
    ]
