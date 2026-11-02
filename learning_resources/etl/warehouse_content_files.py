"""Warehouse-pull loading of content files.

The OL Data Platform's ``integrations__learn__content_files`` (MITx Online and
xPRO) and ``integrations__learn__ocw_content_files`` views have one row per file
with its extracted text. Together they are far larger than the catalog views:
the Open edX one alone had 2.9 million rows in 5.6 GB of compressed Parquet on
2026-10-26. The warehouse connection buffers a whole result in memory, so they
are never read whole, and every read names one run.

A source's sync reads one row of aggregates per run (``iter_group_stats``), and
queues a load for each run whose fingerprint differs from the one stored on it
(``LearningResourceRun.checksum``, which the archive ETL keeps its archive's
checksum in). A load reads that run's rows and hands them to the loader the
archive ETL uses. A run the view does not list is left alone: the view holds a
run back while its export is being checked, so absence does not mean deletion.

A load unpublishes the run's files its rows leave out, unless the number of rows
it read differs from the number it was told to expect
(ol-data-platform docs/design/contentfile_scoped_pull_contract.md §4). A file
whose extraction failed has a row with no text. Its stored row is left as it is
and is not unpublished.
"""

import json
import logging

from django.db.models import Count, Q

from learning_resources.constants import CONTENT_TYPE_PAGE, LearningResourceType
from learning_resources.etl import loaders
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.utils import hide_unreleased_files
from learning_resources.etl.warehouse_guards import (
    refuse_empty,
    refuse_unpublish_share,
    utc_timestamp_or_none,
    warehouse_list,
)
from learning_resources.models import LearningResourceRun
from main.utils import checksum_for_content, clean_data

log = logging.getLogger(__name__)

OPEN_EDX_VIEW = "integrations__learn__content_files"
OCW_VIEW = "integrations__learn__ocw_content_files"
VIEWS = {
    ETLSource.mitxonline.name: OPEN_EDX_VIEW,
    ETLSource.xpro.name: OPEN_EDX_VIEW,
    ETLSource.ocw.name: OCW_VIEW,
}
RUN_COLUMN = "run_readable_id"
EXTRACTION_FAILED = "failed"

# The columns whose aggregates tell that a run changed. The OCW view's
# last_modified moves for every file of a course when any of them changes. The
# Open edX one moves with an export. The platform can also recompute a file's
# release date without one, which these catch if it moves the run's latest date
# or dates another file. Any other recompute needs a reload.
FINGERPRINT_COLUMNS = {
    ETLSource.mitxonline.name: ("last_modified", "release_date"),
    ETLSource.xpro.name: ("last_modified", "release_date"),
    ETLSource.ocw.name: ("last_modified",),
}


def _fingerprint(etl_source: str, stats: dict) -> str:
    """Hash a run's aggregates, as ``iter_group_stats`` names them"""
    fields = ["row_count"]
    for column in FINGERPRINT_COLUMNS[etl_source]:
        fields += [f"{column}_count", f"{column}_max"]
    return checksum_for_content(
        json.dumps([stats[field] for field in fields], default=str)
    )


def _stats_of_rows(etl_source: str, rows: list[dict]) -> dict:
    """Compute from a run's rows the aggregates iter_group_stats reads from the view"""
    stats = {"row_count": len(rows)}
    for column in FINGERPRINT_COLUMNS[etl_source]:
        values = [row[column] for row in rows if row[column] is not None]
        stats[f"{column}_count"] = len(values)
        stats[f"{column}_max"] = max(values, default=None)
    return stats


def _loadable_runs(etl_source: str):
    """
    Return the runs a source's content files load into: the runs of a published
    or test-mode course, best first where two courses share a run id, as
    edx_shared.run_for_edx_archive chooses.
    """
    return (
        LearningResourceRun.objects.filter(
            Q(learning_resource__published=True) | Q(learning_resource__test_mode=True),
            learning_resource__etl_source=etl_source,
            learning_resource__resource_type=LearningResourceType.course.name,
        )
        .select_related("learning_resource")
        .order_by("-published", "id")
    )


def loadable_run(etl_source: str, run_id: str) -> LearningResourceRun | None:
    """Return the run a source's content files for a run id load into, if any"""
    return _loadable_runs(etl_source).filter(run_id=run_id).first()


