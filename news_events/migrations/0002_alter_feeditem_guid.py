# Generated by Django 4.2.11 on 2024-03-25 13:41

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("news_events", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="feeditem",
            name="guid",
            field=models.CharField(max_length=2048, unique=True),
        ),
        migrations.AlterField(
            model_name="feedimage",
            name="url",
            field=models.URLField(blank=True),
        ),
    ]
