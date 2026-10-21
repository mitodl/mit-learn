"""Tests for the warehouse-pull MITx Online loading"""

import copy
import json
import re
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urljoin

import pytest

from learning_resources.constants import (
    LearningResourceRelationTypes,
    LearningResourceType,
    PlatformType,
    RunStatus,
)
from learning_resources.etl import mitxonline, warehouse_mitxonline
from learning_resources.etl.constants import (
    CourseLoaderConfig,
    ETLSource,
    ProgramLoaderConfig,
)
from learning_resources.etl.exceptions import ExtractException
from learning_resources.etl.ownership import Pipeline, writing_as
from learning_resources.etl.utils import (
    get_department_id_by_name,
    parse_certification,
)
from learning_resources.factories import (
    ETLSourceOwnershipFactory,
    LearningResourceDepartmentFactory,
    LearningResourceFactory,
    LearningResourcePlatformFactory,
)
from learning_resources.models import LearningResource
from learning_resources.test_utils import set_up_topics

pytestmark = pytest.mark.django_db

COURSE = LearningResourceType.course.name
PROGRAM = LearningResourceType.program.name
NOW = datetime(2023, 1, 1, tzinfo=UTC)
# A Wagtail product page as the pages API lists it, with the sections
# full_description is built from
CMS_PAGE = {
    "about": '<p>About <a linktype="page" id="3">this</a> <img src="x.png"></p>',
    "what_you_learn": "<ul><li>Regression</li></ul>",
    "prerequisites": "",
    "faqs": [
        {"id": 1, "question": "Is it free?", "answer": "<p>Auditing is free.</p>"},
        {"id": 2, "question": "", "answer": "<p>dropped</p>"},
    ],
}


@pytest.fixture(autouse=True)
def _setup(mocker, settings):
    """
    Create the platform, offeror, topics and departments, and fix the clock and
    base URLs
    """
    set_up_topics(is_mitx=True)
    LearningResourcePlatformFactory.create(code=PlatformType.mitxonline.name)
    for name in ("Mathematics", "Physics"):
        LearningResourceDepartmentFactory.create(
            department_id=get_department_id_by_name(name), name=name
        )
    mocker.patch("learning_resources.etl.mitxonline.now_in_utc", return_value=NOW)
    settings.MITX_ONLINE_BASE_URL = "https://mitxonline.mit.edu"
    settings.APP_BASE_URL = "https://learn.example.test/"


@pytest.fixture(autouse=True)
def mock_search(mocker):
    """Mock out the search index tasks, the topic lookup and the blocklist"""
    mocker.patch("learning_resources_search.plugins.get_similar_topics_qdrant")
    mocker.patch(
        "learning_resources.etl.loaders.load_course_blocklist", return_value=[]
    )
    return SimpleNamespace(
        upsert=mocker.patch("learning_resources_search.tasks.upsert_learning_resource"),
        deindex=mocker.patch("learning_resources_search.tasks.deindex_document"),
    )


@pytest.fixture
def warehouse_owns_mitxonline():
    """Name the warehouse as the owner of the mitxonline pairs"""
    for resource_type in (COURSE, PROGRAM):
        _own(resource_type)


@pytest.fixture
def api_courses():
    """
    Load the MITx Online courses API response the API ETL tests use, with a
    B2B-only run and a run in a non-default language added
    """
    courses = json.loads(Path("./test_json/mitxonline_courses.json").read_text())[
        "results"
    ]
    b2b_run = copy.deepcopy(courses[0]["courseruns"][0])
    b2b_run.update(id=900, courseware_id=f"{b2b_run['courseware_id']}_B2B")
    b2b_run["b2b_only"] = True
    language_run = copy.deepcopy(courses[0]["courseruns"][0])
    language_run.update(
        id=901,
        courseware_id=f"{language_run['courseware_id']}_es",
        language="es",
        possible_variant_sets=[
            {"language": "en", "default_variant": True},
            {"language": "es", "default_variant": False},
        ],
    )
    courses[0]["courseruns"].extend([b2b_run, language_run])
    courses[0][mitxonline.CMS_PAGE_KEY] = CMS_PAGE
    return courses


