"""
Step 3 of resource profile generation: load a run's claims into its profile.

The run's context, unit and run extractions are already stored. This step
parses their JSON into RunProfile, ProfileClaim and ClaimEvidence rows,
which can be queried, and makes no model calls.

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
- The run output's summary, and each of its audiences, main topics, learning
  outcomes, inferred preparation items and coverage limitations, is a
  run-level ProfileClaim (run:summary:0, run:topic:0, run:preparation:0, ...),
  linked to the unit and context claims and the units it cites, and stored
  in that order, so ordering by id reads them as a profile. Preparation items
  the preparation rule excluded aren't loaded.

A run's profile is rebuilt in one transaction, so readers never see a
partial profile. It is rebuilt only when its run extraction changed, or when
deleting or unpublishing content files or units invalidated some of its rows,
as when ETL replaces a file with an identical one.
"""

import logging
from collections import Counter
from dataclasses import dataclass, field
from typing import NamedTuple

from django.db import transaction
from django.db.models import Exists, OuterRef

from learning_resources.models import (
    ClaimEvidence,
    ClaimExtraction,
    ContentFile,
    LearningResource,
    ProfileClaim,
    RunProfile,
    Unit,
    UnitContentFile,
)
from learning_resources.profiles.run_claims import (
    CLAIM_KINDS,
    CONTEXT_NOTES_ID,
    context_claims,
)
from learning_resources.profiles.sources import read_text_checksum, unit_source_files

log = logging.getLogger(__name__)

# the fields of each kind of item that aren't copied into a claim's data,
# since they are its columns, its uid or its evidence rows
_UNIT_FIELDS_NOT_IN_DATA = {"id", "label", "description", "evidence"}
_CONTEXT_FIELDS_NOT_IN_DATA = {"label", "text", "statement", "evidence"}
_RUN_FIELDS_NOT_IN_DATA = {"label", "text", "description"}
# claim id prefix of the run claims
RUN_PREFIX = "run:"
# the run output's lists loaded as run claims, in the order a profile reads
# them, after the summary: (field, kind, local id prefix)
RUN_CLAIM_FIELDS = (
    ("audience", ProfileClaim.Kind.AUDIENCE, "audience"),
    ("main_topics", ProfileClaim.Kind.TOPIC, "topic"),
    ("learning_outcomes", ProfileClaim.Kind.OUTCOME, "outcome"),
    ("inferred_preparation", ProfileClaim.Kind.PREPARATION, "preparation"),
    ("coverage_limitations", ProfileClaim.Kind.LIMITATION, "limitation"),
)


class ProfileBuildError(Exception):
    """A profile can't be built from the stored extractions"""


def _clip(text: str | None, length: int) -> str:
    """Cut text to fit a column, marking the cut"""
    text = text or ""
    return text if len(text) <= length else text[: length - 1].rstrip() + "…"


def _max_length(model, field_name: str) -> int:
    return model._meta.get_field(field_name).max_length  # noqa: SLF001


def _extra_fields(item: dict, exclude: set[str]) -> dict:
    """Return an item's fields other than those stored elsewhere"""
    return {name: value for name, value in item.items() if name not in exclude}


def _unit_display_id(claim_id: str) -> str:
    """Return the display id of the unit a unit claim id is in: U02 for U02:c3"""
    return claim_id.partition(":")[0]


# --------------------------------------------------------------------------- inputs
class _UnitExtraction(NamedTuple):
    """A unit of the run, as the run output refers to it, with its extraction"""

    # U01, U02, ...
    display_id: str
    unit: Unit
    # None when the unit was skipped, as when it had no text
    extraction: ClaimExtraction | None


class _ContextExtraction(NamedTuple):
    """The run's context extraction, with the run's own context unit"""

    extraction: ClaimExtraction
    unit: Unit


