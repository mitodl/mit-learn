"""
Step 3 of resource profile generation: load a run's claims into its profile.

The run's context, unit and run extractions are already stored. This step
parses their JSON into CourseProfile, ProfileClaim, ClaimEvidence and
ProfileStatement rows, which can be queried, and makes no model calls.

- Each unit claim, and each context claim, is a ProfileClaim, with the id the
  run step cites it by (U03:a4, ctx:prereq:0) and a uid built from its
  extraction's key, which stays the same while the extraction does.
- Each evidence item is a ClaimEvidence. The stored outputs name their
  sources S01, S02, ... by position, without content file ids, since an
  extraction is shared by every unit with the same files. A source is
  resolved to the content file at its position in the unit that reads it,
  when that file's checksum is the one the source was read with; evidence
  whose source can't be resolved is left out and logged.
- Each item of the run output's summary, audience, learning outcomes, main
  topics, inferred preparation and coverage limitations is a
  ProfileStatement, linked to the claims and units it cites. The items the
  preparation rule excluded are left in the run extraction's output.

A run's profile is rebuilt in one transaction, so readers never see a
partial profile, and only when its run extraction has changed since the
profile was built.
"""

import logging
from collections import Counter

from django.db import transaction

from learning_resources.models import (
    ClaimEvidence,
    ClaimExtraction,
    ContentFile,
    CourseProfile,
    LearningResource,
    ProfileClaim,
    ProfileStatement,
    Unit,
)
from learning_resources.profiles.run_claims import (
    CLAIM_KINDS,
    CONTEXT_NOTES_ID,
    context_claims,
)
from learning_resources.profiles.sources import unit_source_files

log = logging.getLogger(__name__)

# a unit claim's fields stored in ProfileClaim's own columns, not in data
_CLAIM_COLUMNS = {"id", "label", "description", "evidence"}
# a context claim's fields stored in ProfileClaim's own columns, not in data
_CONTEXT_COLUMNS = {"label", "text", "statement", "evidence"}
# claim id prefix of the context claims
CONTEXT_PREFIX = "ctx:"


class ProfileBuildError(Exception):
    """A profile can't be built from the stored extractions"""


def _clip(text: str | None, length: int) -> str:
    """Cut text to fit a column, marking the cut"""
    text = text or ""
    return text if len(text) <= length else text[: length - 1].rstrip() + "…"


def _max_length(model, field: str) -> int:
    return model._meta.get_field(field).max_length  # noqa: SLF001


# --------------------------------------------------------------------------- inputs
def _load_references(
    extraction: ClaimExtraction,
) -> tuple[list[tuple[str, Unit, ClaimExtraction | None]], ClaimExtraction | None]:
    """
    Return the run's units, as (display id, unit, extraction), and its context
    extraction, from the run output's references.

    Raises:
        ProfileBuildError: when a referenced unit or extraction is gone or
            belongs to another run, so the run's claims must be generated
            again first
    """
    output = extraction.output
    references = output.get("units", [])
    unit_ids = [reference["unit"] for reference in references]
    extraction_ids = [
        reference["extraction"] for reference in references if reference["extraction"]
    ]
    context_id = output.get("context_extraction")
    if context_id:
        extraction_ids.append(context_id)
    units = Unit.objects.in_bulk(unit_ids)
    extractions = ClaimExtraction.objects.select_related("unit").in_bulk(extraction_ids)
    missing = [
        f"unit {unit_id}"
        for unit_id in unit_ids
        if unit_id not in units or units[unit_id].run_id != extraction.run_id
    ] + [
        f"extraction {extraction_id}"
        for extraction_id in extraction_ids
        if extraction_id not in extractions
    ]
    if missing:
        msg = (
            f"Run extraction {extraction.id} refers to rows that are gone or"
            f" belong to another run: {', '.join(missing)}"
        )
        raise ProfileBuildError(msg)
    records = [
        (
            reference["unit_id"],
            units[reference["unit"]],
            extractions.get(reference["extraction"]),
        )
        for reference in references
    ]
    context = extractions[context_id] if context_id else None
    if context and context.unit is None:
        msg = f"Context extraction {context.id} has no unit"
        raise ProfileBuildError(msg)
    return records, context