@pytest.fixture
def api_programs():
    """
    Load the MITx Online programs API response the API ETL tests use. The real
    API strips the tags from a page description; the fixture's keep them.
    """
    programs = json.loads(Path("./test_json/mitxonline_programs.json").read_text())[
        "results"
    ]
    for program in programs:
        program["page"]["description"] = re.sub(
            r"<[^>]+>", "", program["page"]["description"]
        )
    programs[0][mitxonline.CMS_PAGE_KEY] = CMS_PAGE
    return programs


def _own(resource_type):
    """Name the warehouse as the owner of one mitxonline pair"""
    ETLSourceOwnershipFactory.create(
        etl_source=ETLSource.mitxonline.name,
        resource_type=resource_type,
        owner=Pipeline.WAREHOUSE,
    )


def _array(values) -> str:
    """Render an array column as StarRocks sends it, JSON text"""
    return json.dumps(values)


def _decimals(amounts) -> str:
    """Render an array(decimal) column as StarRocks sends it"""
    return f"[{','.join(str(amount) for amount in amounts)}]"


def _section_columns(cms_page: dict | None) -> dict:
    """Build the page section columns, null unless the pages API lists the page"""
    if cms_page is None:
        return dict.fromkeys(
            ("about", "what_you_learn", "prerequisites", "faqs"), None
        ) | {"has_catalog_page": False}
    return {
        "has_catalog_page": True,
        "about": cms_page["about"],
        "what_you_learn": cms_page["what_you_learn"],
        "prerequisites": cms_page["prerequisites"],
        "faqs": _array(
            [
                {"question": faq["question"], "answer": faq["answer"]}
                for faq in cms_page["faqs"]
            ]
        ),
    }


def _page_columns(api: dict) -> dict:
    """Columns a course row and a program row share, from an API object"""
    page = api.get("page") or {}
    return {
        "readable_id": api["readable_id"],
        "title": api["title"],
        "etl_source": "mitxonline",
        "platform": "mitxonline",
        "description": page.get("description"),
        "image_url": (
            urljoin("https://mitxonline.mit.edu", page["feature_image_src"])
            if page.get("feature_image_src")
            else None
        ),
        "has_page": bool(page.get("page_url")),
        **_section_columns(api.get(mitxonline.CMS_PAGE_KEY)),
        "topics": _array([topic["name"] for topic in api.get("topics", [])]),
        "departments": _array(
            [department["name"] for department in api.get("departments", [])]
        ),
        "certification_type": api.get("certificate_type"),
        "availability": api.get("availability"),
        "duration": api.get("duration"),
        "min_weeks": api.get("min_weeks"),
        "max_weeks": api.get("max_weeks"),
        "time_commitment": api.get("time_commitment"),
        "min_weekly_hours": api.get("min_weekly_hours"),
        "max_weekly_hours": api.get("max_weekly_hours"),
    }


def run_row(api_run: dict, api_course: dict) -> dict:
    """Build the integrations__learn__mitxonline_runs row of an API run"""
    page = api_course.get("page") or {}
    is_variant = bool(api_run.get("b2b_only")) or mitxonline._is_non_default_variant(  # noqa: SLF001
        api_run
    )
    fully_enrollable = mitxonline.is_fully_enrollable(api_run)
    return {
        "readable_id": api_course["readable_id"],
        "run_id": api_run["courseware_id"],
        "title": api_run["title"],
        "start_date": api_run["start_date"] or api_run["enrollment_start"],
        "end_date": api_run["end_date"],
        "enrollment_start": api_run["enrollment_start"],
        "enrollment_end": api_run["enrollment_end"],
        "published": bool(
            not is_variant and api_run["is_enrollable"] and page.get("live")
        ),
        "b2b_only": bool(api_run.get("b2b_only")),
        "is_variant": is_variant,
        "status": (
            RunStatus.current.value
            if page.get("page_url") and fully_enrollable
            else RunStatus.archived.value
        ),
        "pace": "self_paced" if api_run["is_self_paced"] else "instructor_paced",
        "language": api_run.get("language"),
        "course_number": api_run["course_number"],
        "has_verified_mode": any(
            mode["mode_slug"] == "verified" for mode in api_run["enrollment_modes"]
        ),
        "prices": _decimals(
            price["amount"]
            for price in mitxonline.parse_prices(
                api_course,
                api_run["enrollment_modes"],
                fully_enrollable=fully_enrollable,
            )
        ),
        "instructors": _array(
            [instructor["name"] for instructor in page.get("instructors", [])]
        ),
    }


