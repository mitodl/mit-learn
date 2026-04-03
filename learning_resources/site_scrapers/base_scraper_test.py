from unittest.mock import MagicMock, patch

import pytest
from selenium.common.exceptions import TimeoutException

from learning_resources.site_scrapers.base_scraper import BaseScraper


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
    return driver


@pytest.fixture
def mock_wait():
    with patch(
        "learning_resources.site_scrapers.base_scraper.WebDriverWait"
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
        return BaseScraper("https://example.com")


def test_fetch_page_returns_inner_html(scraper, mock_driver):
    result = scraper.fetch_page("https://example.com/page")
    assert result == "<main><div>content</div></main>"
    mock_driver.get.assert_called_once_with("https://example.com/page")


def test_fetch_page_waits_for_ready_state(scraper, mock_driver, mock_wait):
    _, mock_wait_instance = mock_wait
    scraper.fetch_page("https://example.com/page")

    ready_fn = mock_wait_instance.until.call_args_list[0][0][0]
    assert callable(ready_fn)
    mock_driver.execute_script.side_effect = None
    mock_driver.execute_script.return_value = "loading"
    assert ready_fn(mock_driver) is False
    mock_driver.execute_script.return_value = "complete"
    assert ready_fn(mock_driver) is True


def test_fetch_page_returns_html_on_webdriver_timeout(scraper, mock_wait):
    _, mock_wait_instance = mock_wait
    mock_wait_instance.until.side_effect = TimeoutException("timeout")

    result = scraper.fetch_page("https://example.com/page")
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
        scraper = BaseScraper("https://example.com")
        scraper.fetch_page("https://example.com/page")
        mock_wait_cls.assert_called_with(mock_driver, 30)


def test_fetch_page_falls_back_to_requests(settings):
    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = False
    with (
        patch("learning_resources.site_scrapers.base_scraper.requests") as mock_req,
    ):
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.text = "<html>content</html>"
        mock_req.get.return_value = mock_response
        scraper = BaseScraper("https://example.com")
        result = scraper.fetch_page("https://example.com/page")
        assert result == "<html>content</html>"


def test_fetch_page_returns_none_on_request_error(settings):
    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = False
    with (
        patch("learning_resources.site_scrapers.base_scraper.requests") as mock_req,
    ):
        mock_req.get.side_effect = Exception("connection error")
        mock_req.exceptions.RequestException = Exception
        scraper = BaseScraper("https://example.com")
        result = scraper.fetch_page("https://example.com/page")
        assert result is None


def test_scrape_returns_page_content(scraper):
    result = scraper.scrape()
    assert result == "<main><div>content</div></main>"


def test_scrape_returns_none_on_failure(settings):
    settings.EMBEDDINGS_EXTERNAL_FETCH_USE_WEBDRIVER = False
    with (
        patch("learning_resources.site_scrapers.base_scraper.requests") as mock_req,
    ):
        mock_response = MagicMock()
        mock_response.ok = False
        mock_req.get.return_value = mock_response
        scraper = BaseScraper("https://example.com")
        result = scraper.scrape()
        assert result is None
