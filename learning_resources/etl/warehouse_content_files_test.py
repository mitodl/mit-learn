"""Tests for the warehouse-pull loading of content files"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from django.db import DataError

from learning_resources.etl import warehouse_content_files
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.exceptions import ExtractException
from learning_resources.etl.ownership import CONTENT_FILE, Pipeline, writing_as
from learning_resources.factories import (
    ContentFileFactory,
    ETLSourceOwnershipFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
    UnitContentFileFactory,
    UnitFactory,
)
from learning_resources.models import ContentFile, ETLSourceOwnership, LearningResource

pytestmark = [pytest.mark.django_db]

MITXONLINE = ETLSource.mitxonline.name
OCW = ETLSource.ocw.name


@pytest.fixture(autouse=True)
def _no_search_hooks(mocker):
    """Stop the loaders' plugin hooks, which reach the search index"""
    mocker.patch("learning_resources.etl.loaders.content_files_loaded_actions")
    mocker.patch("learning_resources.etl.loaders.update_index")


@pytest.fixture(autouse=True)
def mock_deindex(mocker):
    """Stop the tasks that drop newly hidden files from the indexes"""
    return SimpleNamespace(
        search=mocker.patch(
            "learning_resources_search.tasks.deindex_run_content_files.delay"
        ),
        vector=mocker.patch(
            "vector_search.tasks.remove_unpublished_run_content_files.delay"
        ),
    )


def _refuse_saving(mocker, *keys):
    """Make the database refuse the rows with these keys"""
    real_update_or_create = ContentFile.objects.update_or_create

    def update_or_create(*args, **kwargs):
        if kwargs["key"] in keys:
            raise DataError
        return real_update_or_create(*args, **kwargs)

    mocker.patch(
        "learning_resources.etl.loaders.ContentFile.objects.update_or_create",
        side_effect=update_or_create,
    )


@pytest.fixture
def warehouse_owns_content_files():
    """Make the warehouse the owner of each source's content files"""
    for etl_source in (MITXONLINE, OCW):
        ETLSourceOwnershipFactory.create(
            etl_source=etl_source,
            resource_type=CONTENT_FILE,
            owner=ETLSourceOwnership.Pipeline.WAREHOUSE,
        )
    with writing_as(Pipeline.WAREHOUSE):
        yield


def _run(etl_source=MITXONLINE, *, run_id="course-v1:MITxT+1+1T2026", **course):
    resource = LearningResourceFactory.create(
        is_course=True, etl_source=etl_source, create_runs=False, **course
    )
    return LearningResourceRunFactory.create(
        learning_resource=resource, run_id=run_id, published=True
    )


def _open_edx_row(key="block-1", **overrides):
    return {
        "etl_source": MITXONLINE,
        "run_readable_id": "course-v1:MITxT+1+1T2026",
        "key": key,
        "edx_module_id": key,
        "title": f"title {key}",
        "description": None,
        "url": f"https://example.com/{key}",
        "file_type": None,
        "content": f"text of {key}",
        "content_title": "",
        "content_author": None,
        "content_language": None,
        "content_type": "file",
        "image_src": None,
        "uid": None,
        "source_path": f"course/html/{key}.xml",
        "file_extension": ".xml",
        "checksum": "abc",
        "extraction_status": "extracted",
        "published": 1,
        "last_modified": "2026-10-20T10:00:00.000Z",
        "release_date": None,
        **overrides,
    }


def _ocw_row(key="courses/a/resources/b/", **overrides):
    return {
        "etl_source": OCW,
        "run_readable_id": "abc123",
        "key": key,
        "edx_module_id": None,
        "title": "Problem set",
        "description": "<p>body</p><script>alert(1)</script>",
        "url": f"https://ocw.mit.edu/{key}",
        "file_type": "application/pdf",
        "content": "text",
        "content_title": "Problem set",
        "content_author": None,
        "content_language": None,
        "content_type": "pdf",
        "image_src": None,
        "uid": None,
        "source_path": None,
        "file_extension": ".pdf",
        "checksum": "abc",
        "extraction_status": "extracted",
        "published": 1,
        "last_modified": "2026-10-20T10:00:00.000Z",
        "content_tags": '["Problem Sets"]',
        "youtube_id": None,
        **overrides,
    }