def run_rows(api_course: dict) -> list[dict]:
    """Build the integrations__learn__mitxonline_runs rows of an API course"""
    return [run_row(run, api_course) for run in api_course["courseruns"]]


def course_row(api_course: dict) -> dict:
    """Build the integrations__learn__mitxonline_courses row of an API course"""
    page = api_course.get("page") or {}
    runs = run_rows(api_course)
    by_recency = sorted(
        api_course["courseruns"],
        key=lambda run: run["start_date"] or run["enrollment_start"] or "",
        reverse=True,
    )
    course_numbers = list(dict.fromkeys(run["course_number"] for run in by_recency))
    return {
        **_page_columns(api_course),
        "published": bool(
            page.get("page_url")
            and page.get("live")
            and any(run["published"] for run in runs)
            and api_course["include_in_learn_catalog"]
        ),
        "include_in_learn_catalog": api_course["include_in_learn_catalog"],
        "ingest_content_files_for_ai": api_course.get(
            "ingest_content_files_for_ai", False
        ),
        "course_numbers": _array(course_numbers),
        "certification": any(
            run["published"]
            and run["status"] == RunStatus.current.value
            and run["has_verified_mode"]
            for run in runs
        ),
        "pace": _array(sorted({run["pace"] for run in runs})),
        "min_price": api_course.get("min_price"),
        "max_price": api_course.get("max_price"),
    }


def program_row(api_program: dict) -> dict:
    """Build the integrations__learn__mitxonline_programs row of an API program"""
    page = api_program.get("page") or {}
    has_page = bool(page.get("page_url"))
    modes = api_program.get("enrollment_modes", [])
    return {
        **_page_columns(api_program),
        "published": bool(
            has_page and page.get("live") and page.get("include_in_learn_catalog")
        ),
        "display_mode": api_program.get("display_mode"),
        "certification": parse_certification(
            mitxonline.OFFERED_BY["code"],
            [
                {
                    "published": has_page,
                    "status": RunStatus.current.value
                    if has_page
                    else RunStatus.archived.value,
                    "enrollment_modes": modes,
                }
            ],
        ),
        "start_date": api_program["start_date"] or api_program["enrollment_start"],
        "end_date": api_program["end_date"],
        "enrollment_start": api_program["enrollment_start"],
        "enrollment_end": api_program.get("enrollment_end"),
        "prices": _decimals(
            price["amount"] for price in mitxonline.parse_prices(api_program, modes)
        ),
    }


def children_rows(api_programs: list[dict], api_courses: list[dict]) -> list[dict]:
    """
    Build the integrations__learn__mitxonline_program_children rows of the API
    programs, listing a course only when its page is live
    """
    programs_by_id = {program["id"]: program for program in api_programs}
    courses_by_id = {
        course["id"]: course
        for course in api_courses
        if (course.get("page") or {}).get("live")
    }
    rows = []
    for program in api_programs:
        tree = program.get("req_tree", [])
        positions = mitxonline.get_child_positions(tree, programs_by_id)
        rows.extend(
            {
                "readable_id": program["readable_id"],
                "child_resource_type": COURSE,
                "child_readable_id": courses_by_id[course_id]["readable_id"],
                "child_display_mode": None,
                "child_position": positions[(COURSE, course_id)],
            }
            for course_id in mitxonline.get_course_ids_from_req_tree(
                tree, programs_by_id
            )
            if course_id in courses_by_id
        )
        rows.extend(
            {
                "readable_id": program["readable_id"],
                "child_resource_type": PROGRAM,
                "child_readable_id": programs_by_id[program_id]["readable_id"],
                "child_display_mode": programs_by_id[program_id].get("display_mode"),
                "child_position": positions.get((PROGRAM, program_id)),
            }
            for program_id in mitxonline.get_program_ids_from_req_tree(tree)
            if program_id in programs_by_id
        )
    return rows


