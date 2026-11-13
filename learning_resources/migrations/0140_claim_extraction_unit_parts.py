from django.db import migrations, models

UNIT_MERGE_SYSTEM = """You are an expert curriculum analyst combining extraction records for one instructional unit
that was too long to read in one pass. You receive the course outline and the records for each part of the unit, in
unit order. Each claim carries an id like P2:c4 (part 2, concept 4), P1:s2 (skill), P3:a1 (assumed knowledge) or
P2:t1 (assessment expectation).

Produce one record for the whole unit, in the same format as a single-part unit:
- summary: 3-5 sentences on what the whole unit teaches.
- concepts: merge claims that name the same concept, even in other words or with other capitalization, into one
  canonical label. Keep claims apart when they mean different things, however small the difference in their labels:
  C and C++ are different concepts. A concept's status is the strongest it has in any part (taught > reviewed > used >
  mentioned).
- skills and assessment_expectations: merge duplicates the same way.
- assumed_knowledge: keep an item only if no part teaches or reviews it. Keep flagged_as_prior=true if any part set it.
- taught_assumed_knowledge: list each part's assumed item that you leave out because a part teaches or reviews it,
  with the ids of the concepts, with status taught or reviewed, that teach or review it.
- extraction_notes: combine the parts' notes.
Account for every part claim: cite it in a merged claim or, for assumed knowledge, list it in
taught_assumed_knowledge. Every merged claim must list, in part_claim_ids, the part claim ids it comes from, and only
claims of the same list: concepts cite concept ids, skills cite skill ids, and so on. Do not write new evidence:
evidence is carried over from the cited part claims. Do not add claims that no part claim supports.
"""  # noqa: E501

DEFAULT_LLM_MODEL = "gpt-6-luna"
DEFAULT_REASONING_EFFORT = "none"
# the settings the unit merge stage takes from the unit stage
MODEL_FIELDS = (
    "llm_model",
    "reasoning_effort",
    "temperature",
    "max_tokens",
    "max_completion_tokens",
)


def add_unit_merge_configuration(apps, schema_editor):
    """Seed the unit merge stage's configuration, using the unit stage's model"""
    Configuration = apps.get_model("learning_resources", "ResourceProfileConfiguration")
    unit = Configuration.objects.filter(stage="unit").first()
    Configuration.objects.get_or_create(
        stage="unit_merge",
        defaults={
            "prompt": UNIT_MERGE_SYSTEM,
            **(
                {field: getattr(unit, field) for field in MODEL_FIELDS}
                if unit
                else {
                    "llm_model": DEFAULT_LLM_MODEL,
                    "reasoning_effort": DEFAULT_REASONING_EFFORT,
                }
            ),
        },
    )


def remove_unit_merge_configuration(apps, schema_editor):
    """Delete the unit merge stage's configuration"""
    Configuration = apps.get_model("learning_resources", "ResourceProfileConfiguration")
    Configuration.objects.filter(stage="unit_merge").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0139_claim_extraction_run_level"),
    ]

    operations = [
        migrations.AlterField(
            model_name="claimextraction",
            name="level",
            field=models.CharField(
                choices=[("unit", "Unit"), ("unit_part", "Unit part"), ("run", "Run")],
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="claimextraction",
            name="part",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="resourceprofileconfiguration",
            name="stage",
            field=models.CharField(
                choices=[
                    ("context", "Context"),
                    ("unit", "Unit"),
                    ("unit_merge", "Unit merge"),
                    ("run", "Run"),
                ],
                max_length=16,
                unique=True,
            ),
        ),
        migrations.AlterField(
            model_name="resourceprofileconfiguration",
            name="input_token_budget",
            field=models.PositiveIntegerField(
                default=100000,
                help_text="Most file text one call may read. A unit over it is split"
                " into parts that are extracted separately and then merged; a context"
                " unit over it is skipped. For the unit merge stage, the most tokens a"
                " merge call may take; a unit whose merge call is over it is skipped"
                " and logged as an error.",
            ),
        ),
        migrations.AddField(
            model_name="resourceprofileconfiguration",
            name="max_parts",
            field=models.PositiveIntegerField(
                default=10,
                help_text="Most parts a unit over the input budget may be split"
                " into; each part is a call of its own. A unit that would need"
                " more is skipped. 1 turns splitting off. Only the unit stage uses"
                " it.",
            ),
        ),
        migrations.RunPython(
            add_unit_merge_configuration, remove_unit_merge_configuration
        ),
    ]
