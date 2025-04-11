import pytest

from learning_resources.site_scrapers.base_scraper import BaseScraper
from learning_resources.site_scrapers.mitx_program_page_scraper import (
    MITXProgramPageScraper,
)
from learning_resources.site_scrapers.sloan_course_page_scraper import (
    SloanCoursePageScraper,
)
from learning_resources.site_scrapers.utils import scraper_for_site


@pytest.mark.parametrize(
    ("url", "expected_scraper_class"),
    [
        ("https://example.com", BaseScraper),
        ("https://micromasters.mit.edu/ds/", MITXProgramPageScraper),
        ("https://unknownsite.com", BaseScraper),
        (
            "https://executive.mit.edu/course/innovation-executive-academy/a05U1000005l8nFIAQ.html",
            SloanCoursePageScraper,
        ),
    ],
)
def test_scraper_for_site(mocker, url, expected_scraper_class):
    """
    Test that scraper_for_site returns the correct scraper class based on the URL
    """

    scraper = scraper_for_site(url)
    assert isinstance(scraper, expected_scraper_class)
