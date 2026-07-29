"""
Regression test for the AI-library import deferral work: boots Django and
serves one request in a fresh subprocess (so nothing is already cached in
sys.modules from other tests) and asserts that the packages this PR moved
out of the boot path haven't crept back in as a module-scope import.
"""

import json
import os
import subprocess
import sys
import textwrap
from pathlib import Path

# Packages that should only ever load lazily, inside the function/task that
# actually needs them -- never as a side effect of booting the app or
# serving an unrelated request. See PR #3683 and its review discussion.
OFFENDING_PACKAGES = [
    "tiktoken",
    "litellm",
    "langchain_core",
    "langchain_classic",
    "langchain_text_splitters",
    "opendataloader_pdf",
    "cv2",
    "pdf2image",
]

PROBE_SCRIPT = textwrap.dedent(
    """
    import json
    import sys

    import django

    django.setup()

    from django.test import Client

    response = Client().get("/health/liveness/")
    offenders = json.loads(__OFFENDERS_JSON__)

    print(
        json.dumps(
            {
                "status_code": response.status_code,
                "loaded": sorted(m for m in offenders if m in sys.modules),
            }
        )
    )
    """
).replace("__OFFENDERS_JSON__", repr(json.dumps(OFFENDING_PACKAGES)))


def test_boot_and_liveness_request_do_not_import_ai_libraries(tmp_path):
    """Booting Django and serving a request shouldn't import deferred AI libs"""
    script_path = tmp_path / "boot_imports_probe.py"
    script_path.write_text(PROBE_SCRIPT)

    result = subprocess.run(  # noqa: S603
        [sys.executable, str(script_path)],
        capture_output=True,
        text=True,
        env={
            **os.environ,
            "DJANGO_SETTINGS_MODULE": "main.settings",
            "PYTHONPATH": str(Path.cwd()),
        },
        timeout=60,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    output = json.loads(result.stdout.strip().splitlines()[-1])

    assert output["status_code"] == 200
    assert output["loaded"] == []
