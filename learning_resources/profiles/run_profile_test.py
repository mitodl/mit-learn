"""Tests for step 3 of resource profile generation: loading resource profiles"""

from datetime import timedelta

import pytest

from learning_resources.factories import (
    ClaimExtractionFactory,
    ContentFileFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
    UnitContentFileFactory,
    UnitFactory,
)
from learning_resources.models import (
    ClaimEvidence,
    ClaimExtraction,
    ProfileClaim,
    ProfileStatement,
    RunProfile,
    Unit,
    UnitContentFile,
)
from learning_resources.profiles.run_profile import (
    ProfileBuildError,
    build_resource_profile,
    publish_resource_profile,
)
from learning_resources.profiles.sources import text_checksum
from main.utils import now_in_utc

pytestmark = pytest.mark.django_db


def _evidence(source_id="S01", **fields):
    return {
        "source_id": source_id,
        "passage": "a quoted passage here",
        "locator": "p.2",
        "verified": "exact",
        "span_start": 3,
        "span_end": 24,
        **fields,
    }


def _unit_output(files, concepts=(), skills=(), assumed=()):
    return {
        "summary": "The unit teaches mechanics.",
        "concepts": [
            {
                "id": f"c{index}",
                "label": label,
                "description": f"About {label}.",
                "kind": "concept",
                "teaching_status": status,
                "content_file_ref": None,
                "evidence": [_evidence()],
            }
            for index, (label, status) in enumerate(concepts, 1)
        ],
        "skills": [
            {
                "id": f"s{index}",
                "label": label,
                "description": f"Can {label}.",
                "evidence": [_evidence()],
            }
            for index, label in enumerate(skills, 1)
        ],
        "assumed_knowledge": [
            {
                "id": f"a{index}",
                "label": label,
                "description": f"Relies on {label}.",
                "how_used": "in worked examples",
                "flagged_as_prior": True,
                "evidence": [_evidence(), _evidence("S02")],
            }
            for index, label in enumerate(assumed, 1)
        ],
        "assessment_expectations": [],
        "extraction_notes": [],
        "sources": [
            {
                "source_id": f"S{index:02d}",
                "checksum": content_file.checksum,
                "text_checksum": text_checksum(
                    content_file.content, len(content_file.content)
                ),
                "included_chars": len(content_file.content),
                "total_chars": len(content_file.content),
                "truncated": False,
            }
            for index, content_file in enumerate(files, 1)
        ],
    }


def _files(unit, count):
    return [
        UnitContentFileFactory.create(
            unit=unit,
            position=index,
            content_file=ContentFileFactory.create(
                run=unit.run, content=f"text {index} of {unit.title}", published=True
            ),
        ).content_file
        for index in range(count)
    ]


