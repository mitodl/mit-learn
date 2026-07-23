from django.db import migrations


def unpublish_micromasters_resources(apps, schema_editor):
    """Unpublish and deindex any remaining micromasters resources"""
    # Runtime import so the pluggy unpublished hooks fire and deindex the
    # resources from OpenSearch/Qdrant; the hook is id-based so it stays
    # compatible with the historical model queryset
    from learning_resources.utils import bulk_resources_unpublished_actions

    LearningResource = apps.get_model("learning_resources", "LearningResource")
    resources = LearningResource.objects.filter(
        etl_source="micromasters", published=True
    )
    ids_by_type = {}
    for res_id, res_type in resources.values_list("id", "resource_type"):
        ids_by_type.setdefault(res_type, []).append(res_id)
    resources.update(published=False)
    for res_type, ids in ids_by_type.items():
        bulk_resources_unpublished_actions(ids, res_type)


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0116_learningresourcerun_is_b2b_is_variant"),
    ]

    operations = [
        migrations.RunPython(
            unpublish_micromasters_resources, migrations.RunPython.noop
        ),
    ]
