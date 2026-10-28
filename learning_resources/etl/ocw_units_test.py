"""Tests for deriving OCW units from content files"""

import logging

import pytest

from learning_resources.constants import (
    CONTENT_TYPE_FILE,
    CONTENT_TYPE_PAGE,
    CONTENT_TYPE_PDF,
    CONTENT_TYPE_VIDEO,
)
from learning_resources.etl.ocw_units import (
    build_units_from_content_files,
    content_file_key_from_link,
)
from learning_resources.factories import (
    ContentFileFactory,
    LearningResourceContentTagFactory,
    LearningResourceRunFactory,
)
from learning_resources.models import Unit, UnitContentFile

pytestmark = pytest.mark.django_db

COURSE_PATH = "courses/test-course/"

CORE = UnitContentFile.Relation.CORE
ASSESSMENT = UnitContentFile.Relation.ASSESSMENT
REFERENCE = UnitContentFile.Relation.REFERENCE


def key(path):
    """Return the content file key for a path in the test course"""
    return f"{COURSE_PATH}{path}/"


def link(path, text):
    """Return an anchor to a path in the test course"""
    return f'<a href="/{COURSE_PATH}{path}/">{text}</a>'


def navigation(previous_path=None, next_path=None):
    """Return the Previous/Next links OCW puts at the top of a page"""
    links = []
    if previous_path:
        links.append(link(previous_path, "Previous"))
    if next_path:
        links.append(link(next_path, "Next"))
    return f"<p>« {' | '.join(links)} »</p>"


def create_page(run, path, title, html):
    """Create a page content file in the test course"""
    return ContentFileFactory.create(
        run=run,
        key=key(path),
        url=f"https://ocw.mit.edu/{key(path)}",
        title=title,
        content=html,
        content_type=CONTENT_TYPE_PAGE,
        file_type=None,
        content_tags=[],
    )


def create_resource(
    run, path, *, content_type=CONTENT_TYPE_PDF, file_type=None, tag_names=()
):
    """Create a resource content file in the test course"""
    return ContentFileFactory.create(
        run=run,
        key=key(path),
        title=path,
        content_type=content_type,
        file_type=file_type,
        content_tags=[
            LearningResourceContentTagFactory.create(name=tag_name)
            for tag_name in tag_names
        ],
    )


def create_illustrative_course(*, include_previous_next_links):
    """
    Create a small course: a syllabus, two sections with lessons, an
    assignments page, a textbook page and the resources they link
    """
    run = LearningResourceRunFactory.create()

    def page_navigation(previous_path, next_path):
        if not include_previous_next_links:
            return ""
        return navigation(previous_path, next_path)

    create_page(
        run,
        "pages/syllabus",
        "Syllabus",
        page_navigation(None, "pages/foundations")
        + link("resources/welcome-video", "Welcome video"),
    )
    create_page(
        run,
        "pages/foundations",
        "Foundations",
        page_navigation("pages/syllabus", "pages/foundations/lesson-1")
        + link("pages/foundations/lesson-1", "Lesson 1")
        + link("pages/foundations/problem-set-1", "Problem Set 1"),
    )
    create_page(
        run,
        "pages/foundations/lesson-1",
        "Lesson 1",
        page_navigation("pages/foundations", "pages/foundations/problem-set-1")
        + link("resources/lesson-1-video", "Lesson 1 video"),
    )
    create_page(
        run,
        "pages/foundations/problem-set-1",
        "Problem Set 1",
        page_navigation("pages/foundations/lesson-1", "pages/applications")
        + link("resources/pset-1", "Problem Set 1 PDF"),
    )
    create_page(
        run,
        "pages/applications",
        "Applications",
        page_navigation(
            "pages/foundations/problem-set-1", "pages/applications/lesson-2"
        )
        + link("pages/applications/lesson-2", "Lesson 2"),
    )
    create_page(
        run,
        "pages/applications/lesson-2",
        "Lesson 2",
        page_navigation("pages/applications", None)
        + link("resources/lesson-2-video", "Lesson 2 video")
        + f'<img src="/{COURSE_PATH}0123abcd_diagram.svg">'
        + '<a href="https://example.com/more">More</a>'
        + link("pages/foundations/lesson-1", "Review Lesson 1"),
    )
    create_page(
        run,
        "pages/assignments",
        "Assignments",
        link("resources/pset-1", "Problem Set 1 PDF"),
    )
    create_page(
        run,
        "pages/textbook",
        "Textbook",
        link("resources/chapter-1", "Chapter 1"),
    )
    for video_path in (
        "resources/welcome-video",
        "resources/lesson-1-video",
        "resources/lesson-2-video",
    ):
        create_resource(run, video_path, content_type=CONTENT_TYPE_VIDEO)
    create_resource(run, "resources/pset-1", tag_names=["Assignments"])
    create_resource(run, "resources/chapter-1", tag_names=["Open Textbooks"])
    create_resource(run, "resources/orphan-notes")
    create_resource(
        run,
        "resources/diagram",
        content_type=CONTENT_TYPE_FILE,
        file_type="image/svg+xml",
    )
    return run