@pytest.fixture
def resource():
    """Return a best run with a context unit and two units, extracted in steps 1-2"""
    resource = LearningResourceFactory.create(is_course=True, runs=[])
    run = LearningResourceRunFactory.create(learning_resource=resource)
    context_unit = UnitFactory.create(
        run=run, kind=Unit.Kind.CONTEXT, position=None, external_id="context"
    )
    first, second = (
        UnitFactory.create(run=run, position=position) for position in (1, 2)
    )
    context_files = _files(context_unit, 1)
    first_files = _files(first, 2)
    second_files = _files(second, 1)
    context = ClaimExtractionFactory.create(
        unit=context_unit,
        output={
            "title": "Physics",
            "stated_audience": [
                {"text": "First-year undergraduates.", "evidence": [_evidence()]}
            ],
            "description": None,
            "objectives": [],
            "prerequisites_status": "stated",
            "prerequisites": [
                {
                    "label": "Calculus I",
                    "statement": "Calculus I is required.",
                    "kind": "prerequisite",
                    "course_ref": "18.01",
                    "evidence": [_evidence()],
                }
            ],
            "required_materials": [],
            "instructional_outline": [],
            "conflicts": [],
            "extraction_notes": ["no syllabus"],
            "sources": _unit_output(context_files)["sources"],
        },
    )
    first_extraction = ClaimExtractionFactory.create(
        unit=first,
        output=_unit_output(
            first_files,
            concepts=[("Newton's second law", "taught"), ("Vectors", "used")],
            skills=["Draw a free-body diagram"],
            assumed=["Derivatives"],
        ),
    )
    second_extraction = ClaimExtractionFactory.create(
        unit=second,
        output=_unit_output(second_files, concepts=[("Derivatives", "reviewed")]),
    )
    run_extraction = ClaimExtractionFactory.create(
        unit=None,
        run=run,
        level=ClaimExtraction.Level.RUN,
        output={
            "summary": "A resource on mechanics.",
            "summary_claim_ids": ["U01:c1", "ctx:aud:0"],
            "audience": [{"text": "First-years.", "claim_ids": ["ctx:aud:0"]}],
            "main_topics": [
                {
                    "label": "Dynamics",
                    "description": "Forces and motion.",
                    "unit_ids": ["U01"],
                    "concept_claim_ids": ["U01:c1"],
                }
            ],
            "learning_outcomes": [
                {"text": "Draw free-body diagrams.", "claim_ids": ["U01:s1"]}
            ],
            "inferred_preparation": [
                {
                    "label": "Derivatives",
                    "description": "Differentiate polynomials.",
                    "rationale": "Used in U01.",
                    "first_needed_unit_id": "U01",
                    "assumed_claim_ids": ["U01:a1"],
                    "taught_before_first_use_claim_ids": [],
                    "taught_after_first_use_claim_ids": ["U02:c1"],
                    "confidence": "high",
                    "only_needed_for_optional_material": False,
                    "review_note": "taught later",
                }
            ],
            "excluded_inferred_preparation": [],
            "coverage_limitations": [
                {"text": "U02 has no assessments.", "claim_ids": ["U02", "ctx:notes"]},
                {"text": "Truncated: 1.", "claim_ids": [], "from_code": True},
            ],
            "extraction_notes": [],
            "units": [
                {
                    "unit_id": f"U0{index}",
                    "unit": unit.id,
                    "extraction": extraction.id,
                    "title": unit.title,
                    "kind": unit.kind,
                }
                for index, (unit, extraction) in enumerate(
                    [(first, first_extraction), (second, second_extraction)], 1
                )
            ],
            "context_extraction": context.id,
        },
    )
    return {
        "resource": resource,
        "run": run,
        "units": (context_unit, first, second),
        "files": (context_files, first_files, second_files),
        "extractions": (context, first_extraction, second_extraction),
        "run_extraction": run_extraction,
    }


def _statements(profile, section):
    return list(profile.statements.filter(section=section).order_by("position"))


def test_build_resource_profile_claims(resource):
    """Each unit and context claim is loaded, with its evidence"""
    profile, built = build_resource_profile(resource["run_extraction"])

    assert built is True
    assert profile.status == RunProfile.Status.READY
    assert profile.run == resource["run"]
    assert profile.resource_extraction == resource["run_extraction"]
    context_unit, first, second = resource["units"]
    context, first_extraction, _ = resource["extractions"]
    claims = {claim.display_id: claim for claim in profile.claims.all()}
    assert set(claims) == {
        "ctx:aud:0",
        "ctx:prereq:0",
        "U01:c1",
        "U01:c2",
        "U01:s1",
        "U01:a1",
        "U02:c1",
        "run:outcome:0",
        "run:prior:0",
    }
    concept = claims["U01:c1"]
    assert concept.uid == f"u:{first_extraction.key[:12]}:{first.id}:c1"
    assert concept.kind == ProfileClaim.Kind.CONCEPT
    assert concept.level == ProfileClaim.Level.UNIT
    assert concept.label == "Newton's second law"
    assert concept.description == "About Newton's second law."
    assert concept.unit == first
    assert concept.extraction == first_extraction
    assert concept.data == {
        "kind": "concept",
        "teaching_status": "taught",
        "content_file_ref": None,
    }
    assert claims["U01:a1"].kind == ProfileClaim.Kind.ASSUMED
    assert claims["U01:a1"].data["how_used"] == "in worked examples"
    assert claims["U02:c1"].unit == second
    prerequisite = claims["ctx:prereq:0"]
    assert prerequisite.kind == ProfileClaim.Kind.CONTEXT
    assert prerequisite.uid == (f"u:{context.key[:12]}:{context_unit.id}:ctx:prereq:0")
    assert prerequisite.label == "Calculus I"
    assert prerequisite.description == "Calculus I is required."
    assert prerequisite.unit == context_unit
    assert prerequisite.data == {
        "field": "prerequisites",
        "kind": "prerequisite",
        "course_ref": "18.01",
    }
    assert claims["ctx:aud:0"].label == "First-year undergraduates."
    assert claims["ctx:aud:0"].data == {"field": "stated_audience"}

    _, first_files, _ = resource["files"]
    evidence = list(claims["U01:a1"].evidence.order_by("id"))
    assert [item.content_file for item in evidence] == first_files
    assert evidence[0].content_checksum == first_files[0].checksum
    assert evidence[0].passage == "a quoted passage here"
    assert evidence[0].locator == "p.2"
    assert evidence[0].verified == "exact"
    assert (evidence[0].span_start, evidence[0].span_end) == (3, 24)
    assert (
        claims["ctx:prereq:0"].evidence.get().content_file == (resource["files"][0][0])
    )


