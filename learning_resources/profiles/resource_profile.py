"""
Step 3 of resource profile generation: load a run's claims into its profile.

The run's context, unit and run extractions are already stored. This step
parses their JSON into RunProfile, ProfileClaim, ClaimEvidence and
ProfileStatement rows, which can be queried, and makes no model calls.

- Each unit claim, and each context claim, is a ProfileClaim, with the id the
  run step cites it by (U03:a4, ctx:prereq:0) and a uid built from its
  extraction's key and its unit's id, which stays the same while they do.
  Context claims belong to the run's own context unit: a context extraction
  is shared by the runs of a resource with the same context files.
- Each evidence item is a ClaimEvidence. The stored outputs name their
  sources S01, S02, ... by position, without content file ids, since an
  extraction is shared by every unit with the same files. A source is
  resolved to the content file at its position in the unit that reads it,
  when the part of that file's text the source read is unchanged; evidence
  whose source can't be resolved is left out and logged.
- Each learning outcome and inferred preparation item of the run output is
  also a run-level ProfileClaim (run:outcome:0, run:prior:0), which cites the
  unit and context claims it rests on.
- Each item of the run output's summary, audience, learning outcomes, main
  topics, inferred preparation and coverage limitations is a
  ProfileStatement, linked to the claims and units it cites. The items the
  preparation rule excluded are left in the run extraction's output.

A run's profile is rebuilt in one transaction, so readers never see a
partial profile, and only when its run extraction has changed since the
profile was built, or when deleting content files or units removed some of
its rows, such as evidence quoting a file that ETL replaced with an identical
one.
"""

import logging
from collections import Counter

from django.db import transaction

from learning_resources.models import (
    ClaimEvidence,
    ClaimExtraction,
    ContentFile,
    LearningResource,
    ProfileClaim,
    ProfileStatement,
    RunProfile,
    Unit,
)
from learning_resources.profiles.run_claims import (
    CLAIM_KINDS,
    CONTEXT_NOTES_ID,
    context_claims,
)
from learning_resources.profiles.sources import text_checksum, unit_source_files

log = logging.getLogger(__name__)

