import re

from learning_resources.site_scrapers.base_scraper import BaseScraper
from learning_resources.site_scrapers.constants import SITE_SCRAPER_MAP


def scraper_for_site(url):
    for pattern in SITE_SCRAPER_MAP:
        if re.search(pattern, url):
            return SITE_SCRAPER_MAP[pattern](url)
    return BaseScraper(url)