def test_build_resource_profile_run_claims(resource):
    """The run output's outcomes and preparation are run claims citing claims"""
    profile, _ = build_resource_profile(resource["run_extraction"])

    run_extraction = resource["run_extraction"]
    claims = {claim.display_id: claim for claim in profile.claims.all()}
    outcome = claims["run:outcome:0"]
    assert outcome.uid == f"r:{run_extraction.key[:12]}:outcome:0"
    assert outcome.level == ProfileClaim.Level.RUN
    assert outcome.kind == ProfileClaim.Kind.OUTCOME
    assert outcome.label == "Draw free-body diagrams."
    assert outcome.description == "Draw free-body diagrams."
    assert outcome.unit is None
    assert outcome.extraction == run_extraction
    assert outcome.data == {"claim_ids": ["U01:s1"]}
    assert list(outcome.cites.all()) == [claims["U01:s1"]]
    assert not outcome.evidence.exists()

    prior = claims["run:prior:0"]
    assert prior.level == ProfileClaim.Level.RUN
    assert prior.kind == ProfileClaim.Kind.PRIOR
    assert prior.label == "Derivatives"
    assert prior.description == "Differentiate polynomials."
    assert prior.data["rationale"] == "Used in U01."
    assert prior.data["taught_after_first_use_claim_ids"] == ["U02:c1"]
    assert "label" not in prior.data
    assert "description" not in prior.data
    assert set(prior.cites.all()) == {claims["U01:a1"], claims["U02:c1"]}
    assert list(claims["U02:c1"].cited_by.all()) == [prior]

    # every other claim is a unit-level one
    assert {
        claim.display_id
        for claim in profile.claims.filter(level=ProfileClaim.Level.RUN)
    } == {"run:outcome:0", "run:prior:0"}


