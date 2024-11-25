"""Tests for utils functions"""

from datetime import UTC, datetime
from pathlib import Path
from time import struct_time
from urllib.error import HTTPError

import pytest

from news_events.etl import utils


@pytest.fixture
def mock_requests_get_html(mocker):
    """Mock requests.get to return html data"""
    with Path.open(Path("test_html/test_ol_events_index_page.html")) as in_file:
        return mocker.patch(
            "news_events.etl.utils.requests.get",
            return_value=mocker.Mock(content=in_file.read()),
        )


def test_get_soup(mock_requests_get_html):
    """get_soup should return a BeautifulSoup object with expected info"""
    soup = utils.get_soup("https://test.mit.edu/events")
    assert (
        soup.title.text == "Attend an event hosted by MIT Open Learning | Open Learning"
    )


def test_tag_text(mock_requests_get_html):
    """tag_text should return the text from a BeautifulSoup tag"""
    soup = utils.get_soup("https://test.mit.edu/events")
    assert (
        utils.tag_text(soup.title)
        == "Attend an event hosted by MIT Open Learning | Open Learning"
    )


@pytest.mark.parametrize(
    ("time_struct", "expected"),
    [
        (struct_time([2024, 3, 15, 13, 42, 36, 0, 74, 0]), "2024-03-15T13:42:36Z"),
        (struct_time([24, 5, 15, 13, 42, 36, 0, 74, -4]), "2024-05-15T17:42:36Z"),
        (None, None),
    ],
)
def test_stringify_time_struct(time_struct, expected):
    """stringify_time_struct should return an ISO formatted date string"""
    assert utils.stringify_time_struct(time_struct) == expected


def test_get_request_json(mocker):
    """get_request_json should return the json data from a url"""
    test_data = {"test": "data"}
    mocker.patch(
        "news_events.etl.utils.requests.get",
        return_value=mocker.Mock(json=lambda: {"test": "data"}, status_code=200),
    )
    assert utils.get_request_json("https://test.mit.edu/events") == test_data


def test_get_request_json_error(mocker):
    """get_request_json should log an error and return an empty dict"""
    mock_log = mocker.patch("news_events.etl.utils.log.error")
    mocker.patch(
        "news_events.etl.utils.requests.get",
        return_value=mocker.Mock(
            status_code=404, reason="Not Found", ok=False, json=lambda: {"key": "value"}
        ),
    )
    assert utils.get_request_json("https://test.mit.edu") == {}
    mock_log.assert_called_once_with(
        "Failed to get data from %s: %s", "https://test.mit.edu", "Not Found"
    )


def test_get_request_json_error_raise(mocker):
    """get_request_json should log an error and return an empty dict"""
    mocker.patch(
        "news_events.etl.utils.requests.get",
        side_effect=HTTPError("https://test.mit.edu", 404, "Not Found", None, None),
    )
    with pytest.raises(HTTPError):
        utils.get_request_json("https://test.mit.edu", raise_on_error=True)


@pytest.mark.parametrize(
    ("start_date_str", "end_date_str", "time_range_str", "start_dt", "end_dt"),
    [
        (
            "2024-01-15",
            "2024-01-15",
            "9-10 AM",
            datetime(2024, 1, 15, 14, 0, 0, tzinfo=UTC),
            datetime(2024, 1, 15, 15, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-01-15",
            None,
            "9-10 AM",
            datetime(2024, 1, 15, 14, 0, 0, tzinfo=UTC),
            datetime(2024, 1, 15, 15, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-16",
            "9 - 12 PM",
            datetime(2024, 7, 15, 13, 0, 0, tzinfo=UTC),
            datetime(2024, 7, 16, 16, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-15",
            "3:30 PM and ends at 5:45 PM",
            datetime(2024, 7, 15, 19, 30, 0, tzinfo=UTC),
            datetime(2024, 7, 15, 21, 45, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-15",
            "3:30 PM - 5:30 PM pdt",  # Should figure out this is Pacific Daylight Time
            datetime(2024, 7, 15, 22, 30, 0, tzinfo=UTC),
            datetime(2024, 7, 16, 0, 30, 0, tzinfo=UTC),
        ),
        (
            "Future date tbd",
            None,
            None,
            None,
            None,
        ),
        (
            "2024-07-15",
            "2024-07-30",
            "Every afternoon after end of class",
            datetime(2024, 7, 15, 16, 0, 0, tzinfo=UTC),
            datetime(2024, 7, 30, 16, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-15",
            "1pm",
            datetime(2024, 7, 15, 17, 0, 0, tzinfo=UTC),
            datetime(2024, 7, 15, 17, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-15",
            "8 to 1pm",  # Should correctly guess that 8 is AM
            datetime(2024, 7, 15, 12, 0, 0, tzinfo=UTC),
            datetime(2024, 7, 15, 17, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-15",
            "8 AM to 1",  # Should correctly guess that 1 is PM
            datetime(2024, 7, 15, 12, 0, 0, tzinfo=UTC),
            datetime(2024, 7, 15, 17, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-12-15",
            "2024-12-15",
            "11 to 12 pm",  # Should correctly guess that 11 is AM
            datetime(2024, 12, 15, 16, 0, 0, tzinfo=UTC),
            datetime(2024, 12, 15, 17, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-15",
            "Beginning at 4:30 and ending at about 6pm",
            datetime(2024, 7, 15, 20, 30, 0, tzinfo=UTC),
            datetime(2024, 7, 15, 22, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-15",
            "3:00pm; weather permitting",
            datetime(2024, 7, 15, 19, 0, 0, tzinfo=UTC),
            datetime(2024, 7, 15, 19, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-15",
            "3:00pm; doors open at 2:30pm",  # Ignore any end time before the start time
            datetime(2024, 7, 15, 19, 0, 0, tzinfo=UTC),
            datetime(2024, 7, 15, 19, 0, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-15",
            "Beginning at 4:30",  # No AM/PM, so take it literally as is
            datetime(2024, 7, 15, 8, 30, 0, tzinfo=UTC),
            datetime(2024, 7, 15, 8, 30, 0, tzinfo=UTC),
        ),
        (
            "2024-07-15",
            "2024-07-30",
            "Beginning at 16:30",  # No AM/PM, so take it literally as is
            datetime(2024, 7, 15, 20, 30, 0, tzinfo=UTC),
            datetime(2024, 7, 30, 20, 30, 0, tzinfo=UTC),
        ),
        (
            None,
            "2024-11-30",
            "Bldg. 123, E52nd Street, Salon MIT",  # Invalid time, default to noon Eastern time, convert to UTC
            datetime(2024, 11, 30, 17, 0, 0, tzinfo=UTC),
            datetime(2024, 11, 30, 17, 0, 0, tzinfo=UTC),
        ),
    ],
)
def test_parse_date_time_range(
    start_date_str, end_date_str, time_range_str, start_dt, end_dt
):
    """parse_date_time_range should return the expected start and end datetimes"""
    assert utils.parse_date_time_range(
        start_date_str, end_date_str, time_range_str
    ) == (start_dt, end_dt)
