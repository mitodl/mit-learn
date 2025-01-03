"""MITx learning_resources ETL"""

import logging
import math
from _csv import QUOTE_MINIMAL
from csv import DictReader
from io import StringIO
from pathlib import Path

import requests
from django.conf import settings
from django.utils.text import slugify

from learning_resources.constants import (
    Availability,
    Format,
    OfferedBy,
    Pace,
    PlatformType,
    RunStatus,
)
from learning_resources.etl.constants import ETLSource
from learning_resources.etl.utils import (
    generate_course_numbers_json,
    transform_levels,
)
from learning_resources.utils import get_year_and_semester

log = logging.getLogger(__name__)

# List of OLL course ids already ingested from OCW
SKIP_OCW_COURSES = [
    "OCW+18.031+2019_Spring",
]


def parse_readable_id(course_data: dict, run: dict) -> str:
    """
    Parse the course readable_id

    Args:
        course_data (dict): course data
        run (dict): run data

    Returns:
        str: course readable_id

    """
    if course_data["Offered by"] == "OCW":
        semester = run.get("semester") or ""
        year = run.get("year") or ""
        return f"{course_data['OLL Course']}+{slugify(semester)}_{year}"
    return f"MITx+{course_data['OLL Course']}"


def extract(sheets_id: str or None = None) -> str:
    """
    Extract OLL learning_resources

    Args:
        sheets_id (str): Google sheets id

    Returns:
        str: OLL learning_resources data as a csv-formatted string

    """
    if sheets_id:
        return requests.get(
            f"https://docs.google.com/spreadsheets/d/{sheets_id}/export?format=csv",
            timeout=settings.REQUESTS_TIMEOUT,
        ).content.decode("utf-8")
    with Path.open(
        Path(settings.BASE_DIR, "learning_resources/data/oll_metadata.csv"), "r"
    ) as csv_file:
        return csv_file.read()


def transform_image(course_data: dict) -> dict:
    """
    Transform a course image into our normalized data structure

    Args:
        course_data (dict): course data extracted from csv/sheet

    Returns:
        dict: normalized course image data

    """
    return {
        "url": course_data["Course Image URL Flat"],
        "alt": course_data["title"],
    }


def parse_duration(course_data: dict) -> tuple[str, int | None]:
    """Get the duration as a string and integer from the course data."""
    duration_str = course_data.get("Duration")
    if not duration_str:
        return "", None
    duration = math.ceil(float(duration_str))
    return f"{duration} weeks", duration


def parse_commitment(course_data: dict) -> dict:
    """Get the time commitment as a string and integer from the course data."""
    commitment_str = course_data.get("Student Effort")
    if not commitment_str:
        return "", None
    commitment = math.ceil(float(commitment_str))
    return f"{commitment} hours/week", commitment


def parse_topics(course_data: dict) -> list[dict]:
    """
    Transform course topics into our normalized data structure

    Args:
        course_data (dict): course data

    Returns:
        dict: list of normalized course topics data
    """
    return [
        # One topic name from GSheets is slightly incorrect
        {"name": topic.replace("Educational Policy", "Education Policy")}
        for topic in [
            course_data["MITxO Primary Child"],
            # Sheet/csv column title has trailing space
            course_data["MITxO Adopted Secondary Child "],
        ]
        if topic
    ]


def transform_run(course_data: dict) -> list[dict]:
    """
    Transform a course run into our normalized data structure

    Args:
        course_data (dict): course data

    Returns:
        dict: normalized course run data
    """
    year, semester = get_year_and_semester({"key": course_data["readable_id"]})
    duration_str, duration = parse_duration(course_data)
    commitment_str, commitment = parse_commitment(course_data)
    return [
        {
            "title": course_data["title"],
            "run_id": course_data["readable_id"],
            "url": course_data["url"],
            "published": course_data["published"] == "YES",
            "description": course_data["description"],
            "image": transform_image(course_data),
            "level": transform_levels([course_data["Level"]])
            if course_data["Level"]
            else [],
            "year": year,
            "semester": semester,
            "instructors": [
                {"full_name": instructor}
                for instructor in [
                    course_data[f"Instructor {idx}"] for idx in range(1, 7)
                ]
                if instructor
            ],
            "status": RunStatus.archived.value,
            "availability": Availability.anytime.name,
            "pace": [Pace.self_paced.name],
            "format": [Format.asynchronous.name],
            "duration": duration_str,
            "time_commitment": commitment_str,
            "min_weeks": duration,
            "max_weeks": duration,
            "min_weekly_hours": commitment,
            "max_weekly_hours": commitment,
        }
    ]


def transform_course(course_data: dict) -> dict:
    """
    Transform OLL course data

    Args:
        course_data (dict): course data extracted from csv/sheet

    Returns:
        dict: normalized course data

    """
    runs = transform_run(course_data)
    return {
        "title": course_data["title"],
        "readable_id": parse_readable_id(course_data, runs[0]),
        "url": course_data["url"],
        "description": course_data["description"],
        "full_description": course_data["description"],
        "offered_by": {
            "code": OfferedBy.ocw.name
            if course_data["Offered by"] == "OCW"
            else OfferedBy.mitx.name
        },
        "platform": PlatformType.oll.name,
        "published": course_data["published"] == "YES",
        "topics": parse_topics(course_data),
        "course": {
            "course_numbers": generate_course_numbers_json(
                course_data["OLL Course"], is_ocw=False
            ),
        },
        "runs": runs,
        "image": transform_image(course_data),
        "etl_source": ETLSource.oll.name,
        "availability": Availability.anytime.name,
        "pace": [Pace.self_paced.name],
        "format": [Format.asynchronous.name],
    }


def transform(courses_data: str) -> list[dict]:
    """
    Transform OLL learning_resources

    Args:
        courses_data (str): OLL learning_resources data as a csv-formatted string

    Returns:
        list of dict: normalized OLL courses data

    """
    if courses_data:
        csv_reader = DictReader(
            StringIO(courses_data), delimiter=",", quoting=QUOTE_MINIMAL
        )
        return [
            transform_course(row)
            for row in csv_reader
            if row.get("readable_id") not in SKIP_OCW_COURSES
        ]
    return []
