"""Tests for the warehouse-pull OCW loading"""

import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urljoin

import pytest
from django.utils.text import slugify

from learning_resources.constants import (
    LearningResourceDelivery,
    LearningResourceType,
    PlatformType,
)
from learning_resources.etl import loaders, ocw, warehouse_ocw
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.exceptions import ExtractException
from learning_resources.etl.ownership import Pipeline, writing_as
from learning_resources.factories import (
    ETLSourceOwnershipFactory,
    LearningResourceDepartmentFactory,
    LearningResourceFactory,
    LearningResourceOfferorFactory,
    LearningResourcePlatformFactory,
    LearningResourceTopicFactory,
)
from learning_resources.models import LearningResource

pytestmark = pytest.mark.django_db

COURSE = LearningResourceType.course.name
OCW_URL = "https://ocw.mit.edu/"
SLUG = "16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006"
READ_AT = datetime(2026, 10, 7, 1, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def ocw_settings(settings):
    """Point OCW at the URL the view builds its URLs from, with offline delivery on"""
    settings.OCW_BASE_URL = OCW_URL
    settings.OCW_OFFLINE_DELIVERY = True


@pytest.fixture(autouse=True)
def platform():
    """Create the platform and offeror the loaders look up"""
    LearningResourceOfferorFactory.create(is_ocw=True)
    return LearningResourcePlatformFactory.create(code=PlatformType.ocw.name)


@pytest.fixture(autouse=True)
def department():
    """Create the department the fixture names, which load_departments requires"""
    return LearningResourceDepartmentFactory.create(department_id="16")


@pytest.fixture(autouse=True)
def topics():
    """Create the topics the fixture names, which transform_topics keeps"""
    return [
        LearningResourceTopicFactory.create(name=name)
        for name in ("Anthropology", "Philosophy", "Social Sciences")
    ]


@pytest.fixture(autouse=True)
def mock_search(mocker):
    """Mock out the search index tasks, the topic lookup and the blocklist"""
    mocker.patch("learning_resources_search.plugins.get_similar_topics_qdrant")
    mocker.patch(
        "learning_resources.etl.warehouse_ocw.load_course_blocklist", return_value=[]
    )
    return SimpleNamespace(
        upsert=mocker.patch("learning_resources_search.tasks.upsert_learning_resource"),
        deindex=mocker.patch("learning_resources_search.tasks.deindex_document"),
    )


@pytest.fixture
def warehouse_owns_ocw():
    """Name the warehouse as the owner of ocw course"""
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.ocw.name, resource_type=COURSE, owner=Pipeline.WAREHOUSE
    )


@pytest.fixture
def data_json():
    """Load the published data.json the OCW ETL tests use"""
    return json.loads(Path(f"./test_json/courses/{SLUG}/data.json").read_text())


def _flatten(nested: list[list[str]]) -> list[str]:
    return sorted({name for names in nested for name in names})


def view_row(data: dict, slug: str = SLUG) -> dict:
    """
    Build the integrations__learn__ocw_courses row of a data.json, as the
    platform builds it, with each array column as the JSON text StarRocks sends
    """
    term = data["term"] or None
    year = data["year"] or None
    extra = data["extra_course_numbers"]
    image_metadata = data["course_image_metadata"]
    return {
        "readable_id": (
            data["primary_course_number"]
            + (f"+{slugify(term)}" if term else "")
            + (f"_{year}" if year else "")
        ),
        "title": data["course_title"],
        "last_modified": READ_AT.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
        "etl_source": "ocw",
        "description": data["course_description_html"],
        "url": f"{OCW_URL}courses/{slug}/",
        "image_url": urljoin(OCW_URL, data["image_src"]),
        "image_alt": image_metadata["image_metadata"]["image-alt"],
        "image_description": image_metadata["description"],
        "published": True,
        "platform": "ocw",
        "run_id": (data["legacy_uid"] or data["site_uid"]).replace("-", ""),
        "slug": f"courses/{slug}",
        "term": term,
        "year": int(year) if year else None,
        "level": json.dumps(data["level"]),
        "course_number": data["primary_course_number"],
        "extra_course_numbers": json.dumps(
            [num.strip() for num in extra.split(",")] if extra else []
        ),
        "departments": json.dumps(data["department_numbers"]),
        "topics": json.dumps(_flatten(data["mit_learn_topics"])),
        "ocw_topics": json.dumps(_flatten(data["topics"])),
        "content_tags": json.dumps(data["learning_resource_types"]),
        "instructors": json.dumps(data["instructors"]),
        "hide_download": data["hide_download"],
    }


