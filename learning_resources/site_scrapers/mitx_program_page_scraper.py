from selenium.webdriver.common.by import By

from learning_resources.site_scrapers.base_scraper import BaseScraper


class MITXProgramPageScraper(BaseScraper):
    def scrape(self, *args, **kwargs):
        content = super().scrape(*args, **kwargs)
        extra_links = []
        if self.driver:
            for link in self.driver.find_elements(By.CLASS_NAME, "tab-link"):
                link_url = link.get_attribute("href")
                if link_url != self.start_url:
                    extra_links.append(link_url)
        for link_url in extra_links:
            page_content = self.fetch_page(link_url)
            if page_content:
                content += page_content
        return content
