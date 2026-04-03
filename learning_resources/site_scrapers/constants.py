import re

from django.conf import settings

from learning_resources.site_scrapers.mitx_program_page_scraper import (
    MITXProgramPageScraper,
)
from learning_resources.site_scrapers.react_mui_page_scraper import (
    ReactMUIPageScraper,
)

SITE_SCRAPER_MAP = {
    r"https://micromasters.mit.edu/(.*?)/?$": MITXProgramPageScraper,
    r"https://learn.mit.edu/(.*?)/?$": ReactMUIPageScraper,
}

if settings.MITX_ONLINE_BASE_URL:
    base_url = settings.MITX_ONLINE_BASE_URL.rstrip("/") + "/"
    SITE_SCRAPER_MAP[rf"{re.escape(base_url)}(.*?)/?$"] = ReactMUIPageScraper