def _run_stats(run_id="course-v1:MITxT+1+1T2026", **overrides):
    """Build a row of iter_group_stats over the Open edX view"""
    return {
        "run_readable_id": run_id,
        "row_count": 2,
        "last_modified_count": 2,
        "last_modified_max": "2026-10-20T10:00:00.000Z",
        "release_date_count": 0,
        "release_date_max": None,
        **overrides,
    }


def test_transform_open_edx_row_carries_the_file_and_leaves_the_rest_alone():
    """A row becomes the keys the archive ETL sets, with a dated release"""
    row = _open_edx_row(release_date="2027-02-02T15:00:00.000000Z")

    assert warehouse_content_files.transform_open_edx_row(row) == {
        "key": "block-1",
        "published": True,
        "title": "title block-1",
        "url": "https://example.com/block-1",
        "content": "text of block-1",
        "content_title": "",
        "content_type": "file",
        "file_extension": ".xml",
        "edx_module_id": "block-1",
        "source_path": "course/html/block-1.xml",
        "release_date": datetime(2027, 2, 2, 15, tzinfo=UTC),
    }


def test_transform_ocw_row_cleans_a_resource_description():
    """A resource's HTML body is cleaned as ocw.transform_contentfile does"""
    data = warehouse_content_files.transform_ocw_row(_ocw_row())

    assert data["description"] == "<p>body</p>"
    assert data["content_tags"] == ["Problem Sets"]
    assert data["file_type"] == "application/pdf"
    assert "edx_module_id" not in data


def test_transform_ocw_row_keeps_a_page_description():
    """A page's description is stored as published, as ocw.transform_page does"""
    description = "<b>a</b><script>x</script>"

    data = warehouse_content_files.transform_ocw_row(
        _ocw_row(content_type="page", description=description)
    )

    assert data["description"] == description


def test_load_run_loads_files_and_unpublishes_what_the_view_left_out(
    warehouse_owns_content_files,
):
    """A complete read upserts the rows and prunes that run's other files only"""
    run = _run()
    gone = ContentFileFactory.create(run=run, key="gone", published=True)
    other_run_file = ContentFileFactory.create(
        run=_run(run_id="course-v1:MITxT+2+1T2026"), key="gone", published=True
    )

    loaded = warehouse_content_files.load_run(
        run, [_open_edx_row("a"), _open_edx_row("b")], expected_count=2
    )

    assert loaded == 2
    assert set(
        run.content_files.filter(published=True).values_list("key", flat=True)
    ) == {"a", "b"}
    gone.refresh_from_db()
    other_run_file.refresh_from_db()
    assert gone.published is False
    assert other_run_file.published is True


def test_load_run_writes_release_date_so_a_future_file_is_hidden(
    warehouse_owns_content_files,
):
    """A future-dated file is stored dated, published and not visible"""
    run = _run()
    release = datetime.now(tz=UTC) + timedelta(days=30)

    warehouse_content_files.load_run(
        run,
        [_open_edx_row("a", release_date=release.isoformat()), _open_edx_row("b")],
    )

    assert run.content_files.get(key="a").release_date == release
    assert set(run.content_files.visible().values_list("key", flat=True)) == {"b"}


def test_load_run_stores_text_checksum_from_the_content(warehouse_owns_content_files):
    """ContentFile.save hashes the text, whatever the view's checksum says"""
    run = _run()

    warehouse_content_files.load_run(run, [_open_edx_row("a")])

    assert run.content_files.get(key="a").checksum != "abc"