def _load_references(
    run_extraction: ClaimExtraction,
) -> tuple[list[_UnitExtraction], _ContextExtraction | None]:
    """
    Return the run's units with their extractions, and its context extraction,
    from the run output's references.

    Runs with the same context files share a context extraction, so its
    unit may be another run's; its claims are loaded for this run's context
    unit instead.

    Raises:
        ProfileBuildError: when a referenced unit or extraction is gone or
            belongs to another run, or the run has a context extraction but
            no context unit, so the run's claims must be generated again first
    """
    output = run_extraction.output
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
        if unit_id not in units or units[unit_id].run_id != run_extraction.run_id
    ] + [
        f"extraction {extraction_id}"
        for extraction_id in extraction_ids
        if extraction_id not in extractions
    ]
    if missing:
        msg = (
            f"Run extraction {run_extraction.id} refers to rows that are gone or"
            f" belong to another run: {', '.join(missing)}"
        )
        raise ProfileBuildError(msg)
    unit_extractions = [
        _UnitExtraction(
            reference["unit_id"],
            units[reference["unit"]],
            extractions.get(reference["extraction"]),
        )
        for reference in references
    ]
    if not context_id:
        return unit_extractions, None
    context_unit = Unit.objects.filter(
        run_id=run_extraction.run_id, kind=Unit.Kind.CONTEXT
    ).first()
    if context_unit is None:
        msg = (
            f"Run extraction {run_extraction.id} has context extraction"
            f" {context_id} but run {run_extraction.run_id} has no context unit"
        )
        raise ProfileBuildError(msg)
    return unit_extractions, _ContextExtraction(extractions[context_id], context_unit)


def _leading_whitespace(text: str) -> int:
    """
    Return how many characters stripping removes from the start of text, as
    unit_source_files strips it
    """
    return len(text) - len(text.lstrip())


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
        return source["text_checksum"] == read_text_checksum(
            text, source.get("included_chars", len(text))
        )
    return (content_file.checksum or "") == (source.get("checksum") or "")


def _unchanged_source_files(
    unit: Unit, extraction: ClaimExtraction
) -> dict[str, ContentFile]:
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
@dataclass
class _PendingClaim:
    """A claim to store, with what its evidence and citations are built from"""

    claim: ProfileClaim
    # its id within its extraction, which its uid is built from
    local_id: str
    # its evidence items, and the content files of its sources by source id
    evidence: list[dict] = field(default_factory=list)
    files: dict[str, ContentFile] = field(default_factory=dict)
    # the claim and unit ids it cites, and the ids of the units it names
    cited_ids: list[str] = field(default_factory=list)
    named_unit_ids: list[str] = field(default_factory=list)


class _RunCitations(NamedTuple):
    """What a run output item cites"""

    # claim ids, or unit ids like U03
    cited_ids: list[str]
    # the units it names: a topic's units, where a preparation item is first
    # needed and taught
    named_unit_ids: list[str]


def _run_citations(kind: str, item: dict) -> _RunCitations:
    """Return what a run output item cites"""
    if kind == ProfileClaim.Kind.TOPIC:
        return _RunCitations(
            item.get("concept_claim_ids", []), item.get("unit_ids", [])
        )
    if kind == ProfileClaim.Kind.PREPARATION:
        taught = item.get("taught_before_first_use_claim_ids", []) + item.get(
            "taught_after_first_use_claim_ids", []
        )
        first_needed = item.get("first_needed_unit_id")
        return _RunCitations(
            item.get("assumed_claim_ids", []) + taught,
            # first_needed, then where the resource teaches it
            ([first_needed] if first_needed else [])
            + [_unit_display_id(claim_id) for claim_id in taught],
        )
    return _RunCitations(item.get("claim_ids", []), [])


