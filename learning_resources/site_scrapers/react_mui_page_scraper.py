import logging

from django.conf import settings
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait

from learning_resources.site_scrapers.base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class ReactMUIPageScraper(BaseScraper):
    """Scraper for React/MUI pages that use skeleton loading indicators.

    Waits for MUI skeleton elements to disappear before extracting content,
    ensuring the page is fully rendered.
    """

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
                return super().fetch_page(url)
        return None
