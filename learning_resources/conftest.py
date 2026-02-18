"""Common test fixtures for learning_resources"""

from pathlib import Path

import boto3
import pytest

from learning_resources.constants import PlatformType
from learning_resources.factories import (
    ContentFileFactory,
    ContentSummarizerConfigurationFactory,
    LearningResourceDepartmentFactory,
    LearningResourceOfferorFactory,
    LearningResourcePlatformFactory,
    LearningResourceRunFactory,
)

TEST_PREFIX = "PROD/9/9.15/Fall_2007/9-15-biochemistry-and-pharmacology-of-synaptic-transmission-fall-2007/"  # noqa: E501

TEST_JSON_PATH = f"./test_json/{TEST_PREFIX}0"
TEST_JSON_FILES = [f.name for f in Path(TEST_JSON_PATH).iterdir() if f.is_file()]

OCW_TEST_PREFIX = "courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/"

OCW_TEST_JSON_PATH = f"./test_json/{OCW_TEST_PREFIX[:-1]}"


@pytest.fixture(autouse=True)
def content_file_settings(settings):
    """Set COURSE_ARCHIVE_BUCKET_NAME for tests"""
    settings.COURSE_ARCHIVE_BUCKET_NAME = "testbucket2"
    return settings


@pytest.fixture
def podcast_platform():
    """Return a  podcast platform"""
    return LearningResourcePlatformFactory.create(
        code=PlatformType.podcast.name, name=PlatformType.podcast.value
    )


def setup_s3(settings):
    """
    Set up the fake s3 data
    """
    # Fake the settings
    settings.AWS_ACCESS_KEY_ID = "abc"
    settings.AWS_SECRET_ACCESS_KEY = "abc"  # noqa: S105
    settings.OCW_CONTENT_BUCKET_NAME = "test_bucket"
    settings.OCW_LEARNING_COURSE_BUCKET_NAME = "testbucket2"
    # Create our fake bucket
    conn = boto3.resource(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    conn.create_bucket(Bucket=settings.OCW_CONTENT_BUCKET_NAME)

    # Add data to the fake bucket
    test_bucket = conn.Bucket(name=settings.OCW_CONTENT_BUCKET_NAME)
    for file in TEST_JSON_FILES:
        file_key = TEST_JSON_PATH.replace("./test_json/", "") + "/" + file
        with Path.open(Path(TEST_JSON_PATH, file)) as f:
            test_bucket.put_object(Key=file_key, Body=f.read())

    # Create our upload bucket
    conn = boto3.resource(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    conn.create_bucket(Bucket=settings.OCW_LEARNING_COURSE_BUCKET_NAME)


def add_file_to_bucket_recursive(bucket, file_base, s3_base, file_object):
    """
    Add file to fake s3 bucket
    """
    local_path = file_base + "/" + file_object
    file_key = s3_base + "/" + file_object

    if file_object[0] == ".":
        return

    elif (Path(file_base) / file_object).is_file():
        with Path.open(Path(local_path)) as f:
            bucket.put_object(Key=file_key, Body=f.read())
    else:
        for child in Path(local_path).iterdir():
            add_file_to_bucket_recursive(bucket, local_path, file_key, child.name)


@pytest.fixture(autouse=True)
def marketing_metadata_mocks(mocker):
    mocker.patch(
        "learning_resources.site_scrapers.base_scraper.BaseScraper.fetch_page",
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


def setup_s3_ocw(settings):
    """
    Set up the fake s3 data for OCW
    """
    # Fake the settings
    settings.AWS_ACCESS_KEY_ID = "abc"
    settings.AWS_SECRET_ACCESS_KEY = "abc"  # noqa: S105
    settings.OCW_LIVE_BUCKET = "test_bucket"
    # Create our fake bucket
    conn = boto3.resource(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    conn.create_bucket(Bucket=settings.OCW_LIVE_BUCKET)

    # Add data to the fake ocw next bucket
    ocw_next_bucket = conn.Bucket(name=settings.OCW_LIVE_BUCKET)

    base_folder = OCW_TEST_JSON_PATH.replace("./test_json/", "")

    for file in Path(OCW_TEST_JSON_PATH).iterdir():
        add_file_to_bucket_recursive(
            ocw_next_bucket, OCW_TEST_JSON_PATH, base_folder, file.name
        )
    LearningResourcePlatformFactory.create(code=PlatformType.ocw.name)
    LearningResourceOfferorFactory.create(is_ocw=True)
    LearningResourceDepartmentFactory.create(
        department_id="16", name="Aeronautics and Astronautics"
    )


@pytest.fixture
def summarizer_configuration(mocker):
    """Create a summarizer configuration"""
    mocker.patch(
        "learning_resources.content_summarizer.truncate_to_tokens", autospec=True
    )
    mocker.patch("learning_resources.content_summarizer.get_max_tokens", autospec=True)
    return ContentSummarizerConfigurationFactory.create()


@pytest.fixture
def processable_content_files(summarizer_configuration):
    """Create unprocessable content files"""
    learning_resource_run = LearningResourceRunFactory.create(
        learning_resource__platform=summarizer_configuration.platform
    )
    return ContentFileFactory.create_batch(
        3,
        content="This is a test content",
        summary="",
        flashcards=[],
        run=learning_resource_run,
        file_extension=summarizer_configuration.allowed_extensions[0],
        content_type=summarizer_configuration.allowed_content_types[0],
    )