def runs_to_load(
    etl_source: str, run_stats: list[dict], *, allow_mass_unpublish: bool = False
) -> list[tuple[str, int]]:
    """
    Choose the runs a source's sync should load.

    A run is loaded when its fingerprint differs from the stored one, or when
    it has no published files, as process_course_archive reloads a run whose
    files were unpublished or deleted since.

    Args:
        etl_source (str): the source
        run_stats (list of dict): one row per run from iter_group_stats
        allow_mass_unpublish (bool): lift the limit on how many files may go

    Returns:
        list of (run_id, number of rows) to load

    Raises:
        ExtractException: the view is empty, or the loads would unpublish too
            many files
    """
    refuse_empty(**{VIEWS[etl_source]: run_stats})
    stored = {}
    for run_id, checksum, published_files in (
        _loadable_runs(etl_source)
        .annotate(
            published_files=Count(
                "content_files", filter=Q(content_files__published=True)
            )
        )
        .values_list("run_id", "checksum", "published_files")
    ):
        stored.setdefault(run_id, (checksum, published_files))

    to_load = []
    missing = 0
    for stats in run_stats:
        run_id = stats[RUN_COLUMN]
        if run_id not in stored:
            continue
        checksum, published_files = stored[run_id]
        if published_files and checksum == _fingerprint(etl_source, stats):
            continue
        to_load.append((run_id, stats["row_count"]))
        missing += max(published_files - stats["row_count"], 0)
    if not allow_mass_unpublish:
        refuse_unpublish_share(
            f"{etl_source} content files",
            sum(published_files for _, published_files in stored.values()),
            missing,
        )
    return to_load


def _transform_common(row: dict) -> dict:
    """Transform the columns of a row both views carry into ContentFile fields"""
    return {
        "key": row["key"],
        "published": bool(row["published"]),
        "title": row["title"],
        "url": row["url"],
        "content": row["content"],
        "content_title": row["content_title"],
        "content_type": row["content_type"],
        "file_extension": row["file_extension"],
    }


def transform_open_edx_row(row: dict) -> dict:
    """
    Transform a row of integrations__learn__content_files into what
    utils.transform_content_files builds. The view leaves out archive_checksum,
    the checksum of the file's bytes, which only the archive ETL reads.
    """
    return {
        **_transform_common(row),
        "edx_module_id": row["edx_module_id"],
        "source_path": row["source_path"],
        "release_date": utc_timestamp_or_none(row["release_date"]),
    }


def transform_ocw_row(row: dict) -> dict:
    """
    Transform a row of integrations__learn__ocw_content_files into what
    ocw.transform_content_files builds. The view carries a resource's HTML body
    as published, and ocw.transform_contentfile cleans it.
    """
    is_page = row["content_type"] == CONTENT_TYPE_PAGE
    return {
        **_transform_common(row),
        "description": row["description"]
        if is_page
        else clean_data(row["description"]),
        "file_type": row["file_type"],
        "image_src": row["image_src"],
        "youtube_id": row["youtube_id"],
        "content_tags": warehouse_list(row["content_tags"]),
    }


def load_run(
    run: LearningResourceRun,
    rows: list[dict],
    *,
    expected_count: int | None = None,
) -> int:
    """
    Load one run's rows as its content files.

    The stored fingerprint is cleared first and set only when the whole run
    landed, so a sync reloads a run that was read short, had a file fail to save
    or stopped partway. A run reloaded for having no published files already has
    the view's fingerprint, so leaving it in place would strand the repair. Units
    are not
    in the views. The run keeps the ones the archive ETL built, less their links
    to files this unpublishes.

    Args:
        run (LearningResourceRun): the run
        rows (list of dict): the run's rows in its source's view
        expected_count (int | None): how many rows the sender saw. Any other
            number of rows skips the prune, and None trusts ``rows``

    Returns:
        int: the number of files loaded
    """
    etl_source = run.learning_resource.etl_source
    is_ocw = etl_source == ETLSource.ocw.name
    complete = expected_count is None or len(rows) == expected_count
    if not complete:
        log.warning(
            "Read %d of %d rows for %s run %s; not unpublishing its missing files",
            len(rows),
            expected_count,
            etl_source,
            run.run_id,
        )
    if run.checksum:
        run.checksum = None
        run.save(update_fields=["checksum"])
    failed_keys = [
        row["key"] for row in rows if row["extraction_status"] == EXTRACTION_FAILED
    ]
    extraction_failures = len(failed_keys)
    if not is_ocw:
        # every row, because a file that doesn't load keeps its old text, and a
        # date that moved has to hide or show that text
        hide_unreleased_files(
            run,
            {row["key"]: utc_timestamp_or_none(row["release_date"]) for row in rows},
        )
    transform = transform_ocw_row if is_ocw else transform_open_edx_row
    file_ids = loaders.load_content_files(
        run,
        (
            transform(row)
            for row in rows
            if row["extraction_status"] != EXTRACTION_FAILED
        ),
        failed_keys=failed_keys,
        prune=complete,
    )
    if not file_ids:
        return 0
    if is_ocw:
        # from every row, as a failed file still counts toward the score
        if complete:
            loaders.calculate_completeness(
                run,
                content_tags=[warehouse_list(row["content_tags"]) for row in rows],
            )
        loaders.load_learning_materials(
            run, run.content_files.filter(published=True).values_list("id", flat=True)
        )
    else:
        loaders.load_course_units(run, [])
    if complete and len(failed_keys) == extraction_failures:
        run.checksum = _fingerprint(etl_source, _stats_of_rows(etl_source, rows))
        run.save(update_fields=["checksum"])
    return len(file_ids)
