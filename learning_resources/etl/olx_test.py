"""Tests for learning_resources.etl.olx"""

import json

import pytest
from defusedxml import ElementTree

from learning_resources.etl.constants import ETLSource
from learning_resources.etl.olx import OlxArchive, get_edx_module_id
from learning_resources.models import LearningResourceRun


def _write_olx(root, rel, text):
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def _ingested(olx, etl_source=None, **kwargs):
    """Return the archive's ingestable paths, relative to its root and sorted"""
    return sorted(
        str(path.relative_to(olx))
        for path in OlxArchive(olx, etl_source, **kwargs).paths
    )


def _write_html(root, name, body):
    """Write an html block: html/<name>.xml pointing at html/<name>.html"""
    _write_olx(root, f"html/{name}.xml", f'<html filename="{name}"/>')
    _write_olx(root, f"html/{name}.html", body)


def test_olx_archive_skips_staff_only_subtrees(tmp_path):
    """Files under visible_to_staff_only subtrees (and their transcripts) are skipped"""
    olx = tmp_path / "course"
    _write_olx(olx, "course.xml", '<course url_name="run" org="MITx" course="1"/>')
    _write_olx(
        olx,
        "course/run.xml",
        '<course><chapter url_name="ch_ok"/><chapter url_name="ch_staff"/></course>',
    )
    _write_olx(
        olx, "chapter/ch_ok.xml", '<chapter><sequential url_name="seq_ok"/></chapter>'
    )
    _write_olx(
        olx,
        "sequential/seq_ok.xml",
        '<sequential><vertical url_name="v_ok"/><vertical url_name="v_staff"/></sequential>',
    )
    _write_olx(
        olx,
        "vertical/v_ok.xml",
        '<vertical><html url_name="h_ok"/><video url_name="vid_ok"/></vertical>',
    )
    _write_html(olx, "h_ok", "<p>visible</p>")
    _write_olx(
        olx,
        "video/vid_ok.xml",
        '<video url_name="vid_ok"><transcript language="en" src="visible.srt"/></video>',
    )
    _write_olx(
        olx,
        "vertical/v_staff.xml",
        '<vertical visible_to_staff_only="true"><problem url_name="p_staff"/></vertical>',
    )
    _write_olx(olx, "problem/p_staff.xml", "<problem/>")
    _write_olx(
        olx,
        "chapter/ch_staff.xml",
        '<chapter visible_to_staff_only="true"><sequential url_name="seq_staff"/></chapter>',
    )
    _write_olx(
        olx,
        "sequential/seq_staff.xml",
        '<sequential><vertical url_name="v_hidden"/></sequential>',
    )
    _write_olx(
        olx,
        "vertical/v_hidden.xml",
        '<vertical><html url_name="h_hidden"/><video url_name="vid_hidden"/></vertical>',
    )
    _write_olx(olx, "html/h_hidden.xml", '<html filename="h_hidden_file"/>')
    _write_olx(olx, "html/h_hidden_file.html", "<p>hidden</p>")
    _write_olx(
        olx,
        "video/vid_hidden.xml",
        '<video url_name="vid_hidden"><transcript language="en" src="hidden.srt"/></video>',
    )
    _write_olx(olx, "static/hidden.srt", "1\n00:00:00,000 --> 00:00:01,000\nhidden\n")
    _write_olx(olx, "static/visible.srt", "1\n00:00:00,000 --> 00:00:01,000\nvisible\n")
    _write_olx(olx, "tabs/syllabus.html", "<p>tab</p>")

    assert _ingested(olx) == [
        "chapter/ch_ok.xml",
        "course.xml",
        "course/run.xml",
        "html/h_ok.html",
        "html/h_ok.xml",
        "sequential/seq_ok.xml",
        "static/visible.srt",
        "tabs/syllabus.html",
        "vertical/v_ok.xml",
        "video/vid_ok.xml",
    ]