def test_load_run_short_read_skips_the_prune_and_the_fingerprint(
    warehouse_owns_content_files,
):
    """Any gap against the expected count upserts and unpublishes nothing"""
    run = _run()
    kept = ContentFileFactory.create(run=run, key="kept", published=True)

    loaded = warehouse_content_files.load_run(
        run, [_open_edx_row("a")], expected_count=2
    )

    assert loaded == 1
    kept.refresh_from_db()
    assert kept.published is True
    run.refresh_from_db()
    assert run.checksum is None


def test_load_run_no_rows_preserves_the_run(warehouse_owns_content_files):
    """A run with no rows keeps its files: nothing says it really emptied"""
    run = _run()
    kept = ContentFileFactory.create(run=run, key="kept", published=True)

    assert warehouse_content_files.load_run(run, [], expected_count=0) == 0

    kept.refresh_from_db()
    assert kept.published is True


@pytest.mark.parametrize("expected_count", [0, None])
def test_load_run_no_rows_for_a_large_run_is_not_refused(
    warehouse_owns_content_files, expected_count
):
    """
    No rows for a run over RUN_UNPUBLISH_FLOOR files keeps them all instead of
    failing the key check, and clears the fingerprint so a later sync retries it
    """
    run = _published_run(20)
    run.checksum = "stale"
    run.save(update_fields=["checksum"])

    assert warehouse_content_files.load_run(run, [], expected_count=expected_count) == 0

    assert run.content_files.filter(published=True).count() == 20
    run.refresh_from_db()
    assert run.checksum is None


def test_load_run_failed_extraction_keeps_the_stored_file(warehouse_owns_content_files):
    """A failed row neither wipes the stored text nor unpublishes the file"""
    run = _run()
    kept = ContentFileFactory.create(
        run=run, key="failed", published=True, content="stored text"
    )

    loaded = warehouse_content_files.load_run(
        run,
        [
            _open_edx_row("a"),
            _open_edx_row("failed", content=None, extraction_status="failed"),
        ],
        expected_count=2,
    )

    assert loaded == 1
    kept.refresh_from_db()
    assert kept.published is True
    assert kept.content == "stored text"
    run.refresh_from_db()
    assert run.checksum is not None


def test_load_run_failed_extraction_takes_its_new_release_date(
    warehouse_owns_content_files,
):
    """A file moved to a future date is hidden, though its text wasn't refreshed"""
    run = _run()
    kept = ContentFileFactory.create(
        run=run, key="failed", published=True, release_date=None
    )
    release = datetime.now(tz=UTC) + timedelta(days=30)

    warehouse_content_files.load_run(
        run,
        [
            _open_edx_row("a"),
            _open_edx_row(
                "failed",
                content=None,
                extraction_status="failed",
                release_date=release.isoformat(),
            ),
        ],
    )

    kept.refresh_from_db()
    assert kept.release_date == release
    assert kept.published is True


def test_load_run_file_that_fails_to_save_still_takes_its_release_date(
    mocker, warehouse_owns_content_files, mock_deindex
):
    """Its old text stays, so a date that moved has to hide that text"""
    run = _run()
    kept = ContentFileFactory.create(
        run=run, key="bad", published=True, release_date=None
    )
    release = datetime.now(tz=UTC) + timedelta(days=30)
    _refuse_saving(mocker, "bad")

    warehouse_content_files.load_run(
        run,
        [_open_edx_row("a"), _open_edx_row("bad", release_date=release.isoformat())],
        expected_count=2,
    )

    kept.refresh_from_db()
    assert kept.published is True
    assert kept.release_date == release
    mock_deindex.search.assert_called_once_with(run.id, unpublished_only=True)
    mock_deindex.vector.assert_called_once_with(run.id)


