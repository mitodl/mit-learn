import logging

import requests
from django.conf import settings

from learning_resources.utils import get_web_driver

log = logging.get_logger(__name__)


class BaseScraper:
    use_webdriver = settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER

    def __init__(self):
        if self.use_webdriver:
            self.driver = get_web_driver()

    def fetch_page(self, url):
        if url:
            if self.driver:
                self.driver.get(url)
                return self.driver.execute_script("return document.body.innerHTML")
            else:
                try:
                    response = requests.get(url, timeout=10)
                    if response.ok:
                        return response.text
                except requests.exceptions.RequestException:
                    log.exception("Error fetching page from %s", url)
        return None

    def start(self, url):
        page_content = self.fetch_page(url)
        if page_content:
            return page_content
        else:
            log.error("Failed to fetch page content from %s", url)
        return None