def _mock_fetch_courses(mocker, api_courses):
    """Answer the API ETL's course lookup from the fixture, live pages only"""
    by_id = {course["id"]: course for course in api_courses}
    mocker.patch(
        "learning_resources.etl.mitxonline._fetch_courses_by_ids",
        side_effect=lambda course_ids: [
            by_id[course_id]
            for course_id in course_ids
            if course_id in by_id and (by_id[course_id].get("page") or {}).get("live")
        ],
    )


def test_transform_course_matches_the_api_etl(api_courses):
    """A course built from the views is the course the API ETL builds"""
    expected = mitxonline.transform_courses(api_courses)

    result = [
        warehouse_mitxonline.transform_course(course_row(course), run_rows(course))
        for course in api_courses
    ]

    assert result == expected
    assert any(course["topics"] for course in result)
    assert any("full_description" in course for course in result)
    assert not all("full_description" in course for course in result)
    assert any(run["is_variant"] for course in result for run in course["runs"])
    assert any(course["certification"] for course in result)


def _expected_program(program: dict) -> dict:
    """
    Cut the API ETL's program's courses down to what the loader reads when it
    only looks them up
    """
    program["courses"] = [
        {
            "readable_id": course["readable_id"],
            "platform": course["platform"],
            "resource_type": COURSE,
            "position": course["position"],
        }
        for course in program["courses"]
    ]
    return program


@pytest.mark.parametrize(
    "programs_file",
    ["mitxonline_programs.json", "mitxonline_child_program_positions.json"],
)
def test_transform_program_matches_the_api_etl(
    mocker, api_courses, api_programs, programs_file
):
    """
    A program built from the views is the program the API ETL builds, apart
    from its courses, which the loader only looks up
    """
    programs = (
        api_programs
        if programs_file == "mitxonline_programs.json"
        else json.loads(Path(f"./test_json/{programs_file}").read_text())
    )
    _mock_fetch_courses(mocker, api_courses)
    expected = [
        _expected_program(program)
        for program in mitxonline.transform_programs(programs)
    ]
    children = children_rows(programs, api_courses)
    course_paces = {
        row["readable_id"]: json.loads(row["pace"])
        for row in (course_row(course) for course in api_courses)
    }

    result = [
        warehouse_mitxonline.transform_program(
            program_row(program),
            [
                child
                for child in children
                if child["readable_id"] == program["readable_id"]
            ],
            course_paces,
        )
        for program in programs
    ]

    assert result == expected
    assert any(program["courses"] for program in result) or any(
        program["child_programs"] for program in result
    )


def test_transform_program_orders_children_by_position():
    """
    Children with a position keep it, and child programs without one follow in
    readable id order, which the loader numbers them by
    """
    row = program_row(
        json.loads(Path("./test_json/mitxonline_programs.json").read_text())["results"][
            0
        ]
    )
    children = [
        {
            "readable_id": row["readable_id"],
            "child_resource_type": resource_type,
            "child_readable_id": readable_id,
            "child_display_mode": display_mode,
            "child_position": position,
        }
        for resource_type, readable_id, display_mode, position in [
            (PROGRAM, "program-b", "program", None),
            (COURSE, "course-2", None, 2),
            (PROGRAM, "program-c", "course", 1),
            (PROGRAM, "program-a", None, None),
            (COURSE, "course-0", None, 0),
        ]
    ]
    course_paces = {"course-0": ["self_paced"], "course-2": ["instructor_paced"]}

    result = warehouse_mitxonline.transform_program(row, children, course_paces)

    assert [
        (course["readable_id"], course["position"]) for course in result["courses"]
    ] == [
        ("course-0", 0),
        ("course-2", 2),
    ]
    assert [
        (child["readable_id"], child["position"]) for child in result["child_programs"]
    ] == [("program-c", 1), ("program-a", None), ("program-b", None)]
    assert result["pace"] == ["instructor_paced", "self_paced"]
    assert result["runs"][0]["pace"] == result["pace"]