@pytest.mark.parametrize("failure", ["extraction", "save"])
def test_load_run_with_nothing_loaded_still_deindexes_a_hidden_file(
    mocker, warehouse_owns_content_files, mock_deindex, failure
):
    """A file just hidden by its date leaves the indexes though no file loaded"""
    run = _run()
    ContentFileFactory.create(run=run, key="bad", published=True, release_date=None)
    release = (datetime.now(tz=UTC) + timedelta(days=30)).isoformat()
    if failure == "extraction":
        row = _open_edx_row(
            "bad", content=None, extraction_status="failed", release_date=release
        )
    else:
        _refuse_saving(mocker, "bad")
        row = _open_edx_row("bad", release_date=release)

    assert warehouse_content_files.load_run(run, [row], expected_count=1) == 0

    mock_deindex.search.assert_called_once_with(run.id, unpublished_only=True)
    mock_deindex.vector.assert_called_once_with(run.id)


def test_load_run_file_that_fails_to_save_keeps_the_stored_file(
    mocker, warehouse_owns_content_files
):
    """A row the database refuses isn't unpublished, and the run loads again"""
    run = _run()
    kept = ContentFileFactory.create(run=run, key="bad", published=True)
    _refuse_saving(mocker, "bad")

    warehouse_content_files.load_run(
        run, [_open_edx_row("a"), _open_edx_row("bad")], expected_count=2
    )

    kept.refresh_from_db()
    assert kept.published is True
    run.refresh_from_db()
    assert run.checksum is None


def test_load_run_drops_unit_links_to_unpublished_files(warehouse_owns_content_files):
    """The views carry no units, so a run keeps its own minus the pruned files"""
    run = _run()
    gone = ContentFileFactory.create(run=run, key="gone", published=True)
    unit = UnitFactory.create(run=run)
    UnitContentFileFactory.create(unit=unit, content_file=gone)

    warehouse_content_files.load_run(run, [_open_edx_row("a")], expected_count=1)

    assert run.units.get() == unit
    assert not unit.content_files.exists()


def test_load_run_ocw_sets_tags_completeness_and_learning_materials(
    mocker, warehouse_owns_content_files
):
    """An OCW run gets what ocw_courses_etl does after loading its files"""
    run = _run(OCW, run_id="abc123")
    # dated, as no OCW file is today, so that the ids don't come from visible()
    failed = ContentFileFactory.create(
        run=run,
        key="failed",
        published=True,
        release_date=datetime.now(tz=UTC) + timedelta(days=30),
    )
    mock_completeness = mocker.patch(
        "learning_resources.etl.warehouse_content_files.loaders.calculate_completeness"
    )
    mock_materials = mocker.patch(
        "learning_resources.etl.warehouse_content_files.loaders.load_learning_materials"
    )

    warehouse_content_files.load_run(
        run,
        [
            _ocw_row(),
            _ocw_row(
                "failed",
                content=None,
                extraction_status="failed",
                content_tags='["Exams"]',
            ),
        ],
        expected_count=2,
    )

    content_file = run.content_files.get(key="courses/a/resources/b/")
    assert [tag.name for tag in content_file.content_tags.all()] == ["Problem Sets"]
    assert content_file.description == "<p>body</p>"
    # a file that failed still counts toward the score
    mock_completeness.assert_called_once_with(
        run, content_tags=[["Problem Sets"], ["Exams"]]
    )
    # every file the run keeps, so a kept failed file stays linked to its material
    assert set(mock_materials.call_args.args[1]) == {content_file.id, failed.id}


def test_load_run_ocw_short_read_keeps_the_stored_score(
    mocker, warehouse_owns_content_files
):
    """Some of a course's files aren't enough to score it"""
    run = _run(OCW, run_id="abc123")
    mock_completeness = mocker.patch(
        "learning_resources.etl.warehouse_content_files.loaders.calculate_completeness"
    )

    warehouse_content_files.load_run(run, [_ocw_row()], expected_count=2)

    mock_completeness.assert_not_called()


def _published_run(count):
    run = _run()
    for index in range(count):
        ContentFileFactory.create(run=run, key=f"old-{index}", published=True)
    return run


