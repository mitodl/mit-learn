"""Common ETL test fixtures"""

import pytest


@pytest.fixture(autouse=True)
def etl_settings(settings):
    """Global ETL test settings"""
    settings.SKIP_TIKA = False
    return settings
