"""ETL for Sloan Executive Education data."""

import logging
from datetime import UTC
from decimal import Decimal
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import requests
from dateparser import parse
from django.conf import settings

from learning_resources.constants import (
    CURRENCY_USD,
    Availability,
    CertificationType,
    Format,
    OfferedBy,
    Pace,
    PlatformType,
    RunStatus,
)
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.utils import (
    parse_resource_commitment,
    parse_resource_duration,
    transform_delivery,
    transform_price,
    transform_topics,
)
from learning_resources.models import default_format

log = logging.getLogger(__name__)

OFFERED_BY_CODE = OfferedBy.see.name


def _get_access_token():
    """
    Get an access token for edx

    Args:
        config (OpenEdxConfiguration): configuration for the openedx backend

    Returns:
        str: the access token
    """
    payload = {
        "grant_type": "client_credentials",
        "client_id": settings.SEE_API_CLIENT_ID,
        "client_secret": settings.SEE_API_CLIENT_SECRET,
        "token_type": "jwt",
    }
    response = requests.post(  # noqa: S113
        settings.SEE_API_ACCESS_TOKEN_URL, data=payload
    )
    response.raise_for_status()

    return response.json()["access_token"]


def parse_topics(topic):
    """
    Parse topics from a string

    Args:
        topic (str): the topic string

    Returns:
        list: the parsed topics
    """

    return (
        transform_topics([{"name": topic.split(":")[-1].strip()}], OFFERED_BY_CODE)
        if topic
        else []
    )


def parse_image(course_data):
    """
    Parse image from course data

    Args:
        course_data (dict): the course data

    Returns:
        str: the image URL
    """
    image_url = course_data.get("Image_Src")
    if image_url:
        return {
            "url": image_url,
            "alt": course_data.get("Title"),
            "description": course_data.get("Title"),
        }
    return None


def parse_datetime(value):
    """
    Parses a datetime string

    Args:
        value(str): the datetime in string format

    Returns:
        datetime: the parsed datetime
    """  # noqa: D401
    return (
        parse(value).replace(tzinfo=ZoneInfo("US/Eastern")).astimezone(UTC)
        if value
        else None
    )


def parse_availability(run_data: dict) -> str:
    """
    Parse availability from run data

    Args:
        run_data (list): the run data

    Returns:
        str: the availability
    """
    if run_data and (
        run_data.get("Delivery", "") == "Online"
        and run_data.get("Format", "") == "Asynchronous (On-Demand)"
    ):
        return Availability.anytime.name
    return Availability.dated.name


def parse_pace(run_data: dict) -> str:
    """
    Parse pace from run data

    Args:
        run_data (list): the run data

    Returns:
        str: the pace
    """
    if run_data and (
        run_data.get("Delivery") == "Online"
        and run_data.get("Format") == "Asynchronous (On-Demand)"
    ):
        return Pace.self_paced.name
    return Pace.instructor_paced.name


def parse_format(run_data: dict) -> str:
    """
    Parse format from run data

    Args:
        run_data (list): the run data

    Returns:
        str: the format code
    """
    if run_data:
        delivery = run_data.get("Delivery")
        if delivery == "In Person":
            return [Format.synchronous.name]
        elif delivery == "Blended":
            return [Format.synchronous.name, Format.asynchronous.name]
        else:
            return (
                [Format.asynchronous.name]
                if "Asynchronous" in (run_data.get("Format") or "")
                else [Format.synchronous.name]
            )
    return default_format()


def parse_location(run_data: dict) -> str:
    """
    Parse location from run data

    Args:
        run_data (list): the run data

    Returns:
        str: the location
    """
    if not run_data or run_data["Delivery"] == "Online":
        return ""
    return run_data["Location"] or ""


def extract():
    """
    Extract Sloan Executive Education data
    """
    required_settings = [
        "SEE_API_CLIENT_ID",
        "SEE_API_CLIENT_SECRET",
        "SEE_API_ACCESS_TOKEN_URL",
        "SEE_API_URL",
    ]
    for setting in required_settings:
        if not getattr(settings, setting):
            log.warning("Missing required setting %s", setting)
            return [], []

    access_token = _get_access_token()
    courses_response = requests.get(  # noqa: S113
        urljoin(settings.SEE_API_URL, "courses"),
        headers={"Authorization": f"JWT {access_token}"},
    )
    courses_response.raise_for_status()
    runs_response = requests.get(  # noqa: S113
        urljoin(settings.SEE_API_URL, "course-offerings"),
        headers={"Authorization": f"JWT {access_token}"},
    )
    runs_response.raise_for_status()

    courses_data = courses_response.json()
    runs_data = runs_response.json()

    return courses_data, runs_data