def test_build_resource_profile_statements(resource):
    """Each item of the run output is a statement citing its claims and units"""
    profile, _ = build_resource_profile(resource["run_extraction"])

    _, first, second = resource["units"]
    claims = {claim.display_id: claim for claim in profile.claims.all()}
    (summary,) = _statements(profile, ProfileStatement.Section.SUMMARY)
    assert summary.text == "A resource on mechanics."
    assert set(summary.claims.all()) == {claims["U01:c1"], claims["ctx:aud:0"]}
    (audience,) = _statements(profile, ProfileStatement.Section.AUDIENCE)
    assert audience.text == "First-years."
    assert list(audience.claims.all()) == [claims["ctx:aud:0"]]
    (outcome,) = _statements(profile, ProfileStatement.Section.OUTCOME)
    assert list(outcome.claims.all()) == [claims["U01:s1"]]
    (topic,) = _statements(profile, ProfileStatement.Section.TOPIC)
    assert topic.text == "Forces and motion."
    assert topic.data["label"] == "Dynamics"
    assert list(topic.claims.all()) == [claims["U01:c1"]]
    assert list(topic.units.all()) == [first]
    (preparation,) = _statements(profile, ProfileStatement.Section.PREPARATION)
    assert preparation.text == "Differentiate polynomials."
    assert preparation.data["label"] == "Derivatives"
    assert preparation.data["review_note"] == "taught later"
    assert set(preparation.claims.all()) == {claims["U01:a1"], claims["U02:c1"]}
    assert set(preparation.units.all()) == {first, second}
    limitations = _statements(profile, ProfileStatement.Section.LIMITATION)
    assert [statement.position for statement in limitations] == [0, 1]
    # a cited unit id links the unit; ctx:notes stays in the data
    assert list(limitations[0].units.all()) == [second]
    assert not limitations[0].claims.exists()
    assert limitations[0].data["claim_ids"] == ["U02", "ctx:notes"]
    assert limitations[1].data == {"claim_ids": [], "from_code": True}


def test_changed_file_evidence_left_out(resource):
    """Evidence whose source file changed since it was read is left out"""
    _, first_files, _ = resource["files"]
    first_files[1].content = "new text"
    first_files[1].save()

    profile, _ = build_resource_profile(resource["run_extraction"])

    assumed = profile.claims.get(display_id="U01:a1")
    assert [item.content_file for item in assumed.evidence.all()] == [first_files[0]]


@pytest.mark.parametrize(
    "change",
    [
        # whitespace around the text, which is stripped before it is read
        lambda content: f"\n  {content}\n\n",
        # text after the part read, which a truncated source never saw
        lambda content: f"{content} and more text past the cut",
    ],
)
def test_unread_file_change_keeps_evidence(resource, change):
    """
    Evidence is kept when its file's raw content changed but the text its
    source read didn't, since the extraction is still the one for that text
    """
    _, first_files, _ = resource["files"]
    extraction = resource["extractions"][1]
    first_files[1].content = change(first_files[1].content)
    first_files[1].save()
    assert first_files[1].checksum != extraction.output["sources"][1]["checksum"]

    profile, _ = build_resource_profile(resource["run_extraction"])

    assumed = profile.claims.get(display_id="U01:a1")
    evidence = list(assumed.evidence.order_by("id"))
    assert [item.content_file for item in evidence] == first_files
    assert evidence[1].content_checksum == first_files[1].checksum


@pytest.mark.parametrize("checksum_matches", [True, False])
def test_source_without_text_checksum(resource, checksum_matches):
    """A source stored without text_checksum is checked by the file's checksum"""
    _, first_files, _ = resource["files"]
    extraction = resource["extractions"][1]
    source = extraction.output["sources"][1]
    del source["text_checksum"]
    if not checksum_matches:
        source["checksum"] = "stale"
    extraction.save()

    profile, _ = build_resource_profile(resource["run_extraction"])

    assumed = profile.claims.get(display_id="U01:a1")
    assert [item.content_file for item in assumed.evidence.order_by("id")] == (
        first_files if checksum_matches else first_files[:1]
    )


def test_shared_extraction_uids(resource):
    """
    Units sharing an extraction get claims with uids of their own, which
    don't depend on whether the extraction is shared
    """
    _, first, second = resource["units"]
    _, first_extraction, _ = resource["extractions"]
    profile, _ = build_resource_profile(resource["run_extraction"])
    first_uids = dict(
        profile.claims.filter(unit=first).values_list("display_id", "uid")
    )
    output = resource["run_extraction"].output
    output["units"][1]["extraction"] = output["units"][0]["extraction"]
    resource["run_extraction"].save()

    profile, _ = build_resource_profile(resource["run_extraction"])

    uids = list(profile.claims.values_list("uid", flat=True))
    assert len(uids) == len(set(uids))
    assert (
        dict(profile.claims.filter(unit=first).values_list("display_id", "uid"))
        == first_uids
    )
    assert profile.claims.get(display_id="U02:c1", unit=second).uid == (
        f"u:{first_extraction.key[:12]}:{second.id}:c1"
    )


