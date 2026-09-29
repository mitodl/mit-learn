"""Tests for the audit_olx_references command"""

from io import StringIO

from django.core.management import call_command

from learning_resources.etl.constants import ETLSource


def test_audit_olx_references_applies_the_source(tmp_path):
    """The report counts the about files the given platform would drop"""
    olx = tmp_path / "course"
    for rel, text in {
        "course.xml": '<course url_name="run" org="MITx" course="1"/>',
        "about/overview.html": "<p>about</p>",
        "about/effort.html": "5",
    }.items():
        (olx / rel).parent.mkdir(parents=True, exist_ok=True)
        (olx / rel).write_text(text)

    def about_line(*args):
        out = StringIO()
        call_command("audit_olx_references", str(olx), *args, stdout=out)
        return next(line for line in out.getvalue().splitlines() if "about/" in line)

    assert about_line().split(":")[1].strip() == "2"
    assert about_line("--source", ETLSource.oll.name).split(":")[1].strip() == "1"