def build_units(run):
    """Build units from a run's content files"""
    return build_units_from_content_files(
        run.content_files.prefetch_related("content_tags")
    )


def test_build_units_from_content_files():
    """Sections become ordered units, with context and bins for everything else"""
    run = create_illustrative_course(include_previous_next_links=True)

    units = build_units(run)

    # Previous/Next order wins over title order, which would put Applications first
    assert [(unit["kind"], unit["title"]) for unit in units] == [
        (Unit.Kind.UNIT, "Foundations"),
        (Unit.Kind.UNIT, "Applications"),
        (Unit.Kind.CONTEXT, "Course context"),
        (Unit.Kind.BIN, "Textbook"),
        (Unit.Kind.BIN, CONTENT_TYPE_PDF),
    ]
    foundations, applications, context, textbook, leftovers = units
    assert foundations["external_id"] == key("pages/foundations")
    assert foundations["url"] == f"https://ocw.mit.edu/{key('pages/foundations')}"
    assert list(foundations["content_files"].items()) == [
        (key("pages/foundations"), REFERENCE),
        (key("pages/foundations/lesson-1"), CORE),
        (key("resources/lesson-1-video"), CORE),
        (key("pages/foundations/problem-set-1"), CORE),
        (key("resources/pset-1"), ASSESSMENT),
    ]
    # the cross link to Lesson 1, the inline image and the external link are left out
    assert list(applications["content_files"].items()) == [
        (key("pages/applications"), REFERENCE),
        (key("pages/applications/lesson-2"), CORE),
        (key("resources/lesson-2-video"), CORE),
    ]
    # Assignments links only a file a unit claimed, so it joins the context
    assert context["external_id"] == "context"
    assert context["content_files"] == {
        key("pages/syllabus"): CORE,
        key("resources/welcome-video"): CORE,
        key("pages/assignments"): CORE,
    }
    assert textbook["external_id"] == f"bin:{key('pages/textbook')}"
    assert textbook["content_files"] == {
        key("pages/textbook"): CORE,
        key("resources/chapter-1"): REFERENCE,
    }
    # the unlinked image is left out of the leftovers
    assert leftovers["external_id"] == f"bin:{CONTENT_TYPE_PDF}"
    assert leftovers["content_files"] == {key("resources/orphan-notes"): CORE}


def test_build_units_from_content_files_orders_by_title_without_navigation():
    """Without Previous/Next links, sections are ordered by title"""
    run = create_illustrative_course(include_previous_next_links=False)

    units = build_units(run)

    assert [unit["title"] for unit in units if unit["kind"] == Unit.Kind.UNIT] == [
        "Applications",
        "Foundations",
    ]


def test_build_units_from_content_files_flat_course(caplog):
    """A course without section pages gets context and bins, with a note logged"""
    caplog.set_level(logging.INFO)
    run = LearningResourceRunFactory.create()
    create_page(
        run,
        "pages/syllabus",
        "Syllabus",
        link("resources/welcome-video", "Welcome video"),
    )
    create_page(
        run, "pages/textbook", "Textbook", link("resources/chapter-1", "Chapter 1")
    )
    create_resource(run, "resources/welcome-video", content_type=CONTENT_TYPE_VIDEO)
    create_resource(run, "resources/chapter-1", tag_names=["Open Textbooks"])

    units = build_units(run)

    assert [(unit["kind"], unit["title"]) for unit in units] == [
        (Unit.Kind.CONTEXT, "Course context"),
        (Unit.Kind.BIN, "Textbook"),
    ]
    assert f"OCW course {COURSE_PATH} has no section pages" in caplog.text


def test_build_units_from_content_files_no_pages():
    """A run without pages gets no units"""
    run = LearningResourceRunFactory.create()
    create_resource(run, "resources/orphan-notes")

    assert build_units(run) == []


@pytest.mark.parametrize(
    ("link_url", "expected_key"),
    [
        (f"/{COURSE_PATH}pages/week-1/#Lesson_1", key("pages/week-1")),
        (f"/{COURSE_PATH}pages/week-1/lesson-1", key("pages/week-1/lesson-1")),
        (f"https://ocw.mit.edu/{COURSE_PATH}resources/notes/", key("resources/notes")),
        (f"/{COURSE_PATH}0123abcd_diagram.svg", None),
        (f"/{COURSE_PATH}pages/", None),
        ("/courses/other-course/pages/syllabus/", None),
        ("https://www.youtube.com/embed/abc123", None),
    ],
)
def test_content_file_key_from_link(link_url, expected_key):
    """Only links to the course's own pages and resources map to content file keys"""
    assert content_file_key_from_link(link_url, COURSE_PATH) == expected_key