def test_shared_context_extraction(resource):
    """
    A context extraction stored by another run's context unit is loaded for
    this run's context unit and its files
    """
    context_unit, _, _ = resource["units"]
    context_files, _, _ = resource["files"]
    context, _, _ = resource["extractions"]
    other_run = LearningResourceRunFactory.create(
        learning_resource=resource["resource"]
    )
    other_unit = UnitFactory.create(
        run=other_run, kind=Unit.Kind.CONTEXT, position=None, external_id="context"
    )
    _files(other_unit, 1)
    context.unit = other_unit
    context.save()

    profile, _ = build_resource_profile(resource["run_extraction"])

    prerequisite = profile.claims.get(display_id="ctx:prereq:0")
    assert prerequisite.unit == context_unit
    assert prerequisite.evidence.get().content_file == context_files[0]


def test_context_extraction_without_context_unit(resource):
    """A run with a context extraction but no context unit can't be built"""
    context_unit, _, _ = resource["units"]
    Unit.objects.filter(id=context_unit.id).update(kind=Unit.Kind.UNIT)

    with pytest.raises(ProfileBuildError, match="no context unit"):
        build_resource_profile(resource["run_extraction"])


def test_profile_not_rebuilt_when_current(resource):
    """A profile is rebuilt only when its run extraction changed, or forced"""
    profile, _ = build_resource_profile(resource["run_extraction"])
    claim_ids = set(profile.claims.values_list("id", flat=True))

    assert build_resource_profile(resource["run_extraction"]) == (profile, False)
    assert set(profile.claims.values_list("id", flat=True)) == claim_ids

    _, built = build_resource_profile(resource["run_extraction"], force=True)
    assert built is True
    assert not claim_ids & set(profile.claims.values_list("id", flat=True))

    resource["run_extraction"].output["summary"] = "New summary."
    resource["run_extraction"].save()
    _, built = build_resource_profile(resource["run_extraction"])
    assert built is True
    assert profile.statements.get(section="summary").text == "New summary."
    assert RunProfile.objects.count() == 1


@pytest.mark.parametrize("replace", ["delete", "unpublish", "unpublish_unlink"])
def test_profile_rebuilt_when_file_recreated(resource, replace):
    """
    A profile whose evidence quotes a content file that was replaced, by a
    new file with the same text, is rebuilt though its extractions are
    unchanged: whether the old file was deleted, or unpublished as ETL does,
    and whether or not its link to the unit was removed
    """
    _, first_files, _ = resource["files"]
    profile, _ = build_resource_profile(resource["run_extraction"])
    assert (
        profile.row_counts["evidence"]
        == ClaimEvidence.objects.filter(claim__profile=profile).count()
    )
    old = first_files[1]
    link = UnitContentFile.objects.get(content_file=old)
    new = ContentFileFactory.create(run=old.run, content=old.content, published=True)
    UnitContentFileFactory.create(
        unit=link.unit, content_file=new, position=link.position
    )
    if replace == "delete":
        old.delete()
    else:
        old.published = False
        old.save()
        if replace == "unpublish_unlink":
            link.delete()

    profile, built = build_resource_profile(resource["run_extraction"])

    assert built is True
    assumed = profile.claims.get(display_id="U01:a1")
    assert [item.content_file for item in assumed.evidence.order_by("id")] == [
        first_files[0],
        new,
    ]
    assert build_resource_profile(resource["run_extraction"]) == (profile, False)


@pytest.mark.parametrize("unpublished", [0, 1])
@pytest.mark.parametrize("force", [True, False])
def test_published_run_extraction_with_unpublished_references(
    resource, unpublished, force
):
    """
    A published run extraction whose unit or context extraction was
    regenerated, and so unpublished, by a sweep that then failed isn't built,
    and the run's last profile is left as it was
    """
    extractions = [*resource["extractions"], resource["run_extraction"]]
    ClaimExtraction.objects.filter(id__in=[e.id for e in extractions]).update(
        published=True
    )
    resource["run_extraction"].refresh_from_db()
    profile, _ = build_resource_profile(resource["run_extraction"])
    claims = set(profile.claims.values_list("id", flat=True))
    replaced = resource["extractions"][unpublished]
    ClaimExtraction.objects.filter(id=replaced.id).update(published=False)

    with pytest.raises(
        ProfileBuildError, match=f"unpublished extractions {replaced.id}"
    ):
        build_resource_profile(resource["run_extraction"], force=force)

    profile.refresh_from_db()
    assert profile.status == RunProfile.Status.READY
    assert set(profile.claims.values_list("id", flat=True)) == claims


