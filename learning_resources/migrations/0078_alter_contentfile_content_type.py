# Generated by Django 4.2.16 on 2024-12-03 00:46

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "learning_resources",
            "0077_contentfile_file_extension_contentfile_source_path",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="contentfile",
            name="content_type",
            field=models.CharField(
                choices=[
                    ("page", "page"),
                    ("file", "file"),
                    ("video", "video"),
                    ("pdf", "pdf"),
                ],
                default="file",
                max_length=10,
            ),
        ),
    ]