from selenium.common.exceptions import (
    ElementNotInteractableException,
    JavascriptException,
    NoSuchElementException,
    TimeoutException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait

from learning_resources.site_scrapers.base_scraper import BaseScraper


class SloanCoursePageScraper(BaseScraper):
    def webdriver_fetch_extra_elements(self):
        """
        Attempt to Fetch any extra possible js loaded elements that
        require interaction to display
        """
        errors = [
            NoSuchElementException,
            JavascriptException,
            ElementNotInteractableException,
            TimeoutException,
        ]
        wait = WebDriverWait(
            self.driver, timeout=0.1, poll_frequency=0.01, ignored_exceptions=errors
        )
        for tab_id in ["faculty-tab", "reviews-tab", "participants-tab"]:
            wait.until(
                expected_conditions.visibility_of_element_located((By.ID, tab_id))
            )
            self.driver.execute_script(f"document.getElementById('{tab_id}').click()")
        return self.driver.execute_script("return document.body.innerHTML")

    def scrape(self, *args, **kwargs):
        content = super().scrape(*args, **kwargs)
        if self.driver:
            content = self.webdriver_fetch_extra_elements()
        return content