def test_olx_archive_keeps_transcripts_a_visible_video_shares(tmp_path):
    """A hidden copy of a video must not take the live copy's transcripts with it"""
    olx = tmp_path / "course"
    _write_olx(olx, "course.xml", '<course url_name="run" org="MITx" course="1"/>')
    _write_olx(
        olx,
        "course/run.xml",
        '<course><vertical url_name="v_ok"/>'
        '<vertical url_name="v_staff" visible_to_staff_only="true"/></course>',
    )
    _write_olx(
        olx, "vertical/v_ok.xml", '<vertical><video url_name="vid_ok"/></vertical>'
    )
    _write_olx(
        olx, "vertical/v_staff.xml", '<vertical><video url_name="vid_old"/></vertical>'
    )
    shared = '<transcript language="en" src="shared.srt"/>'
    _write_olx(olx, "video/vid_ok.xml", f'<video url_name="vid_ok">{shared}</video>')
    _write_olx(
        olx,
        "video/vid_old.xml",
        f'<video url_name="vid_old">{shared}'
        '<transcript language="es" src="hidden_only.srt"/></video>',
    )
    _write_olx(olx, "static/shared.srt", "1\n00:00:00,000 --> 00:00:01,000\nshared\n")
    _write_olx(olx, "static/hidden_only.srt", "1\n00:00:00,000 --> 00:00:01,000\nold\n")

    excluded = OlxArchive(olx).excluded
    assert olx / "static/shared.srt" not in excluded
    assert olx / "static/hidden_only.srt" in excluded
    assert olx / "video/vid_old.xml" in excluded


def test_olx_archive_keeps_a_block_a_visible_parent_also_holds(tmp_path):
    """A block under two parents is hidden only when every parent hides it"""
    olx = tmp_path / "course"
    _write_olx(olx, "course.xml", '<course url_name="run" org="MITx" course="1"/>')
    _write_olx(
        olx,
        "course/run.xml",
        '<course><vertical url_name="v_ok"/>'
        '<vertical url_name="v_staff" visible_to_staff_only="true"/></course>',
    )
    shared = '<video url_name="vid_shared"/>'
    _write_olx(olx, "vertical/v_ok.xml", f"<vertical>{shared}</vertical>")
    _write_olx(
        olx,
        "vertical/v_staff.xml",
        f'<vertical>{shared}<video url_name="vid_hidden"/></vertical>',
    )
    _write_olx(
        olx,
        "video/vid_shared.xml",
        '<video url_name="vid_shared"><transcript language="en" src="shared.srt"/></video>',
    )
    _write_olx(
        olx,
        "video/vid_hidden.xml",
        '<video url_name="vid_hidden"><transcript language="en" src="hidden.srt"/></video>',
    )
    _write_olx(olx, "static/shared.srt", "1\n00:00:00,000 --> 00:00:01,000\nshared\n")
    _write_olx(olx, "static/hidden.srt", "1\n00:00:00,000 --> 00:00:01,000\nhidden\n")

    excluded = OlxArchive(olx).excluded
    assert olx / "video/vid_shared.xml" not in excluded
    assert olx / "static/shared.srt" not in excluded
    assert olx / "video/vid_hidden.xml" in excluded
    assert olx / "static/hidden.srt" in excluded


def test_olx_archive_skips_staff_only_inline_structure(tmp_path):
    """Structure held inline in course.xml (no pointer files) is still filtered"""
    olx = tmp_path / "course"
    _write_olx(
        olx,
        "course.xml",
        '<course org="MITx" course="1">'
        '<chapter display_name="ok"><vertical><html url_name="h_ok"/></vertical></chapter>'
        '<chapter visible_to_staff_only="true"><vertical>'
        '<html url_name="h_staff"/><video url_name="vid_staff"/>'
        "</vertical></chapter>"
        "</course>",
    )
    _write_html(olx, "h_ok", "<p>visible</p>")
    _write_html(olx, "h_staff", "<p>hidden</p>")
    _write_olx(
        olx,
        "video/vid_staff.xml",
        '<video url_name="vid_staff"><transcript language="en" src="hidden.srt"/></video>',
    )
    _write_olx(olx, "static/hidden.srt", "1\n00:00:00,000 --> 00:00:01,000\nhidden\n")

    assert _ingested(olx) == ["course.xml", "html/h_ok.html", "html/h_ok.xml"]


