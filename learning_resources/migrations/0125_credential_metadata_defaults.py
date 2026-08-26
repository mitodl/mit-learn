from django.contrib.auth.models import Group
from django.db import migrations

from learning_resources import constants

# The prompts as agreed with the credential program. Seeded rather than
# hardcoded: they will be retuned far more often than a deploy, so from here on
# they are admin-editable data. Budgets differ per field because a 1-2 sentence
# description is diluted by a large context, while criteria and learning goals
# benefit from one.
DEFAULT_CONFIGURATIONS = [
    {
        "field": constants.CredentialMetadataField.description.name,
        "prompt": (
            "Generate an Open Badges 3.0 description field with this content"
            " in 1-2 sentences."
        ),
        "max_context_tokens": 4000,
        "max_output_tokens": 300,
    },
    {
        "field": constants.CredentialMetadataField.criteria.name,
        "prompt": (
            "Generate an Open Badges 3.0 criteria field with skills focused"
            " bullet points that demonstrate what the learner did to complete"
            " the course."
        ),
        "max_context_tokens": 16000,
        "max_output_tokens": 1024,
    },
    {
        "field": constants.CredentialMetadataField.learning_goals.name,
        "prompt": (
            "Please generate 10 learning goals for this course with a focus on"
            " skills, knowledge and abilities that will be gained upon"
            " completion."
        ),
        "max_context_tokens": 16000,
        "max_output_tokens": 1024,
    },
]

DEFAULT_LLM_MODEL = "gpt-4o-mini"


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
        ("learning_resources", "0124_credential_metadata"),
    ]

    operations = [
        migrations.RunPython(
            add_credential_metadata_defaults, remove_credential_metadata_defaults
        ),
    ]