def _source_files(unit: Unit, extraction: ClaimExtraction) -> dict[str, ContentFile]:
    """
    Return the content file each of an extraction's sources was read from,
    by source id, for the sources whose file in this unit is unchanged
    """
    current = {
        source_id: link.content_file for source_id, link, _ in unit_source_files(unit)
    }
    files = {}
    for source in extraction.output.get("sources", []):
        content_file = current.get(source["source_id"])
        if content_file and (content_file.checksum or "") == (
            source.get("checksum") or ""
        ):
            files[source["source_id"]] = content_file
    return files


# --------------------------------------------------------------------------- loader
class _ProfileLoader:
    """Build the rows of one profile from its run's extractions"""

    def __init__(self, profile: CourseProfile):
        self.profile = profile
        self.claims: list[ProfileClaim] = []
        # each claim's evidence items and the files of its sources, in claim order
        self.evidence: list[tuple[list[dict], dict[str, ContentFile]]] = []
        self.uids: set[str] = set()
        self.stats = Counter()

    def _uid(self, extraction: ClaimExtraction, local_id: str, unit_id: str) -> str:
        """
        Return a claim's uid, unique in the profile.

        Units with the same files share an extraction, so a uid already taken
        by another unit's claim is told apart by the unit's display id.
        """
        uid = f"u:{extraction.key[:12]}:{local_id}"
        if uid in self.uids:
            uid = f"u:{extraction.key[:12]}:{unit_id}:{local_id}"
        self.uids.add(uid)
        return uid

    def _add_claim(  # noqa: PLR0913
        self,
        *,
        extraction: ClaimExtraction,
        unit: Unit,
        local_id: str,
        display_id: str,
        kind: str,
        label: str,
        description: str,
        data: dict,
        evidence: list[dict],
        files: dict[str, ContentFile],
    ) -> None:
        self.claims.append(
            ProfileClaim(
                profile=self.profile,
                uid=self._uid(extraction, local_id, display_id.split(":", 1)[0]),
                display_id=_clip(display_id, _max_length(ProfileClaim, "display_id")),
                level=ProfileClaim.Level.UNIT,
                kind=kind,
                label=_clip(label, _max_length(ProfileClaim, "label")),
                description=description or "",
                unit=unit,
                extraction=extraction,
                data=data,
            )
        )
        self.evidence.append((evidence, files))

    def add_unit(
        self, display_id: str, unit: Unit, extraction: ClaimExtraction
    ) -> None:
        """Add a unit's claims"""
        files = _source_files(unit, extraction)
        for field, (kind, _) in CLAIM_KINDS.items():
            for claim in extraction.output.get(field, []):
                self._add_claim(
                    extraction=extraction,
                    unit=unit,
                    local_id=claim["id"],
                    display_id=f"{display_id}:{claim['id']}",
                    kind=kind,
                    label=claim["label"],
                    description=claim.get("description"),
                    data={
                        name: value
                        for name, value in claim.items()
                        if name not in _CLAIM_COLUMNS
                    },
                    evidence=claim.get("evidence", []),
                    files=files,
                )

    def add_context(self, extraction: ClaimExtraction) -> None:
        """Add the context unit's claims"""
        files = _source_files(extraction.unit, extraction)
        for claim_id, field, item, text in context_claims(extraction.output):
            # a prerequisite has a label and a statement; the rest only text
            description = item.get("statement") or item.get("text") or text
            self._add_claim(
                extraction=extraction,
                unit=extraction.unit,
                local_id=claim_id,
                display_id=claim_id,
                kind=ProfileClaim.Kind.CONTEXT,
                label=item.get("label") or description,
                description=description,
                data={
                    "field": field,
                    **{
                        name: value
                        for name, value in item.items()
                        if name not in _CONTEXT_COLUMNS
                    },
                },
                evidence=item.get("evidence", []),
                files=files,
            )

    def _evidence_rows(self) -> list[ClaimEvidence]:
        locator_length = _max_length(ClaimEvidence, "locator")
        rows = []
        for claim, (items, files) in zip(self.claims, self.evidence, strict=True):
            for item in items:
                content_file = files.get(item.get("source_id"))
                if content_file is None:
                    self.stats["evidence_unresolved"] += 1
                    continue
                rows.append(
                    ClaimEvidence(
                        claim=claim,
                        content_file=content_file,
                        content_checksum=content_file.checksum or "",
                        passage=item["passage"],
                        locator=_clip(item.get("locator"), locator_length),
                        verified=item.get("verified") or "unverified",
                        span_start=item.get("span_start"),
                        span_end=item.get("span_end"),
                    )
                )
        return rows

    def save_claims(self) -> dict[str, ProfileClaim]:
        """Store the claims and their evidence; return the claims by display id"""
        ProfileClaim.objects.bulk_create(self.claims)
        ClaimEvidence.objects.bulk_create(self._evidence_rows())
        self.stats["claims"] += len(self.claims)
        return {claim.display_id: claim for claim in self.claims}


