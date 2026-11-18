"""Tests for step 3 of resource profile generation: loading course profiles"""

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
    CourseProfile,
    ProfileClaim,
    ProfileStatement,
    Unit,
)
from learning_resources.profiles.course_profile import (
    ProfileBuildError,
    build_course_profile,
    publish_course_profile,
)
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
                "included_chars": 10,
                "total_chars": 10,
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
def course():
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
            "summary": "A course on mechanics.",
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


def test_build_course_profile_claims(course):
    """Each unit and context claim is loaded, with its evidence"""
    profile, built = build_course_profile(course["run_extraction"])

    assert built is True
    assert profile.status == CourseProfile.Status.READY
    assert profile.run == course["run"]
    assert profile.course_extraction == course["run_extraction"]
    context_unit, first, second = course["units"]
    context, first_extraction, _ = course["extractions"]
    claims = {claim.display_id: claim for claim in profile.claims.all()}
    assert set(claims) == {
        "ctx:aud:0",
        "ctx:prereq:0",
        "U01:c1",
        "U01:c2",
        "U01:s1",
        "U01:a1",
        "U02:c1",
    }
    concept = claims["U01:c1"]
    assert concept.uid == f"u:{first_extraction.key[:12]}:c1"
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
    assert prerequisite.uid == f"u:{context.key[:12]}:ctx:prereq:0"
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

    _, first_files, _ = course["files"]
    evidence = list(claims["U01:a1"].evidence.order_by("id"))
    assert [item.content_file for item in evidence] == first_files
    assert evidence[0].content_checksum == first_files[0].checksum
    assert evidence[0].passage == "a quoted passage here"
    assert evidence[0].locator == "p.2"
    assert evidence[0].verified == "exact"
    assert (evidence[0].span_start, evidence[0].span_end) == (3, 24)
    assert claims["ctx:prereq:0"].evidence.get().content_file == (course["files"][0][0])


def test_build_course_profile_statements(course):
    """Each item of the run output is a statement citing its claims and units"""
    profile, _ = build_course_profile(course["run_extraction"])

    _, first, second = course["units"]
    claims = {claim.display_id: claim for claim in profile.claims.all()}
    (summary,) = _statements(profile, ProfileStatement.Section.SUMMARY)
    assert summary.text == "A course on mechanics."
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


def test_changed_file_evidence_left_out(course):
    """Evidence whose source file changed since it was read is left out"""
    _, first_files, _ = course["files"]
    first_files[1].content = "new text"
    first_files[1].save()

    profile, _ = build_course_profile(course["run_extraction"])

    assumed = profile.claims.get(display_id="U01:a1")
    assert [item.content_file for item in assumed.evidence.all()] == [first_files[0]]


def test_shared_extraction_uids(course):
    """Units sharing an extraction get claims with uids of their own"""
    output = course["run_extraction"].output
    output["units"][1]["extraction"] = output["units"][0]["extraction"]
    course["run_extraction"].save()

    profile, _ = build_course_profile(course["run_extraction"])

    uids = list(profile.claims.values_list("uid", flat=True))
    assert len(uids) == len(set(uids))
    assert profile.claims.filter(display_id="U02:c1", unit=course["units"][2]).exists()


def test_profile_not_rebuilt_when_current(course):
    """A profile is rebuilt only when its run extraction changed, or forced"""
    profile, _ = build_course_profile(course["run_extraction"])
    claim_ids = set(profile.claims.values_list("id", flat=True))

    assert build_course_profile(course["run_extraction"]) == (profile, False)
    assert set(profile.claims.values_list("id", flat=True)) == claim_ids

    _, built = build_course_profile(course["run_extraction"], force=True)
    assert built is True
    assert not claim_ids & set(profile.claims.values_list("id", flat=True))

    course["run_extraction"].output["summary"] = "New summary."
    course["run_extraction"].save()
    _, built = build_course_profile(course["run_extraction"])
    assert built is True
    assert profile.statements.get(section="summary").text == "New summary."
    assert CourseProfile.objects.count() == 1


def test_build_failure_keeps_last_profile(course, mocker):
    """A failed build leaves the last profile as it was"""
    profile, _ = build_course_profile(course["run_extraction"])
    claims = set(profile.claims.values_list("id", flat=True))
    CourseProfile.objects.filter(id=profile.id).update(
        updated_on=now_in_utc() - timedelta(days=1)
    )
    mocker.patch(
        "learning_resources.profiles.course_profile._save_statements",
        side_effect=ValueError("bad"),
    )

    with pytest.raises(ValueError, match="bad"):
        build_course_profile(course["run_extraction"])

    profile.refresh_from_db()
    assert profile.status == CourseProfile.Status.READY
    assert set(profile.claims.values_list("id", flat=True)) == claims


def test_build_failure_without_profile(course):
    """A run without a profile gets a failed one when building fails"""
    course["units"][2].delete()

    with pytest.raises(ProfileBuildError, match="unit"):
        build_course_profile(course["run_extraction"])

    profile = CourseProfile.objects.get(run=course["run"])
    assert profile.status == CourseProfile.Status.FAILED
    assert not profile.claims.exists()


def test_build_rejects_unit_extraction(course):
    """Only a run-level extraction makes a profile"""
    with pytest.raises(ValueError, match="run-level"):
        build_course_profile(course["extractions"][1])


def test_publish_course_profile(course):
    """The best run's profile is built and the course's other profiles deleted"""
    old_run = LearningResourceRunFactory.create(learning_resource=course["resource"])
    old_profile = CourseProfile.objects.create(run=old_run)
    other_course = CourseProfile.objects.create(run=LearningResourceRunFactory.create())

    assert publish_course_profile(course["resource"], course["run_extraction"]) is True

    assert set(CourseProfile.objects.values_list("id", flat=True)) == {
        CourseProfile.objects.get(run=course["run"]).id,
        other_course.id,
    }
    assert not CourseProfile.objects.filter(id=old_profile.id).exists()


def test_publish_course_profile_without_extraction(course):
    """A course without a run extraction has no profile"""
    build_course_profile(course["run_extraction"])

    assert publish_course_profile(course["resource"], None) is None

    assert not CourseProfile.objects.exists()
    assert not ProfileClaim.objects.exists()
    assert not ClaimEvidence.objects.exists()