@pytest.mark.parametrize(
    ("description", "expected"),
    [
        (None, ""),
        ("", ""),
        ("Plain text", "Plain text"),
        (
            '<p data-block-key="x">Signals &amp; <b>systems</b></p>',
            "Signals &amp; systems",
        ),
        ("<ul><li>One</li><li>Two</li></ul>", "OneTwo"),
    ],
)
def test_transform_course_strips_description_tags_as_the_api_does(
    api_courses, description, expected
):
    """The view has the page's HTML, and the API strips its tags before Learn cleans it"""
    row = {**course_row(api_courses[0]), "description": description}

    assert (
        warehouse_mitxonline.transform_course(row, run_rows(api_courses[0]))[
            "description"
        ]
        == expected
    )


@pytest.mark.parametrize(
    ("sections", "expected"),
    [
        ({"has_catalog_page": False}, {}),
        (
            {"has_catalog_page": True, "faqs": "[]"},
            {"full_description": None},
        ),
        (
            {
                "has_catalog_page": True,
                "prerequisites": "<p>Calculus</p>",
                "faqs": '[{"question": "When?", "answer": "<p>Now</p>"}]',
            },
            {
                "full_description": "## Prerequisites\n\nCalculus\n\n"
                "## Frequently asked questions\n\n### When?\n\nNow"
            },
        ),
    ],
)
def test_transform_course_full_description(api_courses, sections, expected):
    """
    full_description is built from the sections of a page the pages API lists,
    and left out for one it does not, so the stored value stays
    """
    row = {
        **course_row(api_courses[1]),
        **_section_columns(None),
        **sections,
    }

    result = warehouse_mitxonline.transform_course(row, run_rows(api_courses[1]))

    assert {
        key: value for key, value in result.items() if key == "full_description"
    } == expected


@pytest.mark.parametrize(
    ("prices", "expected"),
    [
        (
            "[0.00,123.00,456.00]",
            [Decimal("0.00"), Decimal("123.00"), Decimal("456.00")],
        ),
        (b"[0.00]", [Decimal("0.00")]),
        ([Decimal("0.00"), Decimal("99.00")], [Decimal("0.00"), Decimal("99.00")]),
        (None, []),
    ],
)
def test_transform_run_reads_warehouse_prices(api_courses, prices, expected):
    """Price arrays arrive as JSON text, bytes or lists, and stay Decimal"""
    course = course_row(api_courses[0])
    run = {**run_rows(api_courses[0])[0], "prices": prices}

    result = warehouse_mitxonline.transform_run(run, course)

    assert [price["amount"] for price in result["prices"]] == expected
    assert all(isinstance(price["amount"], Decimal) for price in result["prices"])


def test_transform_course_without_a_page_or_runs(api_courses):
    """A course with no page has no URL or image, and one with no runs no pace"""
    row = {
        **course_row(api_courses[0]),
        "has_page": False,
        "image_url": None,
        "published": False,
        "course_numbers": None,
        "topics": None,
        "departments": None,
    }

    result = warehouse_mitxonline.transform_course(row, [])

    assert result["url"] is None
    assert result["image"] is None
    assert result["runs"] == []
    assert result["pace"] == []
    assert result["course"] == {"course_numbers": []}
    assert result["topics"] == []
    assert result["departments"] == []


@pytest.mark.parametrize("owned", [None, PROGRAM])
def test_sync_courses_writes_nothing_without_the_course_pair(
    mocker, api_courses, owned
):
    """Owning nothing, or only the programs, does not let the courses load"""
    if owned:
        _own(owned)
    mock_load = mocker.patch(
        "learning_resources.etl.warehouse_mitxonline.loaders.load_courses"
    )

    with writing_as(Pipeline.WAREHOUSE):
        count = warehouse_mitxonline.sync_courses(
            [course_row(api_courses[0])], run_rows(api_courses[0])
        )

    assert count == 0
    mock_load.assert_not_called()


@pytest.mark.parametrize("owned", [None, COURSE])
def test_sync_programs_writes_nothing_without_the_program_pair(
    mocker, api_courses, api_programs, owned
):
    """Owning nothing, or only the courses, does not let the programs load"""
    if owned:
        _own(owned)
    mock_load = mocker.patch(
        "learning_resources.etl.warehouse_mitxonline.loaders.load_programs"
    )

    with writing_as(Pipeline.WAREHOUSE):
        count = warehouse_mitxonline.sync_programs(
            [program_row(api_programs[0])],
            children_rows(api_programs, api_courses),
            [course_row(course) for course in api_courses],
        )

    assert count == 0
    mock_load.assert_not_called()


