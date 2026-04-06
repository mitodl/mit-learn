from unittest.mock import MagicMock, patch

import pytest
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By

from learning_resources.site_scrapers.react_mui_page_scraper import (
    ReactMUIPageScraper,
)


@pytest.fixture(autouse=True)
def marketing_metadata_mocks():
    """Override the autouse conftest fixture that mocks fetch_page globally."""


@pytest.fixture
def mock_driver():
    driver = MagicMock()
    driver.execute_script.side_effect = {
        "return document.readyState": "complete",
        "return document.body.innerHTML": "<main><div>content</div></main>",
    }.get
    main_el = MagicMock()
    main_el.find_elements.return_value = [MagicMock()]
    driver.find_elements.return_value = [main_el]
    return driver


@pytest.fixture
def mock_wait():
    with patch(
        "learning_resources.site_scrapers.react_mui_page_scraper.WebDriverWait"
    ) as mock_wait_cls:
        mock_wait_instance = MagicMock()
        mock_wait_cls.return_value = mock_wait_instance
        yield mock_wait_cls, mock_wait_instance


@pytest.fixture
def scraper(settings, mock_driver, mock_wait):
    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = True
    with patch(
        "learning_resources.site_scrapers.base_scraper.get_web_driver",
        return_value=mock_driver,
    ):
        return ReactMUIPageScraper("https://learn.mit.edu/programs/test/")


def test_fetch_page_returns_inner_html(scraper, mock_driver):
    result = scraper.fetch_page("https://learn.mit.edu/programs/test/")
    assert result == "<main><div>content</div></main>"
    mock_driver.get.assert_called_once_with("https://learn.mit.edu/programs/test/")


def test_fetch_page_waits_for_page_ready(scraper, mock_driver, mock_wait):
    _, mock_wait_instance = mock_wait
    scraper.fetch_page("https://learn.mit.edu/programs/test/")

    page_ready_fn = mock_wait_instance.until.call_args_list[0][0][0]
    assert callable(page_ready_fn)
    mock_driver.execute_script.side_effect = None
    # readyState not complete → False
    mock_driver.execute_script.return_value = "loading"
    assert page_ready_fn(mock_driver) is False
    # readyState complete + <main> with children → True
    mock_driver.execute_script.return_value = "complete"
    main_el = MagicMock()
    main_el.find_elements.return_value = [MagicMock()]
    mock_driver.find_elements.return_value = [main_el]
    assert page_ready_fn(mock_driver) is True
    # readyState complete + no <main> tag → True (skip check)
    mock_driver.find_elements.return_value = []
    assert page_ready_fn(mock_driver) is True


def test_fetch_page_waits_for_skeleton_invisibility(scraper):
    with patch(
        "learning_resources.site_scrapers.react_mui_page_scraper.expected_conditions"
    ) as mock_ec:
        scraper.fetch_page("https://learn.mit.edu/programs/test/")
        mock_ec.invisibility_of_element_located.assert_called_once_with(
            (By.CLASS_NAME, "MuiSkeleton-root")
        )


def test_fetch_page_returns_html_on_timeout(scraper, mock_wait):
    _, mock_wait_instance = mock_wait
    mock_wait_instance.until.side_effect = TimeoutException("timeout")

    result = scraper.fetch_page("https://learn.mit.edu/programs/test/")
    assert result == "<main><div>content</div></main>"


def test_fetch_page_returns_none_for_empty_url(scraper):
    assert scraper.fetch_page("") is None
    assert scraper.fetch_page(None) is None


def test_fetch_page_uses_webdriver_wait_seconds_setting(
    settings, mock_driver, mock_wait
):
    mock_wait_cls, _ = mock_wait
    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = True
    settings.WEBDRIVER_WAIT_SECONDS = 30

    with patch(
        "learning_resources.site_scrapers.base_scraper.get_web_driver",
        return_value=mock_driver,
    ):
        scraper = ReactMUIPageScraper("https://learn.mit.edu/programs/test/")
        scraper.fetch_page("https://learn.mit.edu/programs/test/")
        mock_wait_cls.assert_called_with(mock_driver, 30)


def test_fetch_page_falls_back_to_requests_without_driver(settings):
    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = False
    with patch("learning_resources.site_scrapers.base_scraper.requests") as mock_req:
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.text = "<html>content</html>"
        mock_req.get.return_value = mock_response
        scraper = ReactMUIPageScraper("https://learn.mit.edu/programs/test/")
        result = scraper.fetch_page("https://learn.mit.edu/programs/test/")
        assert result == "<html>content</html>"