class _ProfileLoader:
    """Build the rows of one profile from its run's extractions"""

    def __init__(self, profile: RunProfile):
        self.profile = profile
        self.pending: list[_PendingClaim] = []
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

    def _add(self, pending: _PendingClaim) -> None:
        """Add a claim to the profile, fitting its text to its columns"""
        claim = pending.claim
        claim.profile = self.profile
        claim.uid = self._uid(claim.extraction, claim.unit, pending.local_id)
        claim.display_id = _clip(
            claim.display_id, _max_length(ProfileClaim, "display_id")
        )
        claim.label = _clip(claim.label, _max_length(ProfileClaim, "label"))
        claim.description = claim.description or ""
        self.pending.append(pending)

    def add_unit(
        self, display_id: str, unit: Unit, extraction: ClaimExtraction
    ) -> None:
        """Add a unit's claims"""
        files = _unchanged_source_files(unit, extraction)
        for output_field, (kind, _) in CLAIM_KINDS.items():
            for item in extraction.output.get(output_field, []):
                claim = ProfileClaim(
                    extraction=extraction,
                    unit=unit,
                    display_id=f"{display_id}:{item['id']}",
                    level=ProfileClaim.Level.UNIT,
                    kind=kind,
                    label=item["label"],
                    description=item.get("description"),
                    data=_extra_fields(item, _UNIT_FIELDS_NOT_IN_DATA),
                )
                self._add(
                    _PendingClaim(
                        claim,
                        item["id"],
                        evidence=item.get("evidence", []),
                        files=files,
                    )
                )

    def add_context(self, context: _ContextExtraction) -> None:
        """Add the context unit's claims, for the run's context unit"""
        files = _unchanged_source_files(context.unit, context.extraction)
        for context_claim in context_claims(context.extraction.output):
            item = context_claim.item
            # a prerequisite has a label and a statement; the rest only text
            description = (
                item.get("statement") or item.get("text") or context_claim.text
            )
            claim = ProfileClaim(
                extraction=context.extraction,
                unit=context.unit,
                display_id=context_claim.claim_id,
                level=ProfileClaim.Level.UNIT,
                kind=ProfileClaim.Kind.CONTEXT,
                label=item.get("label") or description,
                description=description,
                data={
                    "field": context_claim.field,
                    **_extra_fields(item, _CONTEXT_FIELDS_NOT_IN_DATA),
                },
            )
            self._add(
                _PendingClaim(
                    claim,
                    context_claim.claim_id,
                    evidence=item.get("evidence", []),
                    files=files,
                )
            )

    def add_run(self, run_extraction: ClaimExtraction) -> None:
        """
        Add the run extraction's claims: its summary, then each item of its
        lists. They quote no sources, so they have no evidence, and cite the
        unit and context claims they rest on instead.
        """
        output = run_extraction.output
        items = []
        if output.get("summary"):
            items.append(
                (
                    ProfileClaim.Kind.SUMMARY,
                    "summary:0",
                    {
                        "text": output["summary"],
                        "claim_ids": output.get("summary_claim_ids", []),
                    },
                )
            )
        items += [
            (kind, f"{prefix}:{index}", item)
            for output_field, kind, prefix in RUN_CLAIM_FIELDS
            for index, item in enumerate(output.get(output_field, []))
        ]
        for kind, local_id, item in items:
            # a topic and a preparation item have a label and a description;
            # the rest only text
            description = item.get("description") or item.get("text") or ""
            claim = ProfileClaim(
                extraction=run_extraction,
                unit=None,
                display_id=f"{RUN_PREFIX}{local_id}",
                level=ProfileClaim.Level.RUN,
                kind=kind,
                label=item.get("label") or description,
                description=description,
                data=_extra_fields(item, _RUN_FIELDS_NOT_IN_DATA),
            )
            citations = _run_citations(kind, item)
            self._add(
                _PendingClaim(
                    claim,
                    local_id,
                    cited_ids=citations.cited_ids,
                    named_unit_ids=citations.named_unit_ids,
                )
            )

    def _evidence_rows(self) -> list[ClaimEvidence]:
        """
        Return the claims' evidence, with spans as offsets into each file's
        raw content.

        Verification finds spans in the file's stripped text, so they are
        shifted by the content's current leading whitespace, which may differ
        from when a reused extraction was made.
        """
        locator_length = _max_length(ClaimEvidence, "locator")
        # each file's leading whitespace, by content file id
        offsets: dict[int, int] = {}
        rows = []
        for pending in self.pending:
            for item in pending.evidence:
                content_file = pending.files.get(item.get("source_id"))
                if content_file is None:
                    self.stats["evidence_unresolved"] += 1
                    continue
                if content_file.id not in offsets:
                    offsets[content_file.id] = _leading_whitespace(
                        content_file.content or ""
                    )
                offset = offsets[content_file.id]
                span_start, span_end = item.get("span_start"), item.get("span_end")
                rows.append(
                    ClaimEvidence(
                        claim=pending.claim,
                        content_file=content_file,
                        content_checksum=content_file.checksum or "",
                        passage=item["passage"],
                        locator=_clip(item.get("locator"), locator_length),
                        verified=item.get("verified") or "unverified",
                        span_start=None if span_start is None else span_start + offset,
                        span_end=None if span_end is None else span_end + offset,
                    )
                )
        return rows

    def _citation_rows(
        self, claims: dict[str, ProfileClaim], units: dict[str, Unit]
    ) -> tuple[list, list]:
        """
        Link each claim to the claims and units it cites, and the units it
        names. A cited id that is a unit's (a limitation can cite U03) links
        the unit. Ids that are neither, like ctx:notes, stay only in the
        claim's data.

        Returns:
            tuple of (list, list): the rows of cited_claims and of cited_units
        """
        cited_claim_rows, cited_unit_rows = [], []
        for pending in self.pending:
            claim = pending.claim
            cited_claims, cited_units, unknown = [], [], []
            for cited_id in dict.fromkeys(pending.cited_ids):
                if cited_id in claims:
                    cited_claims.append(claims[cited_id])
                elif cited_id in units:
                    cited_units.append(units[cited_id])
                elif cited_id != CONTEXT_NOTES_ID:
                    unknown.append(cited_id)
            cited_units += [
                units[unit_id] for unit_id in pending.named_unit_ids if unit_id in units
            ]
            if unknown:
                log.warning(
                    "Profile %s: claim %s cites unknown ids %s",
                    self.profile.id,
                    claim.display_id,
                    ", ".join(unknown),
                )
            cited_claim_rows += [
                ProfileClaim.cited_claims.through(
                    from_profileclaim_id=claim.id, to_profileclaim_id=cited.id
                )
                for cited in cited_claims
            ]
            cited_unit_rows += [
                ProfileClaim.cited_units.through(
                    profileclaim_id=claim.id, unit_id=unit.id
                )
                for unit in dict.fromkeys(cited_units)
            ]
        return cited_claim_rows, cited_unit_rows

    def save_claims(self, units: dict[str, Unit]) -> None:
        """
        Store the claims, their evidence and their citations, given the run's
        units by display id
        """
        claims = [pending.claim for pending in self.pending]
        ProfileClaim.objects.bulk_create(claims)
        ClaimEvidence.objects.bulk_create(self._evidence_rows())
        cited_claim_rows, cited_unit_rows = self._citation_rows(
            {claim.display_id: claim for claim in claims}, units
        )
        ProfileClaim.cited_claims.through.objects.bulk_create(cited_claim_rows)
        ProfileClaim.cited_units.through.objects.bulk_create(cited_unit_rows)
        self.stats["claims"] += len(claims)