def transform_run(run_data, course_data):
    """
    Transform Sloan Executive Education run data

    Args:
        run_data (dict): the run data
        course_data (dict): the course data

    Returns:
        dict: the transformed data
    """
    faculty_names = (
        run_data["Faculty_Name"].split(",") if run_data["Faculty_Name"] else []
    )
    duration = parse_resource_duration(run_data["Duration"])
    commitment = parse_resource_commitment(run_data["Time_Commitment"])
    return {
        "run_id": run_data["CO_Title"],
        "start_date": parse_datetime(run_data["Start_Date"]),
        "end_date": parse_datetime(run_data["End_Date"]),
        "title": course_data["Title"],
        "url": course_data["URL"],
        "status": RunStatus.current.value,
        "delivery": transform_delivery(run_data["Delivery"]),
        "availability": parse_availability(run_data),
        "published": True,
        "prices": [
            transform_price(
                Decimal(run_data["Price"]), run_data["Currency"] or CURRENCY_USD
            )
        ],
        "instructors": [{"full_name": name.strip()} for name in faculty_names],
        "pace": [parse_pace(run_data)],
        "format": parse_format(run_data),
        "location": parse_location(run_data),
        "duration": duration.duration,
        "min_weeks": duration.min_weeks,
        "max_weeks": duration.max_weeks,
        "time_commitment": commitment.commitment,
        "min_weekly_hours": commitment.min_weekly_hours,
        "max_weekly_hours": commitment.max_weekly_hours,
    }


def transform_course(course_data: dict, runs_data: dict) -> dict:
    """
    Transform Sloan Executive Education course data

    Args:
        course_data (dict): the course data
        runs_data (dict): the runs data for the course

    Returns:
        dict: the transformed data
    """

    course_runs_data = [
        run for run in runs_data if run["Course_Id"] == course_data["Course_Id"]
    ]
    format_delivery = list(
        {transform_delivery(run["Delivery"])[0] for run in course_runs_data}
    )
    runs = [transform_run(run, course_data) for run in course_runs_data]

    transformed_course = {
        "readable_id": course_data["Course_Id"],
        "title": course_data["Title"],
        "offered_by": {"code": OfferedBy.see.name},
        "platform": PlatformType.see.name,
        "etl_source": ETLSource.see.name,
        "description": course_data["Description"],
        "url": course_data["URL"],
        "image": parse_image(course_data),
        "certification": True,
        "certification_type": CertificationType.professional.name,
        "professional": True,
        "published": True,
        "delivery": format_delivery,
        "topics": parse_topics(course_data["Topics"]),
        "course": {
            "course_numbers": [],
        },
        "runs": runs,
        "continuing_ed_credits": course_runs_data[0]["Continuing_Ed_Credits"],
        "pace": sorted({pace for run in runs for pace in run["pace"]}),
        "format": sorted({run_format for run in runs for run_format in run["format"]}),
    }

    return transformed_course if transformed_course.get("url") else None


def transform_courses(course_runs_tuple: tuple[dict, dict]) -> dict:
    """
    Transform Sloan Executive Education data

    Args:
        course_runs_tuple (tuple[list[dict],list[dict]): the courses and offerings data

    Yields:
        dict: the transformed course data
    """
    courses_data, runs_data = course_runs_tuple
    courses_runs_map = {}
    for run in runs_data:
        courses_runs_map.setdefault(run["Course_Id"], []).append(run)
    for course in courses_data:
        if courses_runs_map.get(course["Course_Id"]) is None:
            log.warning(
                "Course %s - %s has no runs", course["Course_Id"], course["Title"]
            )
            continue
        if not course["URL"]:
            log.warning(
                "Course %s - %s has no URL", course["Course_Id"], course["Title"]
            )
            continue
        yield transform_course(course, courses_runs_map[course["Course_Id"]])