def test_sync_courses_loads_and_unpublishes(warehouse_owns_mitxonline, api_courses):
    """
    Listed courses are loaded with their runs, B2B and language variants
    unpublished, and unlisted courses unpublished
    """
    gone = LearningResourceFactory.create(
        etl_source=ETLSource.mitxonline.name,
        resource_type=COURSE,
        published=True,
        platform__code=PlatformType.mitxonline.name,
    )

    with writing_as(Pipeline.WAREHOUSE):
        count = warehouse_mitxonline.sync_courses(
            [course_row(course) for course in api_courses],
            [run for course in api_courses for run in run_rows(course)],
            allow_mass_unpublish=True,
        )

    assert count == len(api_courses)
    gone.refresh_from_db()
    assert gone.published is False
    for course in api_courses:
        resource = LearningResource.objects.get(
            etl_source=ETLSource.mitxonline.name, readable_id=course["readable_id"]
        )
        rows = run_rows(course)
        assert resource.published is course_row(course)["published"]
        assert (
            resource.url
            == f"https://learn.example.test/courses/{course['readable_id']}"
        )
        for row in rows:
            run = resource.runs.get(run_id=row["run_id"])
            assert run.published is row["published"]
            assert run.b2b_only is row["b2b_only"]
            assert run.is_variant is row["is_variant"]
    variants = LearningResource.objects.get(
        readable_id=api_courses[0]["readable_id"]
    ).runs.filter(is_variant=True)
    assert variants.count() == 2
    assert not variants.filter(published=True).exists()


def _as_starrocks(row: dict) -> dict:
    """Send a row's booleans as StarRocks does, as 0 or 1"""
    return {
        key: int(value) if isinstance(value, bool) else value
        for key, value in row.items()
    }


@pytest.mark.parametrize("starrocks_booleans", [False, True])
def test_sync_courses_writes_what_the_api_etl_writes(
    mocker, warehouse_owns_mitxonline, api_courses, starrocks_booleans
):
    """
    The loader receives the same courses, with the same config, from the views
    as from the API ETL, whether booleans arrive as bools or as 0 and 1
    """
    mock_load = mocker.patch(
        "learning_resources.etl.warehouse_mitxonline.loaders.load_courses",
        return_value=[],
    )
    convert = _as_starrocks if starrocks_booleans else dict

    with writing_as(Pipeline.WAREHOUSE):
        warehouse_mitxonline.sync_courses(
            [convert(course_row(course)) for course in api_courses],
            [convert(run) for course in api_courses for run in run_rows(course)],
            allow_mass_unpublish=True,
        )

    result = mock_load.call_args.args[1]
    assert mock_load.call_args.args[0] == ETLSource.mitxonline.name
    assert result == mitxonline.transform_courses(api_courses)
    assert all(
        isinstance(course[key], bool)
        for course in result
        for key in ("published", "certification", "force_ingest")
    )
    assert all(
        isinstance(run[key], bool)
        for course in result
        for run in course["runs"]
        for key in ("published", "b2b_only", "is_variant")
    )
    assert mock_load.call_args.kwargs == {"config": CourseLoaderConfig(prune=True)}


@pytest.mark.parametrize("starrocks_booleans", [False, True])
def test_sync_programs_loads_with_the_api_etl_config(
    mocker, warehouse_owns_mitxonline, api_courses, api_programs, starrocks_booleans
):
    """
    The loader gets the API ETL's program config, and bools whether booleans
    arrive as bools or as 0 and 1
    """
    mock_load = mocker.patch(
        "learning_resources.etl.warehouse_mitxonline.loaders.load_programs",
        return_value=[],
    )
    convert = _as_starrocks if starrocks_booleans else dict

    with writing_as(Pipeline.WAREHOUSE):
        warehouse_mitxonline.sync_programs(
            [convert(program_row(program)) for program in api_programs],
            children_rows(api_programs, api_courses),
            [convert(course_row(course)) for course in api_courses],
            allow_mass_unpublish=True,
        )

    assert mock_load.call_args.kwargs == {
        "config": ProgramLoaderConfig(
            courses=CourseLoaderConfig(fetch_only=True), prune=True
        )
    }
    for program in mock_load.call_args.args[1]:
        assert isinstance(program["published"], bool)
        assert isinstance(program["certification"], bool)
        assert isinstance(program["runs"][0]["published"], bool)