# --------------------------------------------------------------------------- build
def _invalidation_counts(profile: RunProfile) -> dict[str, int]:
    """
    Count the profile's rows that changes to content files or units can
    invalidate:

    - evidence quoting a published file still in its claim's unit (deleting
      a file cascades to its evidence; ETL unpublishes a replaced file and
      relinks the unit)
    - claims with a unit (deleting a unit sets it to null)
    - run claims' links to units
    """
    linked = UnitContentFile.objects.filter(
        unit_id=OuterRef("claim__unit_id"),
        content_file_id=OuterRef("content_file_id"),
    )
    return {
        "evidence": ClaimEvidence.objects.filter(
            Exists(linked), claim__profile=profile, content_file__published=True
        ).count(),
        "claim_units": profile.claims.filter(unit__isnull=False).count(),
        "cited_units": ProfileClaim.cited_units.through.objects.filter(
            profileclaim__profile=profile
        ).count(),
    }


def _is_current(profile: RunProfile | None, run_extraction: ClaimExtraction) -> bool:
    """
    Return whether a profile was built from the run extraction as it is now,
    and none of its rows have been invalidated since.

    ETL can replace content files with identical ones, which leaves the
    extractions unchanged but the evidence quoting the old files, hence the
    invalidation counts.
    """
    return (
        profile is not None
        and profile.status == RunProfile.Status.READY
        and profile.run_extraction_id == run_extraction.id
        and profile.updated_on >= run_extraction.updated_on
        and profile.invalidation_counts == _invalidation_counts(profile)
    )


def _check_published_references(run_extraction: ClaimExtraction) -> None:
    """
    Check that a published run extraction's unit and context extractions are
    published too.

    Regenerating an extraction replaces its row in place and unpublishes it.
    If the sweep then fails before publishing, the run output's claim ids,
    like U01:c3, name claims the row no longer holds, and building would
    link them to the wrong claims. Rows that are gone are left to
    _load_references.

    Raises:
        ProfileBuildError: when a referenced extraction is unpublished
    """
    if not run_extraction.published:
        return
    output = run_extraction.output
    extraction_ids = [
        reference["extraction"]
        for reference in output.get("units", [])
        if reference["extraction"]
    ]
    if output.get("context_extraction"):
        extraction_ids.append(output["context_extraction"])
    unpublished = sorted(
        ClaimExtraction.objects.filter(
            id__in=extraction_ids, published=False
        ).values_list("id", flat=True)
    )
    if unpublished:
        msg = (
            f"Published run extraction {run_extraction.id} refers to unpublished"
            f" extractions {', '.join(map(str, unpublished))}, which may have"
            " been replaced since it was made"
        )
        raise ProfileBuildError(msg)


