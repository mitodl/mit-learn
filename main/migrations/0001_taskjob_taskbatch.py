import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="TaskJob",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_on", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                ("task_name", models.CharField(db_index=True, max_length=255)),
                ("params", models.JSONField(default=dict)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("queued", "Queued"),
                            ("running", "Running"),
                            ("finishing", "Finishing"),
                            ("succeeded", "Succeeded"),
                            ("failed", "Failed"),
                        ],
                        db_index=True,
                        default="queued",
                        max_length=20,
                    ),
                ),
                ("error", models.TextField(blank=True)),
            ],
            options={
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="TaskBatch",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_on", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                ("batch_key", models.CharField(max_length=255)),
                ("kind", models.CharField(max_length=64)),
                ("params", models.JSONField(default=dict)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("queued", "Queued"),
                            ("running", "Running"),
                            ("succeeded", "Succeeded"),
                            ("failed", "Failed"),
                        ],
                        db_index=True,
                        default="queued",
                        max_length=20,
                    ),
                ),
                ("error", models.TextField(blank=True)),
                (
                    "job",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="batches",
                        to="main.taskjob",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="taskbatch",
            index=models.Index(
                fields=["job", "status"], name="taskbatch_job_status_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="taskbatch",
            constraint=models.UniqueConstraint(
                fields=("job", "batch_key"), name="unique_task_batch_key"
            ),
        ),
    ]