def test_sync_programs_loads_and_links_courses(
    warehouse_owns_mitxonline, api_courses, api_programs
):
    """A program is loaded with its run and linked to its published courses in order"""
    for course in api_courses:
        LearningResourceFactory.create(
            etl_source=ETLSource.mitxonline.name,
            resource_type=COURSE,
            published=True,
            readable_id=course["readable_id"],
            platform__code=PlatformType.mitxonline.name,
        )
    children = children_rows(api_programs, api_courses)

    with writing_as(Pipeline.WAREHOUSE):
        count = warehouse_mitxonline.sync_programs(
            [program_row(program) for program in api_programs],
            children,
            [course_row(course) for course in api_courses],
        )

    assert count == len(api_programs)
    for program in api_programs:
        resource = LearningResource.objects.get(
            etl_source=ETLSource.mitxonline.name,
            resource_type=PROGRAM,
            readable_id=program["readable_id"],
        )
        assert resource.published is program_row(program)["published"]
        assert resource.runs.get(run_id=program["readable_id"]).published is True
        assert list(
            resource.children.filter(
                relation_type=LearningResourceRelationTypes.PROGRAM_COURSES
            )
            .order_by("position")
            .values_list("child__readable_id", "position")
        ) == [
            (child["child_readable_id"], child["child_position"])
            for child in sorted(children, key=lambda child: child["child_position"])
            if child["readable_id"] == program["readable_id"]
        ]


@pytest.mark.parametrize(
    ("courses", "runs"), [([], [{"readable_id": "a"}]), ([{"readable_id": "a"}], [])]
)
def test_sync_courses_refuses_an_empty_view(warehouse_owns_mitxonline, courses, runs):
    """An empty view is a failed build, not an empty catalog"""
    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_mitxonline.sync_courses(courses, runs)


def test_sync_courses_refuses_to_unpublish_more_than_the_limit(
    warehouse_owns_mitxonline, api_courses
):
    """A sync that would unpublish most of the published courses fails unwritten"""
    published = LearningResourceFactory.create_batch(
        5,
        etl_source=ETLSource.mitxonline.name,
        resource_type=COURSE,
        published=True,
        platform__code=PlatformType.mitxonline.name,
    )

    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_mitxonline.sync_courses(
            [course_row(api_courses[0])], run_rows(api_courses[0])
        )

    for resource in published:
        resource.refresh_from_db()
        assert resource.published is True


@pytest.mark.parametrize("empty", ["programs", "children", "courses"])
def test_sync_programs_refuses_an_empty_view(
    warehouse_owns_mitxonline, api_courses, api_programs, empty
):
    """An empty programs, children or courses view is a failed build"""
    views = {
        "programs": [program_row(program) for program in api_programs],
        "children": children_rows(api_programs, api_courses),
        "courses": [course_row(course) for course in api_courses],
        empty: [],
    }
    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_mitxonline.sync_programs(
            views["programs"], views["children"], views["courses"]
        )


def test_sync_programs_refuses_to_unpublish_more_than_the_limit(
    warehouse_owns_mitxonline, api_courses, api_programs
):
    """A sync that would unpublish most of the published programs fails unwritten"""
    published = LearningResourceFactory.create_batch(
        5,
        etl_source=ETLSource.mitxonline.name,
        resource_type=PROGRAM,
        published=True,
        platform__code=PlatformType.mitxonline.name,
    )

    with writing_as(Pipeline.WAREHOUSE), pytest.raises(ExtractException):
        warehouse_mitxonline.sync_programs(
            [program_row(api_programs[0])],
            children_rows(api_programs, api_courses),
            [course_row(course) for course in api_courses],
        )

    for resource in published:
        resource.refresh_from_db()
        assert resource.published is True
