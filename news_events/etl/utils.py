"""Utility functions for news/events ETL pipelines"""

import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from time import mktime, struct_time
from typing import Optional
from zoneinfo import ZoneInfo

import dateparser
import requests
from bs4 import BeautifulSoup as Soup
from bs4 import Tag
from dateparser import timezone_parser
from django.conf import settings

from main.constants import ISOFORMAT

log = logging.getLogger(__name__)


@dataclass
class FormattedTime:
    hour: Optional[str]
    minute: Optional[str]
    ampm: Optional[str]
    tz: Optional[str]


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


def convert_to_utc(dt: datetime, known_tz: str) -> datetime:
    """
    Convert a datetime object to UTC timezone. If its
    orignal timezone is not known, assume it is in US/Eastern.

    Args:
        dt (datetime): The datetime object to convert
        known_tz (str): The timezone string if known

    Returns:
        datetime: The datetime object in UTC timezone
    """
    if not dt:
        return None
    if not known_tz:
        # Assume it is in US/Eastern where MIT is
        dt = dt.replace(tzinfo=ZoneInfo("US/Eastern"))
    return dt.astimezone(UTC)


def format_time(matched_time: re.Match) -> FormattedTime:
    """
    Format a time regex match group into a standard format

    Args:
        time_str (str): The time string to parse

    Returns:
        FormattedTime: A formatted time object
    """
    # Regex for AM/PM and timezone
    ampm_tz_regex = re.compile(r"(am|pm)\s*([A-Za-z]{2,3})?", re.IGNORECASE)
    ampm, tz = "", ""
    hour = matched_time.group(1) or ""
    minute = matched_time.group(2) or (":00" if hour else "")
    ampm_and_tz_match = re.search(ampm_tz_regex, matched_time.group(3) or "")
    if ampm_and_tz_match:
        ampm = ampm_and_tz_match.group(1) or ""
        tz = ampm_and_tz_match.group(2) or ""
    return FormattedTime(
        hour, minute, ampm, (tz if timezone_parser.word_is_tz(tz.upper()) else "")
    )


def parse_date_time_range(
    start_date_str: str, end_date_str: str, time_range_str: str
) -> tuple[datetime, datetime]:
    """
    Attempt to parse the time range from the MITPE events API.
    If the time cannot be parsed, default to noon Easterm time,
    then convert to UTC.
    The field might not always contain a valid time/range.

    Args:
        start_date_str (str): start date string
        end_date_str (str): end date string
        time_range (str): time range string

    Returns:
        tuple(datetime, datetime): start and end datetimes in UTC timezone

    """
    # If one date is missing, set it to the other
    end_date_str = end_date_str or start_date_str
    start_date_str = start_date_str or end_date_str

    default_time = FormattedTime("12", ":00", "PM", "")
    default_time_str = "12:00 PM"
    # Set start/end times to noon as default
    start_time, end_time = (default_time, default_time)
    # Try to split the string into start and end times
    split_times = list(
        re.finditer(
            re.compile(r"(\d{1,2})(:\d{2})?(\D*)", re.IGNORECASE), time_range_str or ""
        )
    )
    if split_times:
        # At least one time match was found
        formatted_times = [format_time(time_match) for time_match in split_times]
        # make ruff happy
        TWO = 2
        TWELVE = 12
        if len(formatted_times) == TWO:
            # Both start and end times were found
            start_time, end_time = formatted_times
            if start_time.hour and end_time.hour:
                # Times must at least have an hour to be valid
                if int(start_time.hour) > int(end_time.hour):
                    # Example: 8 - 1 PM; 8 AM - 1
                    start_time.ampm = start_time.ampm or "AM"
                    end_time.ampm = end_time.ampm or "PM"
                elif int(end_time.hour) == TWELVE and int(start_time.hour) < TWELVE:
                    # Example: 10 - 12 PM
                    start_time.ampm = start_time.ampm or "AM"
                    end_time.ampm = end_time.ampm or "PM"
                else:
                    # Anything else, if AM/PM missing for one, set it to the other,
                    # or "" if both are missing
                    start_time.ampm = start_time.ampm or end_time.ampm or ""
                    end_time.ampm = end_time.ampm or start_time.ampm or ""
                # If timezone missing for one, set it to the other,
                # or "" if both are missing
                start_time.tz = start_time.tz or end_time.tz or ""
                end_time.tz = end_time.tz or start_time.tz or ""
        elif len(formatted_times) == 1:
            # Only one time was found, set both start and end to that time
            start_time = formatted_times[0]
            end_time = start_time

    # Ignore time range and use default time range if dates aren't parsable with it
    start_date = dateparser.parse(
        f"{start_date_str} {start_time.hour}{start_time.minute} "
        f"{start_time.ampm} {start_time.tz}"
    ) or dateparser.parse(f"{start_date_str} {default_time_str}")
    end_date = dateparser.parse(
        f"{end_date_str} {end_time.hour}{end_time.minute} {end_time.ampm} {end_time.tz}"
    ) or dateparser.parse(f"{end_date_str} {default_time_str}")

    if end_date and start_date and end_date < start_date:
        # This is nonsensical, so just set the end date to the start date
        end_date = start_date
    if not start_date:
        log.error("Failed to parse start date %s", start_date_str)
    return convert_to_utc(start_date, start_time.tz), convert_to_utc(
        end_date, end_time.tz
    )