def test_load_run_refuses_a_same_sized_replacement(warehouse_owns_content_files):
    """
    Every file renamed keeps the count, which the sync's check and the expected
    count both miss, so the load checks keys and writes nothing
    """
    run = _published_run(20)
    rows = [_open_edx_row(f"new-{index}") for index in range(20)]

    with pytest.raises(ExtractException, match="20 of 20 published"):
        warehouse_content_files.load_run(run, rows, expected_count=20)

    assert set(
        run.content_files.filter(published=True).values_list("key", flat=True)
    ) == {f"old-{index}" for index in range(20)}
    assert not run.content_files.filter(key__startswith="new-").exists()


def test_load_run_refused_replacement_loads_when_allowed(warehouse_owns_content_files):
    """The override loads the new files and unpublishes the old ones"""
    run = _published_run(20)
    rows = [_open_edx_row(f"new-{index}") for index in range(20)]

    assert (
        warehouse_content_files.load_run(
            run, rows, expected_count=20, allow_mass_unpublish=True
        )
        == 20
    )

    assert not run.content_files.filter(key__startswith="old-", published=True).exists()


@pytest.mark.parametrize(
    ("published", "dropped", "refused"),
    [(25, 10, False), (25, 11, True), (200, 20, False), (200, 21, True)],
)
def test_load_run_unpublish_limit_is_a_share_with_a_floor(
    warehouse_owns_content_files, published, dropped, refused
):
    """
    A run may lose RUN_UNPUBLISH_FLOOR files, or MAX_UNPUBLISH_SHARE of them if
    that is more
    """
    run = _published_run(published)
    rows = [_open_edx_row(f"old-{index}") for index in range(published - dropped)]

    if refused:
        with pytest.raises(ExtractException):
            warehouse_content_files.load_run(run, rows, expected_count=len(rows))
    else:
        warehouse_content_files.load_run(run, rows, expected_count=len(rows))
        assert run.content_files.filter(published=True).count() == published - dropped


def test_load_run_short_read_is_not_held_to_the_limit(warehouse_owns_content_files):
    """A read that skips the prune unpublishes nothing, so nothing is refused"""
    run = _published_run(20)

    warehouse_content_files.load_run(run, [_open_edx_row("new")], expected_count=20)

    assert run.content_files.filter(published=True).count() == 21


def test_load_run_failed_rows_count_as_kept(warehouse_owns_content_files):
    """A row whose extraction failed keeps its file, so it isn't counted as lost"""
    run = _published_run(20)
    rows = [
        _open_edx_row(f"old-{index}", content=None, extraction_status="failed")
        for index in range(19)
    ] + [_open_edx_row("new")]

    warehouse_content_files.load_run(run, rows, expected_count=20)

    assert run.content_files.filter(published=True).count() == 20


@pytest.mark.parametrize(
    ("kept", "added", "refused"),
    # 20 published: the count drop is 20 - (kept + added), and the rest of the
    # keys that changed are held to RUN_UNPUBLISH_FLOOR
    [(5, 0, False), (5, 10, False), (5, 11, True), (15, 5, False), (0, 20, True)],
)
def test_load_run_allow_shrink_still_counts_renames(
    warehouse_owns_content_files, kept, added, refused
):
    """
    allow_shrink lets the files a count drop explains go, and holds the keys that
    changed beyond it to the limit
    """
    run = _published_run(20)
    rows = [_open_edx_row(f"old-{index}") for index in range(kept)] + [
        _open_edx_row(f"new-{index}") for index in range(added)
    ]

    if refused:
        with pytest.raises(ExtractException):
            warehouse_content_files.load_run(
                run, rows, expected_count=len(rows), allow_shrink=True
            )
        assert run.content_files.filter(published=True).count() == 20
    else:
        warehouse_content_files.load_run(
            run, rows, expected_count=len(rows), allow_shrink=True
        )
        assert run.content_files.filter(published=True).count() == kept + added