# --------------------------------------------------------------------------- statements
def _items(output: dict) -> list[tuple[str, dict, str, list[str], list[str]]]:
    """
    Return the run output's statements, as (section, data, text, cited claim
    ids, unit ids), in section order
    """
    Section = ProfileStatement.Section
    statements = [
        (
            Section.SUMMARY,
            {"claim_ids": output.get("summary_claim_ids", [])},
            output.get("summary") or "",
            output.get("summary_claim_ids", []),
            [],
        )
    ]
    for section, field in (
        (Section.AUDIENCE, "audience"),
        (Section.OUTCOME, "learning_outcomes"),
        (Section.LIMITATION, "coverage_limitations"),
    ):
        statements += [
            (
                section,
                {name: value for name, value in item.items() if name != "text"},
                item["text"],
                item.get("claim_ids", []),
                [],
            )
            for item in output.get(field, [])
        ]
    statements += [
        (
            Section.TOPIC,
            {name: value for name, value in item.items() if name != "description"},
            item["description"],
            item.get("concept_claim_ids", []),
            item.get("unit_ids", []),
        )
        for item in output.get("main_topics", [])
    ]
    for item in output.get("inferred_preparation", []):
        taught = item.get("taught_before_first_use_claim_ids", []) + item.get(
            "taught_after_first_use_claim_ids", []
        )
        first_needed = item.get("first_needed_unit_id")
        statements.append(
            (
                Section.PREPARATION,
                {name: value for name, value in item.items() if name != "description"},
                item["description"],
                item.get("assumed_claim_ids", []) + taught,
                # first_needed, then where the course teaches it
                ([first_needed] if first_needed else [])
                + [claim_id.split(":")[0] for claim_id in taught],
            )
        )
    return statements


def _save_statements(
    profile: CourseProfile,
    output: dict,
    claims: dict[str, ProfileClaim],
    units: dict[str, Unit],
) -> int:
    """
    Store the run output's statements with their citations.

    A cited id that is a unit's (a limitation can cite U03) links the unit.
    Ids that are neither, like ctx:notes, stay only in the statement's data.

    Returns:
        int: how many statements were stored
    """
    rows, citations = [], []
    positions = Counter()
    for section, data, text, claim_ids, unit_ids in _items(output):
        cited_claims, cited_units, unknown = [], [], []
        for cited_id in dict.fromkeys(claim_ids):
            if cited_id in claims:
                cited_claims.append(claims[cited_id])
            elif cited_id in units:
                cited_units.append(units[cited_id])
            elif cited_id != CONTEXT_NOTES_ID:
                unknown.append(cited_id)
        cited_units += [units[unit_id] for unit_id in unit_ids if unit_id in units]
        if unknown:
            log.warning(
                "Profile %s: %s statement cites unknown ids %s",
                profile.id,
                section,
                ", ".join(unknown),
            )
        rows.append(
            ProfileStatement(
                profile=profile,
                section=section,
                position=positions[section],
                text=text,
                data=data,
            )
        )
        positions[section] += 1
        citations.append((cited_claims, list(dict.fromkeys(cited_units))))
    ProfileStatement.objects.bulk_create(rows)
    ProfileStatement.claims.through.objects.bulk_create(
        ProfileStatement.claims.through(
            profilestatement_id=statement.id, profileclaim_id=claim.id
        )
        for statement, (cited_claims, _) in zip(rows, citations, strict=True)
        for claim in cited_claims
    )
    ProfileStatement.units.through.objects.bulk_create(
        ProfileStatement.units.through(
            profilestatement_id=statement.id, unit_id=unit.id
        )
        for statement, (_, cited_units) in zip(rows, citations, strict=True)
        for unit in cited_units
    )
    return len(rows)


