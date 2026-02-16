import logging

import requests
from django.conf import settings
from selenium.webdriver.support.ui import WebDriverWait

from learning_resources.utils import get_web_driver

logger = logging.getLogger(__name__)


class BaseScraper:
    use_webdriver = settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER
    driver = None

    def __init__(self, start_url):
        self.start_url = start_url
        if self.use_webdriver:
            self.driver = get_web_driver()

    def fetch_page(self, url):
        if url:
            if self.driver:
                self.driver.get(url)
                WebDriverWait(self.driver, 10).until(
                    lambda d: (
                        d.execute_script("return document.readyState") == "complete"
                    )
                )
                return self.driver.execute_script("return document.body.innerHTML")
            else:
                try:
                    response = requests.get(url, timeout=10)
                    if response.ok:
                        return response.text
                except requests.exceptions.RequestException:
                    logger.exception("Error fetching page from %s", url)
        return None

    def scrape(self):
        page_content = self.fetch_page(self.start_url)
        if page_content:
            return page_content
        else:
            logger.error("Failed to fetch page content from %s", self.start_url)
        return None