def legacy_course(data: dict, slug: str = SLUG) -> dict:
    """
    Build what ocw.transform_course returns for a data.json, with the read time
    as its last_modified and the year as the view's integer
    """
    course = ocw.transform_course(
        {
            **data,
            "last_modified": READ_AT,
            "slug": f"courses/{slug}",
            "url": urljoin(OCW_URL, f"courses/{slug}/"),
        }
    )
    run = course["runs"][0]
    run["year"] = int(run["year"]) if run["year"] else None
    return course


@pytest.mark.parametrize("hide_download", [True, False])
@pytest.mark.parametrize("has_learn_topics", [True, False])
def test_transform_course_matches_the_ocw_etl(
    data_json, hide_download, has_learn_topics
):
    """
    A course built from the view is the course the OCW ETL builds from the
    same data.json: instructors, levels, course numbers, delivery and topics,
    falling back to the OCW topics when the course has no MIT Learn topics
    """
    data_json["hide_download"] = hide_download
    if not has_learn_topics:
        data_json["mit_learn_topics"] = []

    expected = legacy_course(data_json)
    result = warehouse_ocw.transform_course(view_row(data_json))

    assert result == expected
    run = result["runs"][0]
    assert run["instructors"][2] == {
        "first_name": "Paul",
        "last_name": "Lagace",
        "full_name": "Prof. Paul A. Lagace",
    }
    assert run["level"] == ["undergraduate", "high_school"]
    assert [number["value"] for number in result["course"]["course_numbers"]] == [
        "16.01",
        "16.02",
        "16.03",
        "16.04",
    ]
    assert result["delivery"] == run["delivery"]
    assert (LearningResourceDelivery.offline.name in result["delivery"]) is not (
        hide_download
    )
    assert result["topics"] == (
        [
            {"name": "Anthropology"},
            {"name": "Political Science"},
            {"name": "Social Sciences"},
        ]
        if has_learn_topics
        else [{"name": "Anthropology"}, {"name": "Philosophy"}]
    )


@pytest.mark.parametrize(
    ("term", "year"), [("Spring", "2005"), (None, "2005"), ("Fall", None), (None, None)]
)
def test_transform_course_without_a_term_or_year(data_json, term, year):
    """A course with no term or year has a run with neither"""
    data_json["term"] = term
    data_json["year"] = year
    data_json["extra_course_numbers"] = None

    assert warehouse_ocw.transform_course(view_row(data_json)) == legacy_course(
        data_json
    )


@pytest.mark.parametrize(
    "column",
    ["level", "departments", "topics", "ocw_topics", "content_tags"],
)
@pytest.mark.parametrize("as_type", [list, bytes])
def test_transform_course_reads_warehouse_types(data_json, column, as_type):
    """Arrays arrive as lists, text or bytes"""
    row = view_row(data_json)
    expected = warehouse_ocw.transform_course(row)
    value = json.loads(row[column])
    row[column] = value if as_type is list else json.dumps(value).encode()

    assert warehouse_ocw.transform_course(row) == expected


@pytest.mark.parametrize(("hide_download", "offline"), [(1, False), (0, True)])
def test_transform_course_reads_hide_download_as_a_number(
    data_json, hide_download, offline
):
    """StarRocks may send a boolean as 0 or 1"""
    row = {**view_row(data_json), "hide_download": hide_download}

    delivery = warehouse_ocw.transform_course(row)["delivery"]

    assert (LearningResourceDelivery.offline.name in delivery) is offline


def test_transform_course_with_empty_columns(data_json):
    """A course with no image, description, instructors or arrays still loads"""
    row = {
        **view_row(data_json),
        "description": None,
        "image_url": None,
        "image_alt": None,
        "image_description": None,
        "instructors": "[]",
        "extra_course_numbers": None,
        "level": None,
        "departments": None,
        "topics": None,
        "ocw_topics": None,
        "content_tags": None,
    }

    result = warehouse_ocw.transform_course(row)

    assert result["description"] == ""
    assert result["image"] == {"url": None, "description": None, "alt": None}
    assert result["runs"][0]["image"] == {"url": None, "description": "", "alt": ""}
    assert result["runs"][0]["instructors"] == []
    assert result["runs"][0]["level"] == []
    assert result["topics"] == []
    assert len(result["course"]["course_numbers"]) == 1


