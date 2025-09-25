from learning_resources.site_scrapers.mitx_program_page_scraper import (
    MITXProgramPageScraper,
)

SITE_SCRAPER_MAP = {
    r"https://micromasters.mit.edu/(.*?)/$": MITXProgramPageScraper,
}