# a unit claim's fields stored in ProfileClaim's own columns, not in data
_CLAIM_COLUMNS = {"id", "label", "description", "evidence"}
# a context claim's fields stored in ProfileClaim's own columns, not in data
_CONTEXT_COLUMNS = {"label", "text", "statement", "evidence"}
# claim id prefix of the context claims
CONTEXT_PREFIX = "ctx:"
# claim id prefix of the run claims
RUN_PREFIX = "run:"
# the run output's fields loaded as run claims: (kind, local id prefix, the
# item's fields listing the claim ids it cites)
RUN_CLAIM_FIELDS = {
    "learning_outcomes": (ProfileClaim.Kind.OUTCOME, "outcome", ("claim_ids",)),
    "inferred_preparation": (
        ProfileClaim.Kind.PRIOR,
        "prior",
        (
            "assumed_claim_ids",
            "taught_before_first_use_claim_ids",
            "taught_after_first_use_claim_ids",
        ),
    ),
}
# a run claim's fields stored in ProfileClaim's own columns, not in data
_RUN_COLUMNS = {"label", "text", "description"}


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
) -> tuple[
    list[tuple[str, Unit, ClaimExtraction | None]],
    tuple[ClaimExtraction, Unit] | None,
]:
    """
    Return the run's units, as (display id, unit, extraction), and its context
    extraction with the run's context unit, from the run output's references.

    The context extraction's own unit is whichever run's context unit last
    stored it, since runs of a resource with the same context files share it,
    so its claims are loaded for the run's own context unit.

    Raises:
        ProfileBuildError: when a referenced unit or extraction is gone or
            belongs to another run, or the run has a context extraction but
            no context unit, so the run's claims must be generated again first
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
    extractions = ClaimExtraction.objects.in_bulk(extraction_ids)
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
    if not context_id:
        return records, None
    context_unit = Unit.objects.filter(
        run_id=extraction.run_id, kind=Unit.Kind.CONTEXT
    ).first()
    if context_unit is None:
        msg = (
            f"Run extraction {extraction.id} has context extraction {context_id}"
            f" but run {extraction.run_id} has no context unit"
        )
        raise ProfileBuildError(msg)
    return records, (extractions[context_id], context_unit)


def _source_unchanged(source: dict, content_file: ContentFile, text: str) -> bool:
    """
    Return whether a stored source still reads the same as the file at its
    position in a unit.

    The extraction is keyed on the text sent, so it is reused while that text
    is the same, even when the file's raw content, and so its checksum, has
    changed outside the part read. Sources stored before text_checksum was
    recorded are checked against the file's checksum.
    """
    if source.get("text_checksum"):
        return source["text_checksum"] == text_checksum(
            text, source.get("included_chars", len(text))
        )
    return (content_file.checksum or "") == (source.get("checksum") or "")


def _source_files(unit: Unit, extraction: ClaimExtraction) -> dict[str, ContentFile]:
    """
    Return the content file each of an extraction's sources was read from,
    by source id, for the sources whose text in this unit is unchanged
    """
    current = {
        source_id: (link.content_file, text)
        for source_id, link, text in unit_source_files(unit)
    }
    files = {}
    for source in extraction.output.get("sources", []):
        content_file, text = current.get(source["source_id"], (None, ""))
        if content_file and _source_unchanged(source, content_file, text):
            files[source["source_id"]] = content_file
    return files


# --------------------------------------------------------------------------- loader
class _ProfileLoader:
    """Build the rows of one profile from its run's extractions"""

    def __init__(self, profile: RunProfile):
        self.profile = profile
        self.claims: list[ProfileClaim] = []
        # each claim's evidence items and the files of its sources, in claim order
        self.evidence: list[tuple[list[dict], dict[str, ContentFile]]] = []
        # each claim's cited claim ids, in claim order
        self.cites: list[list[str]] = []
        self.stats = Counter()

    @staticmethod
    def _uid(extraction: ClaimExtraction, unit: Unit | None, local_id: str) -> str:
        """
        Return a claim's uid, unique in the profile.

        Units with the same files share an extraction, so a unit claim's uid
        has the unit's id as well as the extraction's key. It doesn't depend
        on which other units share the extraction, or on the unit's position.
        A run claim, with no unit, has only the run extraction's key.
        """
        if unit is None:
            return f"r:{extraction.key[:12]}:{local_id}"
        return f"u:{extraction.key[:12]}:{unit.id}:{local_id}"

    def _add_claim(  # noqa: PLR0913
        self,
        *,
        extraction: ClaimExtraction,
        unit: Unit | None,
        local_id: str,
        display_id: str,
        kind: str,
        label: str,
        description: str,
        data: dict,
        evidence: list[dict],
        files: dict[str, ContentFile],
        level: str = ProfileClaim.Level.UNIT,
        cites: list[str] | None = None,
    ) -> None:
        self.claims.append(
            ProfileClaim(
                profile=self.profile,
                uid=self._uid(extraction, unit, local_id),
                display_id=_clip(display_id, _max_length(ProfileClaim, "display_id")),
                level=level,
                kind=kind,
                label=_clip(label, _max_length(ProfileClaim, "label")),
                description=description or "",
                unit=unit,
                extraction=extraction,
                data=data,
            )
        )
        self.evidence.append((evidence, files))
        self.cites.append(cites or [])

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

    def add_context(self, extraction: ClaimExtraction, unit: Unit) -> None:
        """Add the context unit's claims, for the run's context unit"""
        files = _source_files(unit, extraction)
        for claim_id, field, item, text in context_claims(extraction.output):
            # a prerequisite has a label and a statement; the rest only text
            description = item.get("statement") or item.get("text") or text
            self._add_claim(
                extraction=extraction,
                unit=unit,
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

    def add_run(self, extraction: ClaimExtraction) -> None:
        """
        Add the run extraction's claims: its learning outcomes and inferred
        preparation. They quote no sources, so they have no evidence, and cite
        the unit and context claims they rest on instead.
        """
        for field, (kind, prefix, cite_fields) in RUN_CLAIM_FIELDS.items():
            for index, item in enumerate(extraction.output.get(field, [])):
                local_id = f"{prefix}:{index}"
                # an outcome has only text; a preparation item a label and a
                # description
                description = item.get("description") or item.get("text") or ""
                self._add_claim(
                    extraction=extraction,
                    unit=None,
                    local_id=local_id,
                    display_id=f"{RUN_PREFIX}{local_id}",
                    kind=kind,
                    label=item.get("label") or description,
                    description=description,
                    data={
                        name: value
                        for name, value in item.items()
                        if name not in _RUN_COLUMNS
                    },
                    evidence=[],
                    files={},
                    level=ProfileClaim.Level.RUN,
                    cites=[
                        claim_id
                        for cite_field in cite_fields
                        for claim_id in item.get(cite_field, [])
                    ],
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

    def _cites_rows(self, claims: dict[str, ProfileClaim]) -> list:
        """
        Link each claim to the claims it cites. Cited ids that aren't claims,
        like a unit's U03 or ctx:notes, are left in the claim's data.
        """
        through = ProfileClaim.cites.through
        return [
            through(from_profileclaim_id=claim.id, to_profileclaim_id=cited.id)
            for claim, cited_ids in zip(self.claims, self.cites, strict=True)
            for cited in dict.fromkeys(
                claims[cited_id] for cited_id in cited_ids if cited_id in claims
            )
        ]

    def save_claims(self) -> dict[str, ProfileClaim]:
        """
        Store the claims, their evidence and their citations; return the
        claims by display id
        """
        ProfileClaim.objects.bulk_create(self.claims)
        ClaimEvidence.objects.bulk_create(self._evidence_rows())
        claims = {claim.display_id: claim for claim in self.claims}
        ProfileClaim.cites.through.objects.bulk_create(self._cites_rows(claims))
        self.stats["claims"] += len(self.claims)
        return claims


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
                # first_needed, then where the resource teaches it
                ([first_needed] if first_needed else [])
                + [claim_id.split(":")[0] for claim_id in taught],
            )
        )
    return statements


