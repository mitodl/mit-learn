"""Common ETL test fixtures"""

import json
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def mitx_settings(settings):
    """Test settings for MITx import"""
    settings.EDX_API_CLIENT_ID = "fake-client-id"
    settings.EDX_API_CLIENT_SECRET = (  # pragma: allowlist secret
        "fake-client-secret"  # noqa: S105
    )
    settings.EDX_API_ACCESS_TOKEN_URL = "http://localhost/fake/access/token/url"  # noqa: S105
    settings.EDX_API_URL = "http://localhost/fake/api/url"
    settings.EDX_BASE_URL = "http://localhost/fake/base/url"
    settings.EDX_ALT_URL = "http://localhost/fake/alt/url"
    return settings


@pytest.fixture
def mitx_course_data():
    """Catalog data fixture"""
    with open("./test_json/test_mitx_course.json") as f:  # noqa: PTH123
        yield json.loads(f.read())


@pytest.fixture
def non_mitx_course_data():
    """Catalog data fixture"""
    with open("./test_json/test_non_mitx_course.json") as f:  # noqa: PTH123
        yield json.loads(f.read())


@pytest.fixture
def mitx_programs_data():
    """Yield a data fixture for MITx programs"""
    with Path.open(Path("./test_json/test_mitx_programs.json")) as f:
        yield json.loads(f.read())


@pytest.fixture(autouse=True)
def marketing_metadata_mocks(mocker):
    mocker.patch(
        "learning_resources.etl.loaders._fetch_page",
        return_value="""
        <html>
        <body>
            <div class="container">
            <div class="learning-header">
              <h1>WHAT YOU WILL LEARN</h1>
              <p data-block-key="fq16h">MIT xPRO is collaborating with online
              education provider Emeritus to deliver this online program.</p>
            </div>
            <ul class="learning-outcomes-list d-flex flex-wrap justify-content-between">
              <li>Learn to code in Python</li>
              <li>Use SQL to create databases</li>
              <li>Wrangle and analyze millions of pieces of
              data using databases in Python</li>
              <li>Understand how networks work, including IPs,
              security, and servers</li>
              <li>Manage big data using data warehousing and
              workflow management platforms</li>
              <li>Use cutting-edge data engineering
              platforms and tools to manage data</li>
              <li>Explore artificial intelligence
              and machine learning concepts,
              including reinforcement learning and deep neural networks</li>
            </ul>
          </div>
        </body>
        </html>""",
    )
