# Generated by Django 4.2.16 on 2024-09-25 18:26

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources_search", "0004_alter_percolatequery_source_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="percolatequery",
            name="display_label",
            field=models.CharField(
                blank=True,
                help_text="Friendly display label for the query",
                max_length=255,
            ),
        ),
    ]