@pytest.mark.parametrize("bad_file", ["course.xml", "chapter/a.xml"])
def test_olx_archive_malformed_block_fails_closed(tmp_path, bad_file):
    """A malformed block raises on first use, not when the archive is built"""
    olx = tmp_path / "course"
    _write_olx(olx, "course.xml", '<course url_name="run"/>')
    _write_olx(olx, "course/run.xml", '<course><chapter url_name="a"/></course>')
    _write_olx(olx, "chapter/a.xml", '<chapter visible_to_staff_only="true"/>')
    _write_olx(olx, bad_file, "<broken")
    archive = OlxArchive(olx)
    with pytest.raises(ElementTree.ParseError):
        archive.paths  # noqa: B018


def test_olx_archive_without_course_xml_is_not_olx(tmp_path):
    """Non-OLX trees (canvas, tutor problem sets) exclude nothing"""
    olx = tmp_path / "course"
    _write_olx(olx, "chapter/a.xml", '<chapter visible_to_staff_only="true"/>')
    _write_olx(olx, "web_resources/b.html", "<p>b</p>")
    archive = OlxArchive(olx)
    assert archive.is_olx is False
    assert archive.excluded == set()
    assert _ingested(olx) == ["chapter/a.xml", "web_resources/b.html"]


def test_olx_archive_root_may_be_a_file(tmp_path):
    """A path that is not even a directory has nothing to ingest"""
    not_a_dir = tmp_path / "empty.pdf"
    not_a_dir.write_bytes(b"")
    archive = OlxArchive(not_a_dir)
    assert archive.is_olx is False
    assert archive.paths == []
    assert (
        archive.video_metadata(LearningResourceRun(run_id="course-v1:test_run")) == {}
    )


def test_olx_archive_paths_honour_valid_file_types(tmp_path):
    """The caller's suffix list decides what is ingestable"""
    olx = tmp_path / "course"
    _write_olx(olx, "problems/set1.py", "print(1)")
    _write_olx(olx, "problems/set1.html", "<p>1</p>")
    assert _ingested(olx) == ["problems/set1.html"]
    assert _ingested(olx, valid_file_types=[".py"]) == ["problems/set1.py"]


def _tab_policy(olx, tabs):
    """Write the run's policy.json with the given tab list"""
    _write_olx(
        olx, "policies/run/policy.json", json.dumps({"course/run": {"tabs": tabs}})
    )


def _static_tab(slug, **flags):
    return {"type": "static_tab", "name": slug, "url_slug": slug, **flags}


def test_excluded_keys_spares_a_key_an_ingested_path_shares(tmp_path):
    """A key an ingested path shares is not excluded"""
    run = LearningResourceRun(run_id="course-v1:test_run")
    olx = _reference_olx(
        tmp_path,
        **{
            "subs_ABC123.srt.sjson": "{}",
            "subs ABC123.srt.sjson": "{}",
            "stale.pdf": "stale",
        },
    )
    _write_olx(olx, "vertical/v.xml", '<vertical><video url_name="vid"/></vertical>')
    _write_olx(olx, "video/vid.xml", '<video url_name="vid" sub="ABC123"/>')

    archive = OlxArchive(olx)
    assert olx / "static/subs ABC123.srt.sjson" in archive.excluded
    assert archive.excluded_keys(run) == {
        get_edx_module_id("course/static/stale.pdf", run)
    }


@pytest.mark.parametrize(
    ("video_xml", "expected"),
    [
        (
            (
                '<video url_name="test_video" display_name="A video">'
                '<transcript src="test_transcript1.srt"/>'
                '<transcript src="test_transcript2.srt"/></video>'
            ),
            {
                f"asset-v1:test_run+type@asset+block@test_transcript{n}.srt": {
                    "module_id": "block-v1:test_run+type@video+block@test_video",
                    "title": "A video",
                }
                for n in (1, 2)
            },
        ),
        # no url_name, no transcripts, malformed: nothing to map
        ('<video><transcript src="no_url_name.srt"/></video>', {}),
        ('<video url_name="test_video"></video>', {}),
        ("invalid xml content", {}),
        # no video directory at all
        (None, {}),
    ],
)
def test_video_metadata(tmp_path, video_xml, expected):
    """Each transcript a video declares maps to the video's key and title"""
    run = LearningResourceRun(run_id="course-v1:test_run")
    olx = _reference_olx(tmp_path)
    if video_xml:
        _write_olx(olx, "video/test_video.xml", video_xml)
        _write_olx(olx, "video/notes.txt", "not a block")

    assert OlxArchive(olx).video_metadata(run) == expected