def _replace_claims(profile: RunProfile, run_extraction: ClaimExtraction) -> Counter:
    """Replace a profile's claims with those of the run's extractions"""
    unit_extractions, context = _load_references(run_extraction)
    profile.claims.all().delete()
    loader = _ProfileLoader(profile)
    if context:
        loader.add_context(context)
    for unit_extraction in unit_extractions:
        if unit_extraction.extraction is not None:
            loader.add_unit(*unit_extraction)
    # last, so ordering by id reads the run claims after the claims they cite
    loader.add_run(run_extraction)
    loader.save_claims({ue.display_id: ue.unit for ue in unit_extractions})
    return loader.stats


def build_run_profile(
    run_extraction: ClaimExtraction, *, force: bool = False
) -> tuple[RunProfile, bool]:
    """
    Build the profile of a run from its run extraction, unless it was already
    built from it.

    The profile is replaced in one transaction. When building fails, the
    run's last profile keeps its claims and is marked stale if it was ready
    but is out of date; a run with no profile gets a failed one.

    Args:
        run_extraction (ClaimExtraction): the run's run-level extraction
        force (bool): rebuild even when the profile is current, to apply a
            change to this code

    Returns:
        tuple of (RunProfile, bool): the profile, and whether it was built

    Raises:
        ValueError: when the extraction isn't a run's run-level extraction
        ProfileBuildError: when the extraction refers to units or extractions
            that are gone, or it is published and refers to extractions that
            aren't
    """
    if (
        run_extraction.level != ClaimExtraction.Level.RUN
        or run_extraction.run_id is None
    ):
        msg = f"Extraction {run_extraction.id} is not a run's run-level extraction"
        raise ValueError(msg)
    _check_published_references(run_extraction)
    profile = RunProfile.objects.filter(run_id=run_extraction.run_id).first()
    if not force and _is_current(profile, run_extraction):
        return profile, False
    try:
        with transaction.atomic():
            # update_or_create locks the row, so concurrent builds take turns
            profile, _ = RunProfile.objects.update_or_create(
                run_id=run_extraction.run_id,
                defaults={
                    "run_extraction": run_extraction,
                    "status": RunProfile.Status.BUILDING,
                },
            )
            stats = _replace_claims(profile, run_extraction)
            profile.invalidation_counts = _invalidation_counts(profile)
            profile.status = RunProfile.Status.READY
            profile.save()
    except Exception:
        profile, created = RunProfile.objects.get_or_create(
            run_id=run_extraction.run_id,
            defaults={
                "run_extraction": run_extraction,
                "status": RunProfile.Status.FAILED,
            },
        )
        current = ClaimExtraction.objects.filter(id=run_extraction.id).first()
        if (
            not created
            and profile.status == RunProfile.Status.READY
            and (current is None or not _is_current(profile, current))
        ):
            # out of date, e.g. its extraction was replaced in place; one that
            # is still current, as when a forced rebuild fails, stays ready
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
    run_extraction: ClaimExtraction | None,
    *,
    force: bool = False,
) -> bool | None:
    """
    Build the profile of a resource's best run, and delete its other profiles.

    A resource without a run extraction has no profile. The other runs'
    profiles are deleted only once the best run's builds, so a resource whose
    best run changed keeps its last ready profile until then; that is the
    only time a resource has more than one.

    Args:
        resource (LearningResource): the resource
        run_extraction (ClaimExtraction | None): the best run's run-level
            extraction, or None when it has none
        force (bool): rebuild even when the profile is current

    Returns:
        bool | None: whether the profile was built, or None when the resource
            has no run extraction

    Raises:
        ProfileBuildError: when the extraction refers to units or extractions
            that are gone, or it is published and refers to extractions that
            aren't
    """
    profiles = RunProfile.objects.filter(run__learning_resource=resource)
    if run_extraction is None:
        profiles.delete()
        return None
    _, built = build_run_profile(run_extraction, force=force)
    # after building, so a failed build keeps the other runs' profiles
    profiles.exclude(run_id=run_extraction.run_id).delete()
    return built
