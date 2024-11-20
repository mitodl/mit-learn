"""Utility functions for news/events ETL pipelines"""

import logging
import re
from datetime import UTC, datetime
from time import mktime, struct_time
from zoneinfo import ZoneInfo

import dateparser
import requests
from bs4 import BeautifulSoup as Soup
from bs4 import Tag
from django.conf import settings

from main.constants import ISOFORMAT

log = logging.getLogger(__name__)


def get_soup(url: str) -> Soup:
    """
    Get a BeautifulSoup object from a URL.

    Args:
        url (str): The URL to fetch

    Returns:
        Soup: The BeautifulSoup object extracted from the URL

    """
    response = requests.get(url, timeout=settings.REQUESTS_TIMEOUT)
    response.raise_for_status()
    return Soup(response.content, features="lxml")


def tag_text(tag: Tag) -> str:
    """
    Get the text from a BeautifulSoup tag.

    Args:
        tag (Tag): The BeautifulSoup tag

    Returns:
        str: The tag text
    """
    return tag.text.strip() if tag and tag.text else None


def stringify_time_struct(time_struct: struct_time) -> str:
    """
    Transform a struct_time object into an ISO formatted date string

    Args:
        time_struct (struct_time): The time struct object

    Returns:
        str: The ISO formatted date string in UTC timezone
    """
    min_year = 100
    if time_struct:
        dt = datetime.fromtimestamp(mktime(time_struct), tz=UTC)
        if time_struct.tm_isdst != 0:
            # tm_dst = adjustment in hours from UTC, reverse it
            dt = dt.replace(hour=dt.hour + time_struct.tm_isdst * -1)
        # Sometimes the year is just 2 digits
        if dt.year < min_year:
            dt = dt.replace(year=2000 + dt.year)
        dt_utc = dt.astimezone(UTC)
        return dt_utc.strftime(ISOFORMAT)
    return None


def get_request_json(url: str, *, raise_on_error: bool = False) -> dict:
    """
    Get JSON data from a URL.

    Args:
        url (str): The URL to get JSON data from
        raise_on_error (bool): Whether to raise an exception on error or just log it

    Returns:
        dict: The JSON data
    """
    response = requests.get(url, timeout=settings.REQUESTS_TIMEOUT)
    if not response.ok:
        if raise_on_error:
            response.raise_for_status()
        else:
            log.error("Failed to get data from %s: %s", url, response.reason)
        return {}
    return response.json()


def fetch_data_by_page(url, page=0) -> list[dict]:
    """
    Fetch data from the Professional Education API
    Args:
        url(str): The url to fetch data from
        params(dict): The query parameters to include in the request
    Yields:
        list[dict]: A list of course or program data
    """
    params = {"page": page}
    has_results = True
    while has_results:
        results = requests.get(
            url, params=params, timeout=settings.REQUESTS_TIMEOUT
        ).json()
        has_results = len(results) > 0
        yield from results
        params["page"] += 1


def parse_date(text_date: str) -> datetime:
    """
    Parse a date string into a datetime object

    Args:
        text_date (str): The date string to parse

    Returns:
        datetime: The parsed datetime object
    """
    dt_utc = None
    if text_date:
        try:
            dt_utc = (
                dateparser.parse(text_date)
                .replace(tzinfo=ZoneInfo("US/Eastern"))
                .astimezone(UTC)
            )
        except:  # noqa: E722
            logging.exception("unparsable date received - ignoring '%s'", text_date)
    return dt_utc


def parse_date_time_range(
    start_date_str, end_date_str, time_range_str: str
) -> tuple[datetime, datetime]:
    """
    Attempt to parse the time range from the MITPE events API.
    The field might not actually contain a time or range.

    Args:
        time_range (str): time range string

    Returns:
        tuple: start and end times as strings

    """
    start_time, start_ampm, end_time, end_ampm, tz = "", "", "", "", ""
    time_regex = re.compile(
        r"(\d{1,2})(:\d{2})?\s*(am|pm)?\s*-?\s*(\d{1,2})(:?\d{2})?\s*(am|pm)?\s*([A-Za-z]{2,3})?",
        re.IGNORECASE,
    )
    time_match = re.match(time_regex, time_range_str)
    if time_match:
        start_time = f"{time_match.group(1)}{time_match.group(2) or ':00'}" or ""
        start_ampm = time_match.group(3) or ""
        end_time = f"{time_match.group(4)}{time_match.group(5) or ':00'}" or start_time
        end_ampm = time_match.group(6) or ""
        tz = (time_match.group(7) or "").upper()
        start_date = dateparser.parse(
            f"{start_date_str} {start_time}{start_ampm} {tz}"
        ) or dateparser.parse(start_date_str)
    else:
        start_date = dateparser.parse(start_date_str)
    if start_date:
        if not tz:
            start_date = start_date.replace(tzinfo=ZoneInfo("US/Eastern"))
        start_date = start_date.astimezone(UTC)
    if end_date_str:
        end_date = dateparser.parse(
            f"{end_date_str} {end_time}{end_ampm or ''} {tz}"
        ) or dateparser.parse(end_date_str)
    else:
        end_date = dateparser.parse(
            f"{start_date_str} {end_time}{end_ampm or ""} {tz}"
        ) or dateparser.parse(start_date_str)
    if end_date:
        if not tz:
            end_date = end_date.replace(tzinfo=ZoneInfo("US/Eastern"))
        end_date = end_date.astimezone(UTC)
    if not start_date:
        log.error("Failed to parse start date %s", start_date_str)
    return start_date, end_date
