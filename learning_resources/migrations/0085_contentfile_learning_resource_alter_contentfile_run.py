# Generated by Django 4.2.19 on 2025-03-07 21:24

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0084_rename_edx_block_id_contentfile_edx_module_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="contentfile",
            name="learning_resource",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="resource_content_files",
                to="learning_resources.learningresource",
            ),
        ),
        migrations.AlterField(
            model_name="contentfile",
            name="run",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="content_files",
                to="learning_resources.learningresourcerun",
            ),
        ),
    ]
