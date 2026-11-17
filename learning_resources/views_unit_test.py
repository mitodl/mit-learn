"""Tests for the units API"""

from datetime import timedelta

import pytest
from rest_framework.reverse import reverse

from learning_resources.constants import CONTENT_FILE_LARGE_FIELDS
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceRunFactory,
    UnitContentFileFactory,
    UnitFactory,
)
from learning_resources.models import Unit, UnitContentFile
from main.utils import now_in_utc

pytestmark = pytest.mark.django_db




@pytest.mark.parametrize("endpoint", ["list", "detail"])
@pytest.mark.parametrize("logged_in", [True, False])
def test_units_api_is_admin_only(client, user, endpoint, logged_in):
    """Learners and anonymous users cannot use the units API"""
    unit = UnitFactory.create()
    if logged_in:
        client.force_login(user)
    args = [unit.id] if endpoint == "detail" else []

    resp = client.get(reverse(f"lr:v1:units_api-{endpoint}", args=args))

    assert resp.status_code == 403


def test_list_units(staff_client):
    """Units list in run order with a count of all their content files"""
    run = LearningResourceRunFactory.create()
    second = UnitFactory.create(run=run, position=2)
    first = UnitFactory.create(run=run, position=1)
    UnitContentFileFactory.create_batch(2, unit=first)
    UnitContentFileFactory.create(unit=first, content_file__published=False)

    url = reverse("lr:v1:units_api-list")
    assert url == "/api/v1/units/"
    resp = staff_client.get(url)

    assert resp.status_code == 200
    assert [unit["id"] for unit in resp.data["results"]] == [first.id, second.id]
    listed = resp.data["results"][0]
    # the unpublished file counts too
    assert listed["content_file_count"] == 3
    assert listed["run_id"] == run.id
    assert listed["run_readable_id"] == run.run_id
    assert listed["resource_id"] == run.learning_resource.id
    assert listed["resource_readable_id"] == run.learning_resource.readable_id
    assert "content_files" not in listed


@pytest.mark.parametrize(
    "unpublished", ["run__published", "run__learning_resource__published"]
)
def test_list_units_includes_unpublished(staff_client, unpublished):
    """Admins see the units of unpublished runs and resources too"""
    hidden = UnitFactory.create(**{unpublished: False})
    shown = UnitFactory.create()

    resp = staff_client.get(reverse("lr:v1:units_api-list"))

    assert {unit["id"] for unit in resp.data["results"]} == {hidden.id, shown.id}


def test_list_units_filtered(staff_client):
    """Units filter by run, resource, kind and content file"""
    unit = UnitFactory.create()
    context = UnitFactory.create(
        run=unit.run, kind=Unit.Kind.CONTEXT, external_id="context", position=None
    )
    other = UnitFactory.create()
    membership = UnitContentFileFactory.create(unit=unit)
    # a second unit holding the same file
    UnitContentFile.objects.create(unit=other, content_file=membership.content_file)
    url = reverse("lr:v1:units_api-list")

    def ids(query):
        return {
            result["id"]
            for result in staff_client.get(f"{url}?{query}").data["results"]
        }

    assert ids(f"run_id={unit.run_id}") == {unit.id, context.id}
    assert ids(f"resource_id={other.run.learning_resource_id}") == {other.id}
    assert ids("kind=context") == {context.id}
    assert ids(f"run_id={unit.run_id}&kind=unit") == {unit.id}
    second_file = UnitContentFileFactory.create(unit=unit).content_file
    resp = staff_client.get(
        f"{url}?content_file_id={membership.content_file_id}"
        f"&content_file_id={second_file.id}"
    )
    # once each, though the unit holds both files
    assert sorted(result["id"] for result in resp.data["results"]) == sorted(
        [unit.id, other.id]
    )


@pytest.mark.parametrize(
    "hidden",
    [
        {"content_file__published": False},
        {"content_file__release_date": now_in_utc() + timedelta(days=1)},
    ],
)
def test_list_units_content_file_filter_finds_hidden_files(staff_client, hidden):
    """Filtering by a hidden content file finds the units that hold it"""
    membership = UnitContentFileFactory.create(**hidden)
    url = reverse("lr:v1:units_api-list")

    resp = staff_client.get(f"{url}?content_file_id={membership.content_file_id}")

    assert [result["id"] for result in resp.data["results"]] == [membership.unit_id]


def test_get_unit_lists_its_content_files(staff_client):
    """A unit's detail lists all its content files in unit order, hidden ones too"""
    unit = UnitFactory.create()
    later = UnitContentFileFactory.create(
        unit=unit, position=2, relation=UnitContentFile.Relation.ASSESSMENT
    )
    earlier = UnitContentFileFactory.create(unit=unit, position=1)
    unpublished = UnitContentFileFactory.create(
        unit=unit, position=3, content_file__published=False
    )
    release_date = now_in_utc() + timedelta(days=1)
    unreleased = UnitContentFileFactory.create(
        unit=unit, position=4, content_file__release_date=release_date
    )
    # a file of the same run outside the unit
    ContentFileFactory.create(run=unit.run)

    url = reverse("lr:v1:units_api-detail", args=[unit.id])
    assert url == f"/api/v1/units/{unit.id}/"
    resp = staff_client.get(url)

    assert resp.status_code == 200
    assert resp.data["id"] == unit.id
    assert resp.data["title"] == unit.title
    assert resp.data["kind"] == unit.kind
    assert resp.data["content_file_count"] == 4
    files = resp.data["content_files"]
    assert [entry["content_file"]["id"] for entry in files] == [
        earlier.content_file_id,
        later.content_file_id,
        unpublished.content_file_id,
        unreleased.content_file_id,
    ]
    assert [(entry["relation"], entry["position"]) for entry in files[:2]] == [
        ("core", 1),
        ("assessment", 2),
    ]
    assert files[0]["content_file"]["key"] == earlier.content_file.key
    # admins can tell which files learners cannot see
    assert [entry["content_file"]["published"] for entry in files] == [
        True,
        True,
        False,
        True,
    ]
    assert files[0]["content_file"]["release_date"] is None
    assert files[3]["content_file"]["release_date"] is not None
    # run and resource fields are on the unit, not repeated for each file
    for field in [*CONTENT_FILE_LARGE_FIELDS, "run_id", "topics", "departments"]:
        assert field not in files[0]["content_file"]


def test_get_unit_query_count(staff_client, django_assert_max_num_queries):
    """The detail's query count does not grow with the unit's content files"""
    unit = UnitFactory.create()
    UnitContentFileFactory.create_batch(10, unit=unit)
    url = reverse("lr:v1:units_api-detail", args=[unit.id])

    with django_assert_max_num_queries(20):
        resp = staff_client.get(url)

    assert len(resp.data["content_files"]) == 10


def test_get_unpublished_unit(staff_client):
    """Admins can open a unit of an unpublished run"""
    unit = UnitFactory.create(run__published=False)

    resp = staff_client.get(reverse("lr:v1:units_api-detail", args=[unit.id]))

    assert resp.status_code == 200
    assert resp.data["id"] == unit.id