def test_unpublished_run_extraction_with_unpublished_references(resource):
    """An unpublished run extraction, as in tests or mid-sweep, is built"""
    _, built = build_resource_profile(resource["run_extraction"])

    assert built is True


def test_build_failure_keeps_last_profile(resource, mocker):
    """A failed build keeps the last profile's claims and marks it stale"""
    profile, _ = build_resource_profile(resource["run_extraction"])
    claims = set(profile.claims.values_list("id", flat=True))
    RunProfile.objects.filter(id=profile.id).update(
        updated_on=now_in_utc() - timedelta(days=1)
    )
    mocker.patch(
        "learning_resources.profiles.run_profile._save_statements",
        side_effect=ValueError("bad"),
    )

    with pytest.raises(ValueError, match="bad"):
        build_resource_profile(resource["run_extraction"])

    profile.refresh_from_db()
    assert profile.status == RunProfile.Status.STALE
    assert set(profile.claims.values_list("id", flat=True)) == claims

    mocker.stopall()
    assert build_resource_profile(resource["run_extraction"]) == (profile, True)
    profile.refresh_from_db()
    assert profile.status == RunProfile.Status.READY


def test_build_failure_without_profile(resource):
    """A run without a profile gets a failed one when building fails"""
    resource["units"][2].delete()

    with pytest.raises(ProfileBuildError, match="unit"):
        build_resource_profile(resource["run_extraction"])

    profile = RunProfile.objects.get(run=resource["run"])
    assert profile.status == RunProfile.Status.FAILED
    assert not profile.claims.exists()


def test_build_rejects_unit_extraction(resource):
    """Only a run-level extraction makes a profile"""
    with pytest.raises(ValueError, match="run-level"):
        build_resource_profile(resource["extractions"][1])


def test_publish_resource_profile(resource):
    """The best run's profile is built and the resource's other profiles deleted"""
    old_run = LearningResourceRunFactory.create(learning_resource=resource["resource"])
    old_profile = RunProfile.objects.create(run=old_run)
    other_resource = RunProfile.objects.create(run=LearningResourceRunFactory.create())

    assert (
        publish_resource_profile(resource["resource"], resource["run_extraction"])
        is True
    )

    assert set(RunProfile.objects.values_list("id", flat=True)) == {
        RunProfile.objects.get(run=resource["run"]).id,
        other_resource.id,
    }
    assert not RunProfile.objects.filter(id=old_profile.id).exists()


def test_publish_resource_profile_failure_keeps_other_runs(resource):
    """
    A failed build of the best run's profile keeps the profiles of the
    resource's other runs, so the resource keeps its last ready profile
    """
    old_run = LearningResourceRunFactory.create(learning_resource=resource["resource"])
    old_profile = RunProfile.objects.create(run=old_run, status=RunProfile.Status.READY)
    resource["units"][2].delete()

    with pytest.raises(ProfileBuildError, match="unit"):
        publish_resource_profile(resource["resource"], resource["run_extraction"])

    old_profile.refresh_from_db()
    assert old_profile.status == RunProfile.Status.READY
    profile = RunProfile.objects.get(run=resource["run"])
    assert profile.status == RunProfile.Status.FAILED


def test_publish_resource_profile_without_extraction(resource):
    """A resource without a run extraction has no profile"""
    build_resource_profile(resource["run_extraction"])

    assert publish_resource_profile(resource["resource"], None) is None

    assert not RunProfile.objects.exists()
    assert not ProfileClaim.objects.exists()
    assert not ClaimEvidence.objects.exists()