def test_sync_courses_writes_nothing_without_the_course_pair(mocker, data_json):
    """Until the warehouse owns ocw course nothing is loaded"""
    mock_load = mocker.patch("learning_resources.etl.warehouse_ocw.loaders.load_course")

    with writing_as(Pipeline.WAREHOUSE):
        count = warehouse_ocw.sync_courses([view_row(data_json)])

    assert count == 0
    mock_load.assert_not_called()


def test_sync_courses_loads_and_unpublishes(warehouse_owns_ocw, data_json):
    """Listed courses are loaded with their run, and unlisted ones unpublished"""
    gone = LearningResourceFactory.create(
        etl_source=ETLSource.ocw.name,
        resource_type=COURSE,
        published=True,
        platform__code=PlatformType.ocw.name,
    )
    other = {**data_json, "legacy_uid": "a-b-c", "primary_course_number": "18.06"}
    rows = [view_row(data_json), view_row(other, slug="18-06-linear-algebra")]

    with writing_as(Pipeline.WAREHOUSE):
        count = warehouse_ocw.sync_courses(rows, allow_mass_unpublish=True)

    assert count == len(rows)
    gone.refresh_from_db()
    assert gone.published is False
    for row in rows:
        resource = LearningResource.objects.get(
            etl_source=ETLSource.ocw.name, url=row["url"]
        )
        assert resource.published is True
        assert resource.readable_id == row["readable_id"]
        assert resource.last_modified == READ_AT
        run = resource.runs.get(published=True)
        assert run.run_id == row["run_id"]
        assert run.year == row["year"]
        assert run.semester == row["term"]
        assert run.instructors.count() == len(data_json["instructors"])
        assert sorted(resource.departments.values_list("department_id", flat=True)) == [
            "16"
        ]
        assert sorted(resource.resource_tags.values_list("name", flat=True)) == sorted(
            data_json["learning_resource_types"]
        )


def test_sync_courses_matches_courses_on_url(warehouse_owns_ocw, data_json):
    """
    A course is matched on its URL, so a new term or year updates its readable
    id and does not add a second course, or count against the unpublish limit
    """
    row = view_row(data_json)
    existing = LearningResourceFactory.create(
        etl_source=ETLSource.ocw.name,
        resource_type=COURSE,
        published=True,
        readable_id="16.01+spring_2004",
        url=row["url"],
        platform__code=PlatformType.ocw.name,
    )

    with writing_as(Pipeline.WAREHOUSE):
        warehouse_ocw.sync_courses([row])

    existing.refresh_from_db()
    assert existing.readable_id == row["readable_id"]
    assert existing.published is True
    assert LearningResource.objects.filter(url=row["url"]).count() == 1


def test_sync_courses_loads_a_course_stored_as_newer(warehouse_owns_ocw, data_json):
    """
    The OCW ETL skips a course whose stored last_modified is not older than its
    data.json, when it finds the course. The sync loads every listed course.
    """
    row = view_row(data_json)
    existing = LearningResourceFactory.create(
        etl_source=ETLSource.ocw.name,
        resource_type=COURSE,
        published=True,
        readable_id=row["readable_id"],
        url=row["url"],
        title="Stale title",
        last_modified=READ_AT + timedelta(days=1),
        platform__code=PlatformType.ocw.name,
    )

    with writing_as(Pipeline.WAREHOUSE):
        warehouse_ocw.sync_courses([row])

    existing.refresh_from_db()
    assert existing.title == row["title"]
    assert existing.last_modified == READ_AT


def test_sync_courses_skips_unchanged_courses(
    warehouse_owns_ocw, data_json, mock_search
):
    """
    A course whose transformed row hashes as it did when loaded is neither
    loaded nor reindexed, nor unpublished, and a changed row is loaded
    """
    row = view_row(data_json)
    with writing_as(Pipeline.WAREHOUSE):
        assert warehouse_ocw.sync_courses([row], allow_mass_unpublish=True) == 1
    mock_search.upsert.reset_mock()

    with writing_as(Pipeline.WAREHOUSE):
        assert warehouse_ocw.sync_courses([row]) == 0

    mock_search.upsert.assert_not_called()
    resource = LearningResource.objects.get(url=row["url"])
    assert resource.published is True

    with writing_as(Pipeline.WAREHOUSE):
        assert warehouse_ocw.sync_courses([{**row, "title": "New title"}]) == 1

    resource.refresh_from_db()
    assert resource.title == "New title"


