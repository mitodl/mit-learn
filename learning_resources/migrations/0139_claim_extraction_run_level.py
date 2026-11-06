import django.db.models.deletion
from django.db import migrations, models

RUN_SYSTEM = """You are an expert curriculum analyst synthesising a reviewable course profile from (a) the extracted
course context and (b) per-unit extraction records, each claim carrying an id like U03:c2 (concept), U03:s1 (skill),
U03:a4 (assumed knowledge), U03:t1 (assessment expectation), and context claims like ctx:prereq:0, ctx:aud:0,
ctx:obj:0, ctx:desc, ctx:req:0, ctx:conflict:0.

Units (U01, U02, ...) are given in course order.

Rules
- Every statement you make must list the claim ids that support it. Do not introduce facts that no claim supports.
- learning_outcomes: specific, assessable outcomes grounded in skill/concept claims (taught or reviewed only) and
  assessment expectations. Do not present an assessment expectation as proof the course teaches something unless a
  taught/reviewed claim also supports it.
- inferred_preparation: knowledge a learner needs BEFORE STARTING the course. Start from assumed-knowledge claims.
  For each candidate, list in taught_in_claim_ids every concept claim with status taught/reviewed, in any unit, that
  teaches or reviews the same knowledge, even when it is worded differently. A narrower, broader or merely related
  topic is not the same knowledge. Whether that teaching comes before the knowledge is first needed is checked
  separately, so list it wherever it is. A review/"Week 0" module or recitation provided by the course counts as
  taught by the course.
  Items assumed only by optional or supplementary material (deep dives) must set only_needed_for_optional_material.
  Never copy declared prerequisites here; those are reported separately. Merge duplicates into canonical labels.
- coverage_limitations: what the evidence does not cover (materials not processed, units without assessments,
  transcripts only, missing solutions), each tied to claim ids or unit ids where possible (use 'ctx:notes' if none).
- main_topics: 6-14 topics that group the taught concepts, each tied to unit ids and concept claim ids.
Write plainly; a subject-matter expert will review this.
"""  # noqa: E501

DEFAULT_LLM_MODEL = "gpt-6-luna"
DEFAULT_REASONING_EFFORT = "none"


def add_run_configuration(apps, schema_editor):
    """Seed the run stage's configuration"""
    Configuration = apps.get_model("learning_resources", "ResourceProfileConfiguration")
    Configuration.objects.get_or_create(
        stage="run",
        defaults={
            "llm_model": DEFAULT_LLM_MODEL,
            "reasoning_effort": DEFAULT_REASONING_EFFORT,
            "prompt": RUN_SYSTEM,
        },
    )


def remove_run_configuration(apps, schema_editor):
    """Delete the run stage's configuration"""
    Configuration = apps.get_model("learning_resources", "ResourceProfileConfiguration")
    Configuration.objects.filter(stage="run").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("learning_resources", "0138_claim_extraction_published"),
    ]

    operations = [
        migrations.AlterField(
            model_name="claimextraction",
            name="level",
            field=models.CharField(
                choices=[("unit", "Unit"), ("run", "Run")], max_length=16
            ),
        ),
        migrations.AddField(
            model_name="claimextraction",
            name="run",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="claim_extractions",
                to="learning_resources.learningresourcerun",
            ),
        ),
        migrations.AlterField(
            model_name="resourceprofileconfiguration",
            name="stage",
            field=models.CharField(
                choices=[("context", "Context"), ("unit", "Unit"), ("run", "Run")],
                max_length=16,
                unique=True,
            ),
        ),
        migrations.RunPython(add_run_configuration, remove_run_configuration),
    ]