def test_sync_allowed_to_unpublish_still_refuses_a_renamed_run(
    mocker, settings, warehouse_owns_content_files
):
    """
    A sync rerun with allow_mass_unpublish over one shrunk run and one renamed run
    loads the shrunk one and leaves the renamed one's files published
    """
    from learning_resources import tasks

    settings.WAREHOUSE_CATALOG = "catalog"
    settings.WAREHOUSE_SCHEMA = "schema"
    shrunk = _run(run_id="course-v1:MITxT+shrunk+1T2026")
    renamed = _run(run_id="course-v1:MITxT+renamed+1T2026")
    for run in (shrunk, renamed):
        for index in range(20):
            ContentFileFactory.create(run=run, key=f"old-{index}", published=True)
    rows = {
        shrunk.run_id: [_open_edx_row(f"old-{index}") for index in range(5)],
        renamed.run_id: [_open_edx_row(f"new-{index}") for index in range(20)],
    }
    mocker.patch("learning_resources.lib.warehouse.connect_to_warehouse")
    mocker.patch("learning_resources.tasks.connect_to_warehouse")
    mocker.patch(
        "learning_resources.tasks.iter_group_stats",
        return_value=iter(
            [
                _run_stats(run_id, row_count=len(run_rows), last_modified_count=0)
                for run_id, run_rows in rows.items()
            ]
        ),
    )
    mocker.patch(
        "learning_resources.tasks.iter_rows",
        side_effect=lambda _conn, _view, where: iter(rows[where["run_readable_id"]]),
    )
    mocker.patch("learning_resources.tasks.caches")
    failures = []

    def load_inline(*args, **kwargs):
        try:
            tasks.load_warehouse_content_files(*args, **kwargs)
        except ExtractException as exc:
            failures.append(str(exc))

    mocker.patch.object(
        tasks.load_warehouse_content_files, "delay", side_effect=load_inline
    )

    tasks.SyncMITxOnlineContentFilesTask.run(allow_mass_unpublish=True)

    assert shrunk.content_files.filter(published=True).count() == 5
    assert set(
        renamed.content_files.filter(published=True).values_list("key", flat=True)
    ) == {f"old-{index}" for index in range(20)}
    assert len(failures) == 1
    assert renamed.run_id in failures[0]


def test_runs_to_load_round_trips_with_load_run(warehouse_owns_content_files):
    """A run stays loaded until its aggregates move"""
    run = _run()
    rows = [_open_edx_row("a"), _open_edx_row("b")]
    warehouse_content_files.load_run(run, rows, expected_count=2)
    unchanged = _run_stats()

    assert warehouse_content_files.runs_to_load(MITXONLINE, [unchanged]) == []
    assert warehouse_content_files.runs_to_load(
        MITXONLINE, [{**unchanged, "last_modified_max": "2026-10-21T10:00:00.000Z"}]
    ) == [(run.run_id, 2)]
    assert warehouse_content_files.runs_to_load(
        MITXONLINE,
        [
            {
                **unchanged,
                "release_date_count": 1,
                "release_date_max": "2027-01-01T00:00:00.000000Z",
            }
        ],
    ) == [(run.run_id, 2)]
    assert warehouse_content_files.runs_to_load(
        MITXONLINE, [{**unchanged, "row_count": 3}]
    ) == [(run.run_id, 3)]


def test_runs_to_load_round_trips_on_ocw(warehouse_owns_content_files):
    """The OCW view has no release_date, so its fingerprint has none"""
    run = _run(OCW, run_id="abc123")
    warehouse_content_files.load_run(run, [_ocw_row()], expected_count=1)

    assert (
        warehouse_content_files.runs_to_load(
            OCW,
            [
                {
                    "run_readable_id": "abc123",
                    "row_count": 1,
                    "last_modified_count": 1,
                    "last_modified_max": "2026-10-20T10:00:00.000Z",
                }
            ],
        )
        == []
    )