# --------------------------------------------------------------------------- build
def _is_current(profile: CourseProfile | None, extraction: ClaimExtraction) -> bool:
    """Whether a profile was built from the extraction as it is now"""
    return (
        profile is not None
        and profile.status == CourseProfile.Status.READY
        and profile.course_extraction_id == extraction.id
        and profile.updated_on >= extraction.updated_on
    )


def _load(profile: CourseProfile, extraction: ClaimExtraction) -> Counter:
    """Replace a profile's claims and statements with the extraction's"""
    records, context = _load_references(extraction)
    profile.claims.all().delete()
    profile.statements.all().delete()
    loader = _ProfileLoader(profile)
    if context:
        loader.add_context(context)
    for display_id, unit, unit_extraction in records:
        if unit_extraction is not None:
            loader.add_unit(display_id, unit, unit_extraction)
    claims = loader.save_claims()
    units = {display_id: unit for display_id, unit, _ in records}
    loader.stats["statements"] += _save_statements(
        profile, extraction.output, claims, units
    )
    return loader.stats


def build_course_profile(
    extraction: ClaimExtraction, *, force: bool = False
) -> tuple[CourseProfile, bool]:
    """
    Build the profile of a run from its run extraction, unless it was already
    built from it.

    The profile is replaced in one transaction. When building fails, the
    run's last profile is left as it was, and a run with none gets one with
    status failed.

    Args:
        extraction (ClaimExtraction): the run's run-level extraction
        force (bool): rebuild even when the profile is current, to apply a
            change to this code

    Returns:
        tuple of (CourseProfile, bool): the profile, and whether it was built

    Raises:
        ProfileBuildError: when the extraction refers to units or extractions
            that are gone
    """
    if extraction.level != ClaimExtraction.Level.RUN or extraction.run_id is None:
        msg = f"Extraction {extraction.id} is not a run's run-level extraction"
        raise ValueError(msg)
    profile = CourseProfile.objects.filter(run_id=extraction.run_id).first()
    if not force and _is_current(profile, extraction):
        return profile, False
    try:
        with transaction.atomic():
            # update_or_create locks the row, so concurrent builds take turns
            profile, _ = CourseProfile.objects.update_or_create(
                run_id=extraction.run_id,
                defaults={
                    "course_extraction": extraction,
                    "status": CourseProfile.Status.BUILDING,
                },
            )
            stats = _load(profile, extraction)
            profile.status = CourseProfile.Status.READY
            profile.save()
    except Exception:
        CourseProfile.objects.get_or_create(
            run_id=extraction.run_id,
            defaults={
                "course_extraction": extraction,
                "status": CourseProfile.Status.FAILED,
            },
        )
        raise
    if stats["evidence_unresolved"]:
        log.warning(
            "Profile %s: left out %d evidence items whose source file changed"
            " or is gone",
            profile.id,
            stats["evidence_unresolved"],
        )
    log.info("Built profile %s for run %s: %s", profile.id, profile.run_id, stats)
    return profile, True


def publish_course_profile(
    resource: LearningResource,
    extraction: ClaimExtraction | None,
    *,
    force: bool = False,
) -> bool | None:
    """
    Build the profile of a course's best run, and delete its other profiles.

    The course's profile follows its published extractions: see
    publish_claim_extractions. A course without a run extraction has no
    profile. When building fails, the course's profiles are left as they
    were.

    Args:
        resource (LearningResource): the course
        extraction (ClaimExtraction | None): the best run's run-level
            extraction, or None when it has none
        force (bool): rebuild even when the profile is current

    Returns:
        bool | None: whether the profile was built, or None when the course
            has no run extraction

    Raises:
        ProfileBuildError: when the extraction refers to units or extractions
            that are gone
    """
    profiles = CourseProfile.objects.filter(run__learning_resource=resource)
    if extraction is None:
        profiles.delete()
        return None
    profile, built = build_course_profile(extraction, force=force)
    profiles.exclude(id=profile.id).delete()
    return built
