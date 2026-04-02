import importlib

import pytest

import learning_resources.site_scrapers.constants as scraper_constants
import learning_resources.site_scrapers.utils as scraper_utils
from learning_resources.site_scrapers.base_scraper import BaseScraper
from learning_resources.site_scrapers.mitx_program_page_scraper import (
    MITXProgramPageScraper,
)
from learning_resources.site_scrapers.react_mui_page_scraper import (
    ReactMUIPageScraper,
)
from learning_resources.site_scrapers.utils import scraper_for_site


@pytest.mark.parametrize(
    ("url", "expected_scraper_class"),
    [
        ("https://example.com", BaseScraper),
        ("https://micromasters.mit.edu/ds/", MITXProgramPageScraper),
        ("https://micromasters.mit.edu/ds", MITXProgramPageScraper),
        ("https://unknownsite.com", BaseScraper),
        (
            "https://executive.mit.edu/course/innovation-executive-academy/a05U1000005l8nFIAQ.html",
            BaseScraper,
        ),
        ("https://learn.mit.edu/programs/test-program/", ReactMUIPageScraper),
        ("https://learn.mit.edu/programs/test-program", ReactMUIPageScraper),
        ("https://learn.mit.edu/courses/test-course/", ReactMUIPageScraper),
        ("https://learn.mit.edu/courses/test-course", ReactMUIPageScraper),
    ],
)
def test_scraper_for_site(mocker, url, expected_scraper_class):
    """
    Test that scraper_for_site returns the correct scraper class based on the URL
    """

    scraper = scraper_for_site(url)
    assert isinstance(scraper, expected_scraper_class)


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com",
        "http://micromasters.mit.edu/ds/",
        "http://unknownsite.com",
        "http://executive.mit.edu/course/innovation-executive-academy/a05U1000005l8nFIAQ.html",
    ],
)
def test_scraper_forces_https(mocker, url):
    """
    Test that the scraper class forces https for the start url
    """

    scraper = scraper_for_site(url)
    assert "http://" not in scraper.start_url
    assert "https://" in scraper.start_url


@pytest.fixture
def set_mitx_online_base_url(settings):
    """Set MITX_ONLINE_BASE_URL and reload scraper modules for the test."""
    original_base_url = settings.MITX_ONLINE_BASE_URL

    def _setter(base_url):
        settings.MITX_ONLINE_BASE_URL = base_url
        importlib.reload(scraper_constants)
        importlib.reload(scraper_utils)

    yield _setter

    settings.MITX_ONLINE_BASE_URL = original_base_url
    importlib.reload(scraper_constants)
    importlib.reload(scraper_utils)


@pytest.mark.parametrize(
    ("base_url", "url", "expected_scraper_class"),
    [
        (
            "https://mitxonline.mit.edu/",
            "https://mitxonline.mit.edu/programs/program-v1:UAI+B2C/",
            ReactMUIPageScraper,
        ),
        (
            "https://mitxonline.mit.edu/",
            "https://mitxonline.mit.edu/programs/program-v1:UAI+B2C",
            ReactMUIPageScraper,
        ),
        (
            "https://mitxonline.mit.edu",
            "https://mitxonline.mit.edu/programs/program-v1:UAI+B2C/",
            ReactMUIPageScraper,
        ),
        (
            "",
            "https://mitxonline.mit.edu/programs/program-v1:UAI+B2C/",
            BaseScraper,
        ),
    ],
)
def test_scraper_for_site_mitx_online_base_url_mapping(
    set_mitx_online_base_url, base_url, url, expected_scraper_class
):
    """MITX online URLs should respect configured base URL mapping."""
    set_mitx_online_base_url(base_url)

    scraper = scraper_utils.scraper_for_site(url)
    assert isinstance(scraper, expected_scraper_class)