def _reference_olx(tmp_path, html="<p>no links</p>", **static_files):
    """Minimal OLX course with one visible html block and the given static files"""
    olx = tmp_path / "course"
    _write_olx(olx, "course.xml", '<course url_name="run" org="MITx" course="1"/>')
    _write_olx(olx, "course/run.xml", '<course><chapter url_name="ch"/></course>')
    _write_olx(olx, "chapter/ch.xml", '<chapter><vertical url_name="v"/></chapter>')
    _write_olx(olx, "vertical/v.xml", '<vertical><html url_name="h"/></vertical>')
    _write_html(olx, "h", html)
    for name, text in static_files.items():
        _write_olx(olx, f"static/{name}", text)
    return olx


@pytest.mark.parametrize(
    ("reference", "kept"),
    [
        ('<a href="/static/notes.pdf">notes</a>', True),
        # courses also link assets by their asset key rather than /static/
        ('<a href="/asset-v1:MITx+1+run+type@asset+block/notes.pdf">n</a>', True),
        # percent-encoded and entity-escaped spellings are still references
        ('<a href="/static/notes%2Epdf">notes</a>', True),
        ('<a href="/static/notes.pdf?raw=1&amp;v=2">notes</a>', True),
        ("<p>nothing here</p>", False),
    ],
)
def test_olx_archive_static_reference_spellings(tmp_path, reference, kept):
    """A static file survives only if a block spells its name (hq#13350)"""
    olx = _reference_olx(tmp_path, reference, **{"notes.pdf": "pdf bytes"})
    assert ("static/notes.pdf" in _ingested(olx)) is kept


@pytest.mark.parametrize(
    "reference",
    [
        '<a href="/static/Course_Syllabus_V2.pdf">s</a>',
        '<a href="/static/Course Syllabus V2.pdf">s</a>',
        '<a href="/static/Course%20Syllabus%20V2.pdf">s</a>',
        # one name can mix the two spellings (15.671.1x spells its Turkish
        # transcripts "17 Principles_Turkish.srt")
        '<a href="/static/Course Syllabus_V2.pdf">s</a>',
        # an unlinked mention is a weak reference, but keeping the file costs
        # less than dropping something a learner can see
        "<p>The syllabus is Course Syllabus V2.pdf</p>",
    ],
)
def test_olx_archive_normalizes_spaces_and_underscores(tmp_path, reference):
    """A file stored with spaces matches a reference however it spells them"""
    olx = _reference_olx(tmp_path, reference, **{"Course Syllabus V2.pdf": "pdf"})
    assert "static/Course Syllabus V2.pdf" in _ingested(olx)


@pytest.mark.parametrize(
    ("reference", "kept"),
    [
        # a name that only appears inside a longer one is not referenced
        ('<a href="/static/final_exam.srt">exam</a>', False),
        # a space is where a name can start, so a reference written with one is
        # kept as a reference to the shorter name too
        ('<a href="/static/final exam.srt">exam</a>', True),
        # but anything a name can start after still counts
        ('<a href="/static/exam.srt">exam</a>', True),
        ("<p>the transcript is exam.srt</p>", True),
        ('<a href="/asset-v1:MITx+1+run+type@asset+block/exam.srt">e</a>', True),
    ],
)
def test_olx_archive_partial_names_are_not_references(tmp_path, reference, kept):
    """A link to final_exam.srt is not a link to exam.srt"""
    olx = _reference_olx(
        tmp_path, reference, **{"final_exam.srt": "1", "exam.srt": "2"}
    )
    assert ("static/exam.srt" in _ingested(olx)) is kept


