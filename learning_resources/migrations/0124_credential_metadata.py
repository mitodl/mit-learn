import django.contrib.postgres.fields
import django.db.models.deletion
from django.conf import settings
from django.contrib.auth.models import Group
from django.db import migrations, models

from learning_resources import constants

# The prompts as agreed with the credential program. Seeded rather than
# hardcoded: they will be retuned far more often than a deploy, so from here on
# they are admin-editable data.
DEFAULT_CONFIGURATIONS = [
    {
        "field": constants.CredentialMetadataField.description.name,
        "prompt": (
            "Generate an Open Badges 3.0 description field with this content"
            " in 1-2 sentences."
        ),
        "max_output_tokens": 300,
    },
    {
        "field": constants.CredentialMetadataField.criteria.name,
        "prompt": (
            "Generate an Open Badges 3.0 criteria field with skills focused"
            " bullet points that demonstrate what the learner did to complete"
            " the course."
        ),
        "max_output_tokens": 1024,
        "retrieval_query": (
            "course learning outcomes, skills gained, assessment and grading"
            " criteria, syllabus"
        ),
    },
]

DEFAULT_LLM_MODEL = "gpt-5"


def add_credential_metadata_defaults(apps, schema_editor):
    """
    Create the course authors group and seed one configuration per field
    """
    Group.objects.get_or_create(name=constants.GROUP_COURSE_AUTHORS)
    Configuration = apps.get_model(
        "learning_resources", "CredentialMetadataConfiguration"
    )
    for configuration in DEFAULT_CONFIGURATIONS:
        Configuration.objects.get_or_create(
            field=configuration["field"],
            defaults={"llm_model": DEFAULT_LLM_MODEL, **configuration},
        )


def remove_credential_metadata_defaults(apps, schema_editor):
    """
    Delete the course authors group and the seeded configurations
    """
    Group.objects.filter(name=constants.GROUP_COURSE_AUTHORS).delete()
    Configuration = apps.get_model(
        "learning_resources", "CredentialMetadataConfiguration"
    )
    Configuration.objects.filter(
        field__in=[configuration["field"] for configuration in DEFAULT_CONFIGURATIONS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0123_contentfile_dedupe_partial_unique_constraints"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CredentialMetadataConfiguration",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_on", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                (
                    "field",
                    models.CharField(
                        choices=[
                            ("description", "Description"),
                            ("criteria", "Criteria"),
                        ],
                        help_text="The metadata field this row configures.",
                        max_length=32,
                        unique=True,
                    ),
                ),
                (
                    "llm_model",
                    models.CharField(
                        help_text="Add any OpenAI LLM model.",
                        max_length=128,
                        verbose_name="LLM Model",
                    ),
                ),
                (
                    "prompt",
                    models.TextField(
                        help_text="Appended to the assembled course context."
                    ),
                ),
                ("temperature", models.FloatField(default=0.0)),
                ("max_output_tokens", models.PositiveIntegerField(default=2048)),
                (
                    "retrieval_query",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text=(
                            "Vector search query for course content."
                            " Blank generates from the marketing page and"
                            " metadata alone."
                        ),
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="CredentialMetadataGenerationLog",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_on", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_on", models.DateTimeField(auto_now=True)),
                (
                    "field",
                    models.CharField(
                        choices=[
                            ("description", "Description"),
                            ("criteria", "Criteria"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "response",
                    models.JSONField(
                        blank=True,
                        help_text="The structured response, or null on failure.",
                        null=True,
                    ),
                ),
                (
                    "error",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="The error message, if generation failed.",
                    ),
                ),
                ("prompt_text", models.TextField()),
                ("llm_model", models.CharField(max_length=128)),
                ("temperature", models.FloatField(blank=True, null=True)),
                (
                    "context_text",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="The full context sent to the model.",
                    ),
                ),
                ("context_tokens", models.PositiveIntegerField(default=0)),
                (
                    "retrieved_point_ids",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=64),
                        blank=True,
                        default=list,
                        size=None,
                    ),
                ),
                ("latency_ms", models.PositiveIntegerField(blank=True, null=True)),
                (
                    "generated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "learning_resource",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="credential_metadata_generation_logs",
                        to="learning_resources.learningresource",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["learning_resource", "field", "-created_on"],
                        name="learning_re_learnin_132835_idx",
                    )
                ],
            },
        ),
        migrations.RunPython(
            add_credential_metadata_defaults, remove_credential_metadata_defaults
        ),
    ]
