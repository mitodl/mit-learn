"""Pytest fixtures for video_shorts tests"""

import boto3
import pytest
from moto import mock_aws


@pytest.fixture
def mock_s3_bucket(settings):
    """
    Set up a mock S3 bucket with standard settings for video shorts tests.

    This fixture:
    - Configures required settings (AWS_STORAGE_BUCKET_NAME etc)
    - Creates a mock S3 bucket using moto
    - Returns the bucket resource for test use

    Usage:
        def test_something(mock_s3_bucket):
            mock_s3_bucket.put_object(Key="path/to/file.json", Body=b"data")
    """
    # Configure settings
    settings.AWS_STORAGE_BUCKET_NAME = "test-bucket"
    settings.AWS_S3_PREFIX = "media"
    settings.VIDEO_SHORTS_S3_PREFIX = "shorts/"
    settings.VIDEO_SHORTS_COUNT = 10  # Default limit

    # Create mock S3 bucket
    with mock_aws():
        s3 = boto3.resource("s3", region_name="us-east-1")
        bucket = s3.create_bucket(Bucket="test-bucket")
        yield bucket