def test_olx_archive_keeps_reuploaded_asset_keys(tmp_path):
    """Assets re-uploaded under a flattened asset key still match (15.671.1x)"""
    name = "asset-v1_MITx+15.671.1x+3T2020+type@asset+block@09_Conversation.pdf"
    olx = _reference_olx(tmp_path, **{name: "pdf"})
    _write_olx(
        olx,
        "html/h.html",
        '<a href="/asset-v1:MITxT+15.671.1x+2T2023+type@asset+block@'
        'asset-v1_MITx_15.671.1x_3T2020_type_asset_block_09_Conversation.pdf">c</a>',
    )
    assert f"static/{name}" in _ingested(olx)


def test_olx_archive_partial_name_does_not_unhide_staff_transcript(tmp_path):
    """A hidden video's transcript stays hidden when only its name's tail matches"""
    olx = _reference_olx(
        tmp_path,
        '<a href="/static/final_exam.srt">exam</a>',
        **{"exam.srt": "hidden", "final_exam.srt": "shown"},
    )
    _write_olx(
        olx,
        "chapter/ch.xml",
        '<chapter><vertical url_name="v"/>'
        '<vertical url_name="v_staff" visible_to_staff_only="true"/></chapter>',
    )
    _write_olx(
        olx, "vertical/v_staff.xml", '<vertical><video url_name="vid"/></vertical>'
    )
    _write_olx(
        olx,
        "video/vid.xml",
        '<video><transcript language="en" src="exam.srt"/></video>',
    )
    assert "static/exam.srt" not in _ingested(olx)


def test_olx_archive_ignores_asset_manifests(tmp_path):
    """Manifests list every asset, so they cannot count as references"""
    olx = _reference_olx(tmp_path, **{"stale.pdf": "stale"})
    _write_olx(olx, "policies/assets.json", '{"stale.pdf": {"filename": "stale.pdf"}}')
    _write_olx(olx, "assets/assets.xml", "<assets><asset>stale.pdf</asset></assets>")
    paths = _ingested(olx)
    assert "static/stale.pdf" not in paths
    assert "policies/assets.json" not in paths
    assert "assets/assets.xml" not in paths


def test_olx_archive_ignores_deleted_announcements(tmp_path):
    """Deleted announcements are archived by edX but no longer part of the course"""
    olx = _reference_olx(tmp_path, **{"old.pdf": "old", "new.pdf": "new"})
    _write_olx(
        olx,
        "info/updates.items.json",
        '[{"id": 1, "status": "deleted", "content": "see /static/old.pdf"},'
        ' {"id": 2, "status": "visible", "content": "see /static/new.pdf"}]',
    )
    paths = _ingested(olx)
    assert "static/old.pdf" not in paths
    assert "static/new.pdf" in paths
    # the file itself is a decade of announcements, not current course content
    assert "info/updates.items.json" not in paths


def test_olx_archive_skips_legacy_announcements(tmp_path):
    """updates.html is not ingested, but files its announcements link still are"""
    olx = _reference_olx(tmp_path, **{"notes.pdf": "notes"})
    _write_olx(
        olx,
        "info/updates.html",
        '<ol><li><h2>May 1</h2><a href="/static/notes.pdf">notes</a></li></ol>',
    )
    _write_olx(olx, "info/handouts.html", "<p>handouts</p>")
    paths = _ingested(olx)
    assert "info/updates.html" not in paths
    assert "static/notes.pdf" in paths
    # the Course Handouts box on the course home page
    assert "info/handouts.html" in paths


def test_olx_archive_drops_assets_only_staff_blocks_mention(tmp_path):
    """An answer key a hidden block links is unreferenced, not referenced"""
    olx = _reference_olx(tmp_path, **{"answers.pdf": "answers"})
    _write_olx(
        olx,
        "chapter/ch.xml",
        '<chapter><vertical url_name="v"/>'
        '<vertical url_name="v_staff" visible_to_staff_only="true"/></chapter>',
    )
    _write_olx(
        olx, "vertical/v_staff.xml", '<vertical><html url_name="h_staff"/></vertical>'
    )
    _write_html(olx, "h_staff", '<a href="/static/answers.pdf">key</a>')
    assert "static/answers.pdf" not in _ingested(olx)