def _save_statements(
    profile: RunProfile,
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
def _row_counts(profile: RunProfile) -> dict[str, int]:
    """
    Count the profile's rows that deleting a content file or unit elsewhere
    removes: evidence (cascade), claims' units (set to null) and statements'
    links to units
    """
    return {
        "evidence": ClaimEvidence.objects.filter(claim__profile=profile).count(),
        "claim_units": profile.claims.filter(unit__isnull=False).count(),
        "statement_units": ProfileStatement.units.through.objects.filter(
            profilestatement__profile=profile
        ).count(),
    }


def _is_current(profile: RunProfile | None, extraction: ClaimExtraction) -> bool:
    """
    Whether a profile was built from the extraction as it is now, and still
    has every row it was built with.

    ETL can delete and recreate a unit's content files with the same text,
    which leaves the extractions as they are but deletes the evidence quoting
    the old files, so the rows are counted as well.
    """
    return (
        profile is not None
        and profile.status == RunProfile.Status.READY
        and profile.resource_extraction_id == extraction.id
        and profile.updated_on >= extraction.updated_on
        and profile.row_counts == _row_counts(profile)
    )


def _load(profile: RunProfile, extraction: ClaimExtraction) -> Counter:
    """Replace a profile's claims and statements with the extraction's"""
    records, context = _load_references(extraction)
    profile.claims.all().delete()
    profile.statements.all().delete()
    loader = _ProfileLoader(profile)
    if context:
        loader.add_context(*context)
    for display_id, unit, unit_extraction in records:
        if unit_extraction is not None:
            loader.add_unit(display_id, unit, unit_extraction)
    # last, so the claims they cite are stored before them
    loader.add_run(extraction)
    claims = loader.save_claims()
    units = {display_id: unit for display_id, unit, _ in records}
    loader.stats["statements"] += _save_statements(
        profile, extraction.output, claims, units
    )
    return loader.stats


def build_resource_profile(
    extraction: ClaimExtraction, *, force: bool = False
) -> tuple[RunProfile, bool]:
    """
    Build the profile of a run from its run extraction, unless it was already
    built from it.

    The profile is replaced in one transaction. When building fails, the
    run's last profile keeps its claims, and a ready one is marked stale,
    since the extraction it points at may have been replaced in place; a run
    with no profile gets one with status failed.

    Args:
        extraction (ClaimExtraction): the run's run-level extraction
        force (bool): rebuild even when the profile is current, to apply a
            change to this code

    Returns:
        tuple of (RunProfile, bool): the profile, and whether it was built

    Raises:
        ProfileBuildError: when the extraction refers to units or extractions
            that are gone
    """
    if extraction.level != ClaimExtraction.Level.RUN or extraction.run_id is None:
        msg = f"Extraction {extraction.id} is not a run's run-level extraction"
        raise ValueError(msg)
    profile = RunProfile.objects.filter(run_id=extraction.run_id).first()
    if not force and _is_current(profile, extraction):
        return profile, False
    try:
        with transaction.atomic():
            # update_or_create locks the row, so concurrent builds take turns
            profile, _ = RunProfile.objects.update_or_create(
                run_id=extraction.run_id,
                defaults={
                    "resource_extraction": extraction,
                    "status": RunProfile.Status.BUILDING,
                },
            )
            stats = _load(profile, extraction)
            profile.row_counts = _row_counts(profile)
            profile.status = RunProfile.Status.READY
            profile.save()
    except Exception:
        profile, created = RunProfile.objects.get_or_create(
            run_id=extraction.run_id,
            defaults={
                "resource_extraction": extraction,
                "status": RunProfile.Status.FAILED,
            },
        )
        if not created and profile.status == RunProfile.Status.READY:
            # the extraction's row may have been replaced in place, so the
            # profile's claims no longer match what its foreign key points at
            profile.status = RunProfile.Status.STALE
            profile.save(update_fields=["status", "updated_on"])
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


def publish_resource_profile(
    resource: LearningResource,
    extraction: ClaimExtraction | None,
    *,
    force: bool = False,
) -> bool | None:
    """
    Build the profile of a resource's best run, and delete its other profiles.

    The resource's profile follows its published extractions: see
    publish_claim_extractions. A resource without a run extraction has no
    profile. The profiles of the resource's other runs are deleted before
    building, since their claims are no longer published, so the resource never
    has more than one profile. When building fails, the best run's profile is
    handled as in build_resource_profile.

    Args:
        resource (LearningResource): the resource
        extraction (ClaimExtraction | None): the best run's run-level
            extraction, or None when it has none
        force (bool): rebuild even when the profile is current

    Returns:
        bool | None: whether the profile was built, or None when the resource
            has no run extraction

    Raises:
        ProfileBuildError: when the extraction refers to units or extractions
            that are gone
    """
    profiles = RunProfile.objects.filter(run__learning_resource=resource)
    if extraction is None:
        profiles.delete()
        return None
    profiles.exclude(run_id=extraction.run_id).delete()
    _, built = build_resource_profile(extraction, force=force)
    return built
