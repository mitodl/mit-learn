# Generated by Django 4.2.11 on 2024-04-04 21:11

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources_search", "0001_initial"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="percolatequery",
            unique_together={("source_type", "query")},
        ),
    ]
