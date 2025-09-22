from learning_resources.site_scrapers.mitx_program_page_scraper import (
    MITXProgramPageScraper,
)
from learning_resources.site_scrapers.sloan_course_page_scraper import (
    SloanCoursePageScraper,
)

SITE_SCRAPER_MAP = {
    r"^https://executive.mit.edu/course/(.*?)": SloanCoursePageScraper,
    r"https://micromasters.mit.edu/(.*?)/$": MITXProgramPageScraper,
}