@pytest.mark.parametrize("change", ["unpublished", "loaded_elsewhere"])
def test_sync_courses_reloads_a_course_changed_since_its_hash(
    warehouse_owns_ocw, data_json, change
):
    """
    An unchanged row is loaded again for a course since unpublished, or since
    written by a load that doesn't hash its data
    """
    row = view_row(data_json)
    with writing_as(Pipeline.WAREHOUSE):
        warehouse_ocw.sync_courses([row], allow_mass_unpublish=True)
    resource = LearningResource.objects.get(url=row["url"])
    if change == "unpublished":
        LearningResource.objects.filter(pk=resource.pk).update(published=False)
    else:
        loaders.load_course(warehouse_ocw.transform_course(row), [])
        resource.refresh_from_db()
        assert resource.etl_checksum is None

    with writing_as(Pipeline.WAREHOUSE):
        assert warehouse_ocw.sync_courses([row], allow_mass_unpublish=True) == 1

    resource.refresh_from_db()
    assert resource.published is True
    assert resource.etl_checksum == warehouse_ocw.course_checksum(
        warehouse_ocw.transform_course(row)
    )


def test_sync_courses_unpublishes_a_newly_blocklisted_course(
    mocker, warehouse_owns_ocw, data_json
):
    """An unchanged course added to the blocklist is loaded, and so unpublished"""
    row = view_row(data_json)
    with writing_as(Pipeline.WAREHOUSE):
        warehouse_ocw.sync_courses([row], allow_mass_unpublish=True)
    resource = LearningResource.objects.get(url=row["url"])
    assert resource.published is True

    mocker.patch(
        "learning_resources.etl.warehouse_ocw.load_course_blocklist",
        return_value=[resource.readable_id],
    )
    with writing_as(Pipeline.WAREHOUSE):
        warehouse_ocw.sync_courses([row], allow_mass_unpublish=True)

    resource.refresh_from_db()
    assert resource.published is False


def test_sync_courses_loads_the_other_rows_when_one_fails(
    mocker, warehouse_owns_ocw, data_json
):
    """A row that fails is raised after the rest load, and is not unpublished"""
    good = view_row(data_json)
    bad = view_row(
        {**data_json, "legacy_uid": "a-b-c", "primary_course_number": "18.06"},
        slug="18-06-linear-algebra",
    )
    existing = LearningResourceFactory.create(
        etl_source=ETLSource.ocw.name,
        resource_type=COURSE,
        published=True,
        url=bad["url"],
        platform__code=PlatformType.ocw.name,
    )
    load_course = loaders.load_course

    def load_or_fail(course, *args, **kwargs):
        if course["url"] == bad["url"]:
            raise ValueError
        return load_course(course, *args, **kwargs)

    mocker.patch(
        "learning_resources.etl.warehouse_ocw.loaders.load_course",
        side_effect=load_or_fail,
    )

    with (
        writing_as(Pipeline.WAREHOUSE),
        pytest.raises(ExtractException, match=re.escape(bad["url"])),
    ):
        warehouse_ocw.sync_courses([good, bad], allow_mass_unpublish=True)

    assert LearningResource.objects.get(url=good["url"]).published is True
    existing.refresh_from_db()
    assert existing.published is True


def test_sync_courses_refuses_an_empty_view(warehouse_owns_ocw):
    """An empty view is a failed build, not an empty catalog"""
    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_ocw.sync_courses([])


def test_sync_courses_refuses_to_unpublish_more_than_the_limit(
    warehouse_owns_ocw, data_json
):
    """A view that lists only part of the bucket fails unwritten"""
    published = LearningResourceFactory.create_batch(
        5,
        etl_source=ETLSource.ocw.name,
        resource_type=COURSE,
        published=True,
        platform__code=PlatformType.ocw.name,
    )

    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_ocw.sync_courses([view_row(data_json)])

    for resource in published:
        resource.refresh_from_db()
        assert resource.published is True
    assert not LearningResource.objects.filter(
        readable_id=view_row(data_json)["readable_id"]
    ).exists()