def test_runs_to_load_reloads_a_run_with_no_published_files(
    warehouse_owns_content_files,
):
    """A matching fingerprint doesn't hold back a run whose files were unpublished"""
    run = _run()
    warehouse_content_files.load_run(run, [_open_edx_row("a"), _open_edx_row("b")])
    run.content_files.update(published=False)

    assert warehouse_content_files.runs_to_load(
        MITXONLINE, [_run_stats()], allow_mass_unpublish=True
    ) == [(run.run_id, 2)]


@pytest.mark.parametrize("failure", ["short read", "failed save", "raises"])
def test_unfinished_repair_of_a_run_is_queued_again(
    mocker, warehouse_owns_content_files, failure
):
    """
    A run queued only because its files were unpublished has a matching
    fingerprint, so a load that doesn't land mustn't leave that fingerprint behind
    """
    run = _run()
    rows = [_open_edx_row("a"), _open_edx_row("b")]
    warehouse_content_files.load_run(run, rows, expected_count=2)
    run.content_files.update(published=False)
    if failure == "short read":
        warehouse_content_files.load_run(run, rows[:1], expected_count=2)
    elif failure == "failed save":
        _refuse_saving(mocker, "b")
        warehouse_content_files.load_run(run, rows, expected_count=2)
    else:
        with pytest.raises(ValueError, match="a bad date"):
            warehouse_content_files.load_run(
                run, [rows[0], {**rows[1], "release_date": "a bad date"}]
            )

    assert run.content_files.filter(published=True).exists() or failure == "raises"
    assert warehouse_content_files.runs_to_load(
        MITXONLINE, [_run_stats()], allow_mass_unpublish=True
    ) == [(run.run_id, 2)]


def test_runs_to_load_skips_runs_learn_has_no_course_for():
    """The view lists runs of unpublished and unknown courses, which are skipped"""
    retired = _run(run_id="retired", published=False, test_mode=False)
    in_test = _run(run_id="in-test", published=False, test_mode=True)
    assert LearningResource.objects.filter(id=retired.learning_resource_id).exists()

    to_load = warehouse_content_files.runs_to_load(
        MITXONLINE,
        [
            _run_stats("retired"),
            _run_stats("in-test"),
            _run_stats("not-in-learn"),
        ],
    )

    assert to_load == [(in_test.run_id, 2)]


def test_runs_to_load_keeps_other_sources_apart():
    """A run id another source also uses is judged on this source's run"""
    run = _run()
    other = _run(ETLSource.xpro.name)
    other.checksum = "whatever"
    other.save()
    ContentFileFactory.create(run=other, published=True)

    assert warehouse_content_files.runs_to_load(MITXONLINE, [_run_stats()]) == [
        (run.run_id, 2)
    ]


def test_loadable_run_prefers_the_published_run():
    """A legacy unpublished run sharing an id doesn't get the files"""
    unpublished = _run()
    unpublished.published = False
    unpublished.save()
    published = _run()

    assert (
        warehouse_content_files.loadable_run(MITXONLINE, published.run_id) == published
    )


def test_runs_to_load_refuses_an_empty_view():
    """An empty view is a broken build, not a source with no files"""
    with pytest.raises(ExtractException, match="no rows"):
        warehouse_content_files.runs_to_load(MITXONLINE, [])


@pytest.mark.parametrize("allow", [True, False])
def test_runs_to_load_refuses_a_partly_built_view(allow):
    """Runs that lost most of their files are refused until allowed"""
    run = _run()
    ContentFileFactory.create_batch(4, run=run, published=True)
    stats = [_run_stats(row_count=1)]

    if allow:
        assert warehouse_content_files.runs_to_load(
            MITXONLINE, stats, allow_mass_unpublish=True
        ) == [(run.run_id, 1)]
    else:
        with pytest.raises(ExtractException, match="3 of 4 published"):
            warehouse_content_files.runs_to_load(MITXONLINE, stats)
