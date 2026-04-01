import logging

import requests
from django.conf import settings
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait

from learning_resources.utils import get_web_driver

logger = logging.getLogger(__name__)


class BaseScraper:
    driver = None

    def __init__(self, start_url):
        self.start_url = start_url
        if settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER:
            self.driver = get_web_driver()

    def fetch_page(self, url):
        if url:
            if self.driver:
                try:
                    self.driver.get(url)
                    wait = WebDriverWait(self.driver, settings.WEBDRIVER_WAIT_SECONDS)

                    def _page_ready(driver):
                        """Page is ready when readyState is complete and <main>
                        (if present) has child elements.
                        """
                        if (
                            driver.execute_script("return document.readyState")
                            != "complete"
                        ):
                            return False
                        mains = driver.find_elements(By.TAG_NAME, "main")
                        # No <main> tag means the page doesn't use one — skip check
                        if not mains:
                            return True
                        return len(mains[0].find_elements(By.CSS_SELECTOR, "*")) > 0

                    wait.until(_page_ready)
                    wait.until(
                        expected_conditions.invisibility_of_element_located(
                            (By.CLASS_NAME, "MuiSkeleton-root")
                        )
                    )
                except TimeoutException:
                    logger.warning(
                        "Timed out waiting for page readiness/skeleton elements at %s",
                        url,
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
