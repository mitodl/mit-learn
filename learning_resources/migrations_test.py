"""Tests for the ContentFile dedupe migration (0123)"""

import importlib

import pytest
from django.apps import apps
from django.db import connection

from learning_resources.factories import (
    LearningResourceContentTagFactory,
    LearningResourceFactory,
    LearningResourceRunFactory,
)
from learning_resources.models import ContentFile

migration = importlib.import_module(
    "learning_resources.migrations.0123_contentfile_dedupe_partial_unique_constraints"
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def _drop_unique_indexes():
    """
    Drop the partial unique indexes so duplicate rows can be seeded.

    The test transaction is rolled back afterwards, which restores them.
    """
    with connection.cursor() as cursor:
        for _, index_name in migration.IDENTITIES:
            cursor.execute(f'DROP INDEX IF EXISTS "{index_name}"')


def run_dedupe():
    """Run the migration's forward function against the current model state"""
    migration.dedupe_content_files(apps, connection.schema_editor())


def make_content_file(parent_field, parent, key, summary="", updated_on=None):
    """Create a ContentFile on one of the three parent identities"""
    content_file = ContentFile.objects.create(
        **{parent_field: parent}, key=key, summary=summary
    )
    if updated_on is not None:
        # updated_on is auto_now, so it can only be backdated via .update()
        ContentFile.objects.filter(id=content_file.id).update(updated_on=updated_on)
    return content_file


@pytest.mark.usefixtures("_drop_unique_indexes")
@pytest.mark.parametrize(
    "parent_field",
    ["run", "learning_resource", "direct_learning_resource"],
)
def test_dedupe_handles_all_parent_identities(parent_field):
    """Duplicates collapse to one row for each of the three parent types"""
    parent = (
        LearningResourceRunFactory.create()
        if parent_field == "run"
        else LearningResourceFactory.create()
    )
    kept = make_content_file(parent_field, parent, "same.pdf", summary="a summary")
    loser = make_content_file(parent_field, parent, "same.pdf")
    other = make_content_file(parent_field, parent, "different.pdf")

    run_dedupe()

    assert set(ContentFile.objects.values_list("id", flat=True)) == {kept.id, other.id}
    assert not ContentFile.objects.filter(id=loser.id).exists()


@pytest.mark.usefixtures("_drop_unique_indexes")
def test_dedupe_prefers_summary_over_recency():
    """A row with a summary wins even when another row was updated later"""
    run = LearningResourceRunFactory.create()
    with_summary = make_content_file(
        "run", run, "file.pdf", summary="expensive llm output"
    )
    newer = make_content_file("run", run, "file.pdf")
    ContentFile.objects.filter(id=with_summary.id).update(
        updated_on="2020-01-01T00:00:00Z"
    )
    ContentFile.objects.filter(id=newer.id).update(updated_on="2030-01-01T00:00:00Z")

    run_dedupe()

    assert list(ContentFile.objects.values_list("id", flat=True)) == [with_summary.id]


@pytest.mark.usefixtures("_drop_unique_indexes")
def test_dedupe_keeps_latest_updated_without_summaries():
    """With no summaries the most recently updated row wins"""
    run = LearningResourceRunFactory.create()
    newest = make_content_file(
        "run", run, "file.pdf", updated_on="2030-01-01T00:00:00Z"
    )
    make_content_file("run", run, "file.pdf", updated_on="2020-01-01T00:00:00Z")
    make_content_file("run", run, "file.pdf", updated_on="2025-01-01T00:00:00Z")

    run_dedupe()

    assert list(ContentFile.objects.values_list("id", flat=True)) == [newest.id]


@pytest.mark.usefixtures("_drop_unique_indexes")
def test_dedupe_collapses_null_keys():
    """Keyless rows on the same parent are duplicates of each other"""
    run = LearningResourceRunFactory.create()
    kept = make_content_file("run", run, None, summary="keep me")
    make_content_file("run", run, None)
    other_run_file = make_content_file("run", LearningResourceRunFactory.create(), None)

    run_dedupe()

    assert set(ContentFile.objects.values_list("id", flat=True)) == {
        kept.id,
        other_run_file.id,
    }


@pytest.mark.usefixtures("_drop_unique_indexes")
def test_dedupe_removes_content_tag_rows():
    """The survivor keeps its tags and the losers' through-rows are gone"""
    run = LearningResourceRunFactory.create()
    tag = LearningResourceContentTagFactory.create()
    kept = make_content_file("run", run, "file.pdf", summary="keep me")
    loser = make_content_file("run", run, "file.pdf")
    kept.content_tags.set([tag])
    loser.content_tags.set([tag])

    run_dedupe()

    through = ContentFile.content_tags.through
    assert list(through.objects.values_list("contentfile_id", flat=True)) == [kept.id]
    assert list(kept.content_tags.values_list("id", flat=True)) == [tag.id]


@pytest.mark.usefixtures("_drop_unique_indexes")
def test_dedupe_leaves_distinct_rows_alone():
    """Rows that are not duplicates survive untouched"""
    run = LearningResourceRunFactory.create()
    resource = LearningResourceFactory.create()
    ids = {
        make_content_file("run", run, "a.pdf").id,
        make_content_file("run", run, "b.pdf").id,
        make_content_file("run", LearningResourceRunFactory.create(), "a.pdf").id,
        make_content_file("learning_resource", resource, "a.pdf").id,
        make_content_file("direct_learning_resource", resource, "a.pdf").id,
    }

    run_dedupe()

    assert set(ContentFile.objects.values_list("id", flat=True)) == ids


@pytest.mark.django_db(transaction=True)
def test_build_index_retries_after_duplicate():
    """
    A duplicate present at build time (e.g. inserted by the previous release
    mid-migration) makes the first CREATE UNIQUE INDEX fail; the build
    function dedupes and retries instead of failing the migration.

    Needs a real transactionless connection: CONCURRENTLY cannot run inside
    the usual test transaction. The function rebuilds the index it drops, so
    the schema is unchanged afterwards.
    """
    index_name = "contentfile_run_key_uniq"
    with connection.cursor() as cursor:
        cursor.execute(f'DROP INDEX IF EXISTS "{index_name}"')

    run = LearningResourceRunFactory.create()
    kept = make_content_file("run", run, "file.pdf", summary="keep me")
    make_content_file("run", run, "file.pdf")

    forward = migration._build_index("run_id", index_name)  # noqa: SLF001
    forward(apps, connection.schema_editor())

    assert list(ContentFile.objects.filter(run=run).values_list("id", flat=True)) == [
        kept.id
    ]
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT indisvalid FROM pg_index"
            " JOIN pg_class ON pg_class.oid = pg_index.indexrelid"
            " WHERE relname = %s",
            [index_name],
        )
        assert cursor.fetchone() == (True,)