def test_olx_archive_drafts_do_not_keep_assets(tmp_path):
    """Drafts are not ingested, so their links do not keep an asset alive"""
    olx = _reference_olx(tmp_path, **{"draft_only.pdf": "pdf"})
    _write_olx(olx, "drafts/html/d.html", '<a href="/static/draft_only.pdf">d</a>')
    assert "static/draft_only.pdf" not in _ingested(olx)


@pytest.mark.parametrize(
    "video_xml",
    [
        # every spelling of the attribute is valid XML and must be honoured
        '<video url_name="vid" sub="AbC123"/>',
        "<video url_name='vid' sub='AbC123'/>",
        '<video url_name="vid" sub = "AbC123"/>',
        '<video url_name="vid" youtube="1.00:AbC123"/>',
        '<video url_name="vid" youtube="0.75:Fast,1.00:AbC123,1.50:Slow"/>',
        '<video url_name="vid" youtube_id_1_0="AbC123"/>',
    ],
)
def test_olx_archive_keeps_legacy_transcripts(tmp_path, video_xml):
    """subs_<id>.srt.sjson is named for the video id, never for its own filename"""
    olx = _reference_olx(
        tmp_path,
        **{"subs_AbC123.srt.sjson": "{}", "es_subs_AbC123.srt.sjson": "{}"},
    )
    _write_olx(olx, "vertical/v.xml", '<vertical><video url_name="vid"/></vertical>')
    _write_olx(olx, "video/vid.xml", video_xml)
    paths = _ingested(olx)
    assert "static/subs_AbC123.srt.sjson" in paths
    assert "static/es_subs_AbC123.srt.sjson" in paths


def test_olx_archive_drops_orphaned_legacy_transcripts(tmp_path):
    """A legacy transcript whose video is gone belongs to an earlier offering"""
    olx = _reference_olx(
        tmp_path, **{"subs_Current.srt.sjson": "{}", "subs_Removed.srt.sjson": "{}"}
    )
    _write_olx(olx, "vertical/v.xml", '<vertical><video url_name="vid"/></vertical>')
    _write_olx(olx, "video/vid.xml", '<video url_name="vid" sub="Current"/>')
    paths = _ingested(olx)
    assert "static/subs_Current.srt.sjson" in paths
    assert "static/subs_Removed.srt.sjson" not in paths


def test_olx_archive_keeps_inline_video_transcripts(tmp_path):
    """A <video> inline in a parent declares its transcripts just as a file does"""
    olx = _reference_olx(tmp_path, **{"subs_Inline.srt.sjson": "{}"})
    _write_olx(
        olx,
        "vertical/v.xml",
        '<vertical><video url_name="vid" sub="Inline"/></vertical>',
    )
    assert "static/subs_Inline.srt.sjson" in _ingested(olx)


# non-UTF-8 bytes are malformed too, though the text is read leniently
@pytest.mark.parametrize("broken", [b"<tab", b"<tab>\xff</tab>"])
def test_olx_archive_malformed_xml_keeps_legacy_transcripts(tmp_path, broken):
    """Unknown video ids must not be read as "no video uses this transcript\""""
    olx = _reference_olx(tmp_path, **{"subs_AbC123.srt.sjson": "{}"})
    (olx / "tabs").mkdir()
    (olx / "tabs/broken.xml").write_bytes(broken)
    assert "static/subs_AbC123.srt.sjson" in _ingested(olx)


