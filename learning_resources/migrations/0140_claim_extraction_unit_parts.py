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

CONTEXT_MERGE_SYSTEM = """You are an expert curriculum analyst combining extraction records for a course's context
(the syllabus, course information and other course-wide material) that was too long to read in one pass. You receive
the records for each part, in order. Each item carries an id like P1:aud2 (part 1, stated audience 2), P1:desc1
(description), P2:obj1 (objective), P1:pre3 (prerequisite), P2:req1 (required material), P1:out4 (outline entry) or
P2:cs1 (a statement in one of the part's conflicts).

Produce one record for the whole course context, in the same format as a single-part one:
- title: the course title as the sources give it.
- stated_audience, objectives and required_materials: merge statements that say the same thing, even in other
  words, into one. Keep statements apart when they say different things, however small the difference in their
  wording: "Know C" and "Know C++" are different statements.
- description: the description that best describes the course, citing the parts' descriptions it draws on.
- prerequisites: merge prerequisites that are the same requirement (the same knowledge and kind, and the same
  course when one is named), even when stated in other words.
- instructional_outline: the outline entries in course order, without repeats.
- conflicts: statements that disagree, in one part or between parts, for example one part saying exams are 50% of
  the grade and another 40%. Each conflict has at least two statements, and the parts' conflicts are kept.
- extraction_notes: combine the parts' notes.
Account for every part item: cite it in a merged item. Every merged item must list, in part_claim_ids, the part item
ids it comes from, and only items of the same list: audience items cite audience ids, and so on; a conflict's
statements may cite statements of any list, and conflict statements. Do not write new evidence: evidence is carried
over from the cited part items. Do not add items that no part item supports.
"""  # noqa: E501

DEFAULT_LLM_MODEL = "gpt-6-luna"
DEFAULT_REASONING_EFFORT = "none"
# the settings a merge stage takes from the stage whose parts it merges
MODEL_FIELDS = (
    "llm_model",
    "reasoning_effort",
    "temperature",
    "max_tokens",
    "max_completion_tokens",
)
# merge stage: (the stage whose parts it merges, its system prompt)
MERGE_STAGES = {
    "unit_merge": ("unit", UNIT_MERGE_SYSTEM),
    "context_merge": ("context", CONTEXT_MERGE_SYSTEM),
}


def add_merge_configurations(apps, schema_editor):
    """Seed the merge stages' configurations, using their stages' models"""
    Configuration = apps.get_model("learning_resources", "ResourceProfileConfiguration")
    for stage, (source_stage, prompt) in MERGE_STAGES.items():
        source = Configuration.objects.filter(stage=source_stage).first()
        Configuration.objects.get_or_create(
            stage=stage,
            defaults={
                "prompt": prompt,
                **(
                    {field: getattr(source, field) for field in MODEL_FIELDS}
                    if source
                    else {
                        "llm_model": DEFAULT_LLM_MODEL,
                        "reasoning_effort": DEFAULT_REASONING_EFFORT,
                    }
                ),
            },
        )


def remove_merge_configurations(apps, schema_editor):
    """Delete the merge stages' configurations"""
    Configuration = apps.get_model("learning_resources", "ResourceProfileConfiguration")
    Configuration.objects.filter(stage__in=MERGE_STAGES).delete()


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
                    ("context_merge", "Context merge"),
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
                " into parts that are extracted separately and then merged. For the"
                " merge stages, the most tokens a merge call may take; a unit whose"
                " merge call is over it is skipped and logged as an error.",
            ),
        ),
        migrations.AddField(
            model_name="resourceprofileconfiguration",
            name="max_parts",
            field=models.PositiveIntegerField(
                default=10,
                help_text="Most parts a unit over the input budget may be split"
                " into; each part is a call of its own. A unit that would need"
                " more is skipped. 1 turns splitting off. Only the unit and"
                " context stages use it.",
            ),
        ),
        migrations.RunPython(add_merge_configurations, remove_merge_configurations),
    ]
