"""Fixtures for AWS"""

# pylint: disable=redefined-outer-name
import logging
from types import SimpleNamespace

import boto3
import pytest
from moto import mock_aws


@pytest.fixture(autouse=True)
def silence_s3_logging():
    """Only show S3 errors"""
    logging.getLogger("botocore").setLevel(logging.ERROR)


@pytest.fixture
def mock_s3_fixture():
    """Mock the S3 fixture for the duration of the test"""
    with mock_aws():
        yield


@pytest.fixture
def aws_settings(settings):
    """Default AWS test settings"""  # noqa: D401
    settings.AWS_ACCESS_KEY_ID = "aws_id"
    settings.AWS_SECRET_ACCESS_KEY = (  # pragma: allowlist secret`
        "aws_secret"  # noqa: S105
    )
    return settings


@pytest.fixture(autouse=True)
def ocw_aws_settings(aws_settings):
    """Default OCW test settings"""  # noqa: D401
    aws_settings.OCW_LEARNING_COURSE_BUCKET_NAME = (  # impossible bucket name
        "test-bucket"
    )
    return aws_settings


@pytest.fixture(autouse=True)
def posthog_aws_settings(aws_settings):
    """Default PostHog test settings"""  # noqa: D401
    aws_settings.POSTHOG_EVENT_BUCKET_NAME = (  # impossible bucket name
        "test-posthog-event-bucket"
    )
    return aws_settings


@pytest.fixture
def mock_ocw_learning_bucket(
    ocw_aws_settings,
    mock_s3_fixture,  # noqa: ARG001
):  # pylint: disable=unused-argument
    """Mock OCW learning bucket"""
    s3 = boto3.resource(
        "s3",
        aws_access_key_id=ocw_aws_settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=ocw_aws_settings.AWS_SECRET_ACCESS_KEY,
    )
    bucket = s3.create_bucket(Bucket=ocw_aws_settings.OCW_LEARNING_COURSE_BUCKET_NAME)
    return SimpleNamespace(s3=s3, bucket=bucket)


@pytest.fixture
def mock_course_archive_bucket(
    aws_settings,
    mock_s3_fixture,  # noqa: ARG001
):  # pylint: disable=unused-argument
    """Mock OCW learning bucket"""
    s3 = boto3.resource(
        "s3",
        aws_access_key_id=aws_settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=aws_settings.AWS_SECRET_ACCESS_KEY,
    )
    bucket = s3.create_bucket(Bucket=aws_settings.COURSE_ARCHIVE_BUCKET_NAME)
    return SimpleNamespace(s3=s3, bucket=bucket)


@pytest.fixture
def mock_posthog_event_bucket(
    posthog_aws_settings,
    mock_s3_fixture,  # noqa: ARG001
):  # pylint: disable=unused-argument
    """Mock PostHog event bucket"""
    s3 = boto3.resource(
        "s3",
        aws_access_key_id=posthog_aws_settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=posthog_aws_settings.AWS_SECRET_ACCESS_KEY,
    )
    bucket = s3.create_bucket(Bucket=posthog_aws_settings.POSTHOG_EVENT_BUCKET_NAME)
    return SimpleNamespace(s3=s3, bucket=bucket)