@pytest.mark.parametrize(
    ("tab", "kept"),
    [
        (_static_tab("resources", course_staff_only=False), True),
        # Studio exports every tab page it stores, but the LMS 404s a slug the
        # tab list does not name
        (_static_tab("other", course_staff_only=False), False),
        # these still render by URL, but no navigation leads a learner there
        (_static_tab("resources", course_staff_only=True), False),
        (_static_tab("resources", is_hidden=True), False),
    ],
)
# edX also reads tab pages from a folder named for the run
@pytest.mark.parametrize("tab_dir", ["tabs", "tabs/run"])
def test_olx_archive_skips_tabs_learners_cannot_reach(tmp_path, tab, kept, tab_dir):
    """Only the tab pages the course's navigation leads to are ingested"""
    olx = _reference_olx(tmp_path)
    _write_olx(olx, f"{tab_dir}/resources.html", "<p>resources</p>")
    _tab_policy(olx, [{"type": "courseware", "course_staff_only": False}, tab])
    assert (f"{tab_dir}/resources.html" in _ingested(olx)) is kept


@pytest.mark.parametrize(
    "policy",
    [
        None,
        "{broken",
        json.dumps({"course/run": {}}),
        json.dumps({"course/run": {"tabs": None}}),
    ],
)
def test_olx_archive_keeps_tabs_without_a_tab_list(tmp_path, policy):
    """A tab list that cannot be read is no reason to drop a tab page"""
    olx = _reference_olx(tmp_path)
    _write_olx(olx, "tabs/resources.html", "<p>resources</p>")
    if policy is not None:
        _write_olx(olx, "policies/run/policy.json", policy)
    assert "tabs/resources.html" in _ingested(olx)


def test_olx_archive_unlisted_tabs_do_not_keep_assets(tmp_path):
    """A page learners cannot reach does not make the files it links reachable"""
    olx = _reference_olx(tmp_path, **{"old.pdf": "old", "current.pdf": "current"})
    _write_olx(olx, "tabs/old.html", '<a href="/static/old.pdf">old</a>')
    _write_olx(olx, "tabs/current.html", '<a href="/static/current.pdf">now</a>')
    _tab_policy(olx, [_static_tab("current")])
    paths = _ingested(olx)
    assert "static/old.pdf" not in paths
    assert "static/current.pdf" in paths


def test_olx_archive_skips_policy_files_but_keeps_what_they_name(tmp_path):
    """Course settings are not content, but the textbooks they list are"""
    olx = _reference_olx(tmp_path, **{"book.pdf": "book"})
    textbook = {"tab_title": "Book", "chapters": [{"url": "/static/book.pdf"}]}
    _write_olx(
        olx,
        "policies/run/policy.json",
        json.dumps({"course/run": {"pdf_textbooks": [textbook]}}),
    )
    _write_olx(olx, "policies/run/grading_policy.json", '{"GRADER": []}')
    paths = _ingested(olx)
    assert "static/book.pdf" in paths
    assert [path for path in paths if path.startswith("policies/")] == []


@pytest.mark.parametrize(
    ("etl_source", "kept"),
    [
        # Open Learning Library is the only platform that shows the about page
        (ETLSource.oll.name, ["overview.html", "short_description.html"]),
        (ETLSource.mitxonline.name, []),
        (None, []),
    ],
)
# edX also reads about files from a folder named for the run
@pytest.mark.parametrize("about_dir", ["about", "about/run"])
def test_olx_archive_skips_about_files_learners_cannot_see(
    tmp_path, etl_source, kept, about_dir
):
    """About files are ingested only where the about page is shown, and only its prose"""
    olx = _reference_olx(tmp_path)
    for name in ("overview", "short_description", "effort", "prerequisites"):
        _write_olx(olx, f"{about_dir}/{name}.html", name)
    paths = _ingested(olx, etl_source)
    assert [path for path in paths if path.startswith("about/")] == [
        f"{about_dir}/{name}" for name in kept
    ]


def test_olx_archive_hidden_about_page_does_not_keep_assets(tmp_path):
    """A file only a hidden about page links is not reachable"""
    olx = _reference_olx(tmp_path, **{"intro.pdf": "pdf"})
    _write_olx(olx, "about/overview.html", '<a href="/static/intro.pdf">intro</a>')
    assert "static/intro.pdf" not in _ingested(olx, ETLSource.mitxonline.name)
    assert "static/intro.pdf" in _ingested(olx, ETLSource.oll.name)
