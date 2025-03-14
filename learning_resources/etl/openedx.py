"""
ETL extract and transformations for openedx
"""

import json
import logging
import re
from collections import namedtuple
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import requests
from dateutil.parser import parse
from django.conf import settings
from toolz import compose

from learning_resources.constants import (
    CURRENCY_USD,
    Availability,
    CertificationType,
    Format,
    LearningResourceType,
    Pace,
    PlatformType,
    RunStatus,
)
from learning_resources.etl.constants import (
    COMMON_HEADERS,
    CommitmentConfig,
    DurationConfig,
)
from learning_resources.etl.utils import (
    extract_valid_department_from_id,
    generate_course_numbers_json,
    parse_certification,
    transform_levels,
    transform_price,
    without_none,
)
from learning_resources.models import LearningResource
from learning_resources.serializers import LearningResourceInstructorSerializer
from learning_resources.utils import get_year_and_semester
from main.utils import clean_data, now_in_utc

MIT_OWNER_KEYS = ["MITx", "MITx_PRO"]

OpenEdxConfiguration = namedtuple(  # noqa: PYI024
    "OpenEdxConfiguration",
    [
        "client_id",
        "client_secret",
        "access_token_url",
        "api_url",
        "base_url",
        "alt_url",
        "platform",
        "offered_by",
        "etl_source",
        "resource_type",
    ],
)
OpenEdxExtractTransform = namedtuple(  # noqa: PYI024
    "OpenEdxExtractTransform", ["extract", "transform"]
)

log = logging.getLogger()


def _get_access_token(config):
    """
    Get an access token for edx

    Args:
        config (OpenEdxConfiguration): configuration for the openedx backend

    Returns:
        str: the access token
    """
    payload = {
        "grant_type": "client_credentials",
        "client_id": config.client_id,
        "client_secret": config.client_secret,
        "token_type": "jwt",
    }
    response = requests.post(  # noqa: S113
        config.access_token_url, data=payload, headers={**COMMON_HEADERS}
    )
    response.raise_for_status()

    return response.json()["access_token"]


def _get_openedx_catalog_page(url, access_token):
    """
    Fetch a page of OpenEdx catalog data

    Args:
        url (str): the url to fetch data from
        access_token (str): the access token to use

    Returns:
        tuple(list of dict, str or None): a tuple with the next set of
        courses and the url to the next page of results, if any
    """
    response = requests.get(  # noqa: S113
        url, headers={**COMMON_HEADERS, "Authorization": f"JWT {access_token}"}
    )
    response.raise_for_status()

    data = response.json()

    return data["results"], data["next"]


def _parse_openedx_datetime(datetime_str):
    """
    Parses an OpenEdx datetime string

    Args:
        datetime_str (str): the datetime as a string

    Returns:
        str: the parsed datetime
    """  # noqa: D401
    return parse(datetime_str).astimezone(UTC)


def _get_course_marketing_url(config, course):
    """
    Get the url for a course if any

    Args:
        config (OpenEdxConfiguration): configuration for the openedx backend
        course (dict): the data for the course

    Returns:
        str: The url for the course if any
    """
    marketing_url = course.get("marketing_url", "")
    if not marketing_url:
        for course_run in sorted(
            course.get("course_runs", []), key=lambda x: x["start"], reverse=True
        ):
            marketing_url = course_run.get("marketing_url", "")
            if marketing_url:
                break
    if marketing_url and re.match(
        rf"^{config.base_url}|{config.alt_url}", marketing_url
    ):
        return marketing_url.split("?")[0]
    return None


def _get_run_published(course_run):
    return course_run.get("status", "") == "published" and course_run.get(
        "is_enrollable", False
    )


def _get_run_availability(course_run):
    if course_run.get("availability") == RunStatus.archived.value:
        # Enrollable, archived courses can be started anytime
        return Availability.anytime

    start = course_run.get("start")
    if (
        course_run.get("pacing_type") == "self_paced"
        and start
        and datetime.fromisoformat(start) < now_in_utc()
    ):
        return Availability.anytime

    return Availability.dated


def _get_course_availability(course: dict) -> str:
    """
    Get the availability of a course based on its runs

    Args:
        course (dict): the course data

    Returns:
        str: the availability of the course
    """
    published_runs = [
        run for run in course.get("course_runs", []) if _get_run_published(run)
    ]
    if any(_get_run_availability(run) == Availability.dated for run in published_runs):
        return Availability.dated.name
    elif published_runs and all(
        _get_run_availability(run) == Availability.anytime for run in published_runs
    ):
        return Availability.anytime.name
    return None


def _get_program_availability(program: dict) -> str:
    """
    Get the availability of a program based on its courses

    Args:
        program (dict): the program data

    Returns:
        str: the availability of the program
    """
    course_availabilities = [
        _get_course_availability(course) for course in program["courses"]
    ]
    if Availability.dated.name in course_availabilities:
        return Availability.dated.name
    elif all(
        availability == Availability.anytime.name
        for availability in course_availabilities
    ):
        return Availability.anytime.name
    return None


def _is_resource_or_run_deleted(title: str) -> bool:
    """
    Returns True if '[delete]', 'delete ' (note the ending space character)
    exists in a resource's title or if the resource title equals 'delete' for the
    purpose of skipping the resource/run

    Args:
        title (str): The title of the resource

    Returns:
        bool: True if the resource or run should be considered deleted

    """  # noqa: D401
    title = title.strip().lower()
    return bool(
        "[delete]" in title
        or "(delete)" in title
        or "delete " in title
        or title == "delete"
    )


def _filter_resource(config, resource):
    """
    Filter resources to onces that are valid to ingest

    Args:
        course (dict): the course data

    Returns:
        bool: True if the course should be ingested
    """
    if config.resource_type == LearningResourceType.course.name:
        return not _is_resource_or_run_deleted(resource.get("title")) and resource.get(
            "course_runs", []
        )
    else:
        return not _is_resource_or_run_deleted(resource.get("title"))


def _filter_resource_run(resource_run):
    """
    Filter resource runs to ones that are valid to ingest

    Args:
        resource_run (dict): the resource run data

    Returns:
        bool: True if the resource run should be ingested
    """
    return not _is_resource_or_run_deleted(resource_run.get("title"))


def _transform_course_image(image_data: dict) -> dict:
    """Return the transformed image data if a url is provided"""
    if image_data and image_data.get("src"):
        return {
            "url": image_data.get("src"),
            "description": image_data.get("description"),
        }
    return None


def _transform_program_image(program_data) -> dict:
    """Return the transformed image data if a url is provided"""
    url = program_data.get("banner_image", {}).get("medium", {}).get("url")
    if url:
        return {"url": url, "description": program_data.get("title")}
    return None


def _parse_course_dates(program, date_field):
    """Return all the course run price values for the given date field"""
    dates = []
    for course in program.get("courses", []):
        if not course["excluded_from_search"]:
            dates.extend(
                [
                    run[date_field]
                    for run in course["course_runs"]
                    if _get_run_published(run) and run[date_field]
                ]
            )
    return dates


def _transform_course_duration(course_run) -> DurationConfig:
    """
    Determine the duration of a course run

    Args:
        course_run (dict): the course run data

    Returns:
        DurationConfig: the duration of the course run
    """
    duration = course_run.get("weeks_to_complete")
    if duration:
        return DurationConfig(
            duration=f"{duration} week{'s' if duration > 1 else ''}",
            min_weeks=duration,
            max_weeks=duration,
        )
    return DurationConfig()


def _transform_program_effort(program_data) -> tuple[DurationConfig, CommitmentConfig]:
    """
    Determine the time commitment of a program

    Args:
        program_data (dict): the program data

    Returns:
        tuple[DurationConfig, CommitmentConfig]: duration and time commitment of program
    """
    course_ids = [course["key"] for course in program_data.get("courses", [])]
    courses = LearningResource.objects.filter(
        published=True, readable_id__in=course_ids, platform__code=PlatformType.edx.name
    ).only("min_weekly_hours", "max_weekly_hours")
    min_efforts = [
        course.min_weekly_hours for course in courses if course.min_weekly_hours
    ]
    max_efforts = [
        course.max_weekly_hours for course in courses if course.max_weekly_hours
    ]
    max_duration = sum([course.max_weeks for course in courses if course.max_weeks])
    return _transform_course_duration(
        {"weeks_to_complete": max_duration}
    ), _transform_course_commitment(
        {
            "min_effort": round(sum(min_efforts) / len(min_efforts))
            if min_efforts
            else None,
            "max_effort": round(sum(max_efforts) / len(max_efforts))
            if max_efforts
            else None,
        }
    )


def _transform_course_commitment(course_run) -> CommitmentConfig:
    """
    Determine the time commitment of a course run

    Args:
        course_run (dict): the course run data

    Returns:
        CommitmentConfig: the time commitment of the course in hours per week
    """

    min_effort = course_run.get("min_effort") or 0
    max_effort = course_run.get("max_effort") or min_effort
    commit_str_prefix = (
        f"{min_effort}-" if min_effort is not None and min_effort != max_effort else ""
    )
    if min_effort or max_effort:
        return CommitmentConfig(
            commitment=f"{commit_str_prefix}{max_effort or min_effort} hour{
                's' if max_effort > 1 else ''
            }/week",
            min_weekly_hours=min(min_effort, max_effort),
            max_weekly_hours=max(min_effort, max_effort),
        )
    return CommitmentConfig()


def _sum_course_prices(program: dict) -> Decimal:
    """
    Sum all the course run price values for the program

    Args:
        program (dict): the program data

    Returns:
        Decimal, str: the sum of all the course prices and the currency code
    """

    def _get_course_price(course):
        if not course["excluded_from_search"]:
            for run in sorted(
                course["course_runs"], key=lambda x: x["start"], reverse=False
            ):
                if _get_run_published(run):
                    return min(
                        [
                            Decimal(seat["price"])
                            for seat in run["seats"]
                            if seat["price"] != "0.00"
                        ]
                    ), run.get("seats", [{}])[0].get("currency", CURRENCY_USD)
        return Decimal("0.00"), CURRENCY_USD

    prices_currencies = [
        _get_course_price(course) for course in program.get("courses", [])
    ]
    total, currency = (
        Decimal(sum(price_currency[0] for price_currency in prices_currencies)),
        (prices_currencies[0][1] or CURRENCY_USD),
    )
    return transform_price(total, currency)


def _transform_course_run(config, course_run, course_last_modified, marketing_url):
    """
    Transform a course run into the normalized data structure

    Args:
        config (OpenEdxConfiguration): configuration for the openedx backend

    Returns:
        dict: the tranformed course run data
    """
    year, semester = get_year_and_semester(course_run)
    course_run_last_modified = _parse_openedx_datetime(course_run.get("modified"))
    last_modified = max(course_last_modified, course_run_last_modified)
    duration = _transform_course_duration(course_run)
    commitment = _transform_course_commitment(course_run)
    return {
        "run_id": course_run.get("key"),
        "title": course_run.get("title"),
        "description": course_run.get("short_description"),
        "full_description": course_run.get("full_description"),
        "level": transform_levels([course_run.get("level_type")]),
        "semester": semester,
        "languages": without_none([course_run.get("content_language")]),
        "year": year,
        "start_date": course_run.get("start") or course_run.get("enrollment_start"),
        "end_date": course_run.get("end"),
        "last_modified": last_modified,
        "published": _get_run_published(course_run),
        "enrollment_start": course_run.get("enrollment_start"),
        "enrollment_end": course_run.get("enrollment_end"),
        "image": _transform_course_image(course_run.get("image")),
        "status": course_run.get("availability"),
        "availability": _get_run_availability(course_run).name,
        "format": [Format.asynchronous.name],
        "pace": [course_run.get("pacing_type") or Pace.self_paced.name],
        "url": marketing_url
        or "{}{}/course/".format(config.alt_url, course_run.get("key")),
        "prices": [
            transform_price(price, currency)
            for (price, currency) in sorted(
                {
                    (Decimal("0.00"), CURRENCY_USD),
                    *[
                        (Decimal(seat.get("price")), seat.get("currency"))
                        for seat in course_run.get("seats", [])
                    ],
                },
                key=lambda x: x[0],
            )
        ],
        "instructors": [
            {
                "first_name": person.get("given_name"),
                "last_name": person.get("family_name"),
            }
            for person in course_run.get("staff")
        ],
        "duration": duration.duration,
        "min_weeks": duration.min_weeks,
        "max_weeks": duration.max_weeks,
        "time_commitment": commitment.commitment,
        "min_weekly_hours": commitment.min_weekly_hours,
        "max_weekly_hours": commitment.max_weekly_hours,
    }


def _parse_program_instructors_topics(program):
    """Get the instructors for each published course in a program"""
    instructors = []
    topics = []
    course_ids = [course["key"] for course in program["courses"]]
    courses = LearningResource.objects.filter(
        readable_id__in=course_ids,
        resource_type=LearningResourceType.course.name,
        platform=PlatformType.edx.name,
        published=True,
    )
    for course in courses:
        topics.extend([{"name": topic.name} for topic in course.topics.all()])
        run = (
            course.next_run
            or course.runs.filter(published=True).order_by("-start_date").first()
        )
        if run:
            instructors.extend(
                [
                    LearningResourceInstructorSerializer(instance=instructor).data
                    for instructor in run.instructors.all()
                ]
            )
    return (
        sorted(instructors, key=lambda x: x["last_name"] or x["full_name"]),
        sorted(topics, key=lambda x: x["name"]),
    )


def _parse_course_pace(runs: list[dict]) -> list[str]:
    """
    Parse the pace of a course based on its runs

    Args:
        runs (list of dict): the runs data

    Returns:
        str: the pace of the course or programe
    """
    pace = sorted(
        {run["pacing_type"] for run in runs if run and _get_run_published(run)}
    )
    if len(pace) == 0:
        # Archived courses are considered self-paced
        pace = [Pace.self_paced.name]
    return pace


def _transform_program_course(config: OpenEdxConfiguration, course: dict) -> dict:
    """
    Transform a program's course dict to a normalized data structure

    Args:
        config (OpenEdxConfiguration): configuration for the openedx backend
        course (dict): the course data

    Returns:
        dict: the transformed course data for the program

    """
    return {
        "readable_id": course.get("key"),
        "etl_source": config.etl_source,
        "platform": config.platform,
        "resource_type": LearningResourceType.course.name,
        "offered_by": {"code": config.offered_by},
        "pace": _parse_course_pace(course.get("course_runs", [])),
    }


def _transform_program_run(
    program: dict, program_last_modified: str, image: dict
) -> dict:
    """
    Transform program data into the normalized data structure for its run

    Args:
        program (dict): the program data
        program_last_modified (str): the last modified date string for the program
        image (dict): the image data for the program

    Returns:
        dict: the transformed program run data
    """
    duration, commitment = _transform_program_effort(program)
    return {
        "run_id": program.get("uuid"),
        "title": program.get("title"),
        "description": program.get("subtitle"),
        "full_description": program.get("subtitle"),
        "level": transform_levels([program.get("level_type_override")]),
        "start_date": min(_parse_course_dates(program, "start"), default=None),
        "end_date": max(_parse_course_dates(program, "end"), default=None),
        "last_modified": program_last_modified,
        "published": True,
        "enrollment_start": min(
            _parse_course_dates(program, "enrollment_start"), default=None
        ),
        "enrollment_end": max(
            _parse_course_dates(program, "enrollment_end"), default=None
        ),
        "image": image,
        "status": RunStatus.current.value,
        "url": program.get("marketing_url"),
        "prices": [_sum_course_prices(program)],
        "instructors": program.pop("instructors", []),
        "availability": _get_program_availability(program),
        "format": [Format.asynchronous.name],
        "pace": sorted(
            {
                pace
                for course in program.get("courses", [])
                for pace in _parse_course_pace(course.get("course_runs", []))
            }
        ),
        "duration": duration.duration,
        "min_weeks": duration.min_weeks,
        "max_weeks": duration.max_weeks,
        "time_commitment": commitment.commitment,
        "min_weekly_hours": commitment.min_weekly_hours,
        "max_weekly_hours": commitment.max_weekly_hours,
    }


def _transform_course(config: OpenEdxConfiguration, course: dict) -> dict:
    """
    Filter courses to onces that are valid to ingest

    Args:
        config (OpenEdxConfiguration): configuration for the openedx backend
        course (dict): the course data

    Returns:
        dict: the tranformed course data
    """
    last_modified = _parse_openedx_datetime(course.get("modified"))
    marketing_url = _get_course_marketing_url(config, course)
    runs = [
        _transform_course_run(config, course_run, last_modified, marketing_url)
        for course_run in course.get("course_runs", [])
        if _filter_resource_run(course_run)
    ]
    has_certification = parse_certification(config.offered_by, runs)
    return {
        "readable_id": course.get("key"),
        "etl_source": config.etl_source,
        "platform": config.platform,
        "resource_type": LearningResourceType.course.name,
        "offered_by": {"code": config.offered_by},
        "title": course.get("title"),
        "departments": extract_valid_department_from_id(course.get("key")),
        "description": clean_data(course.get("short_description")),
        "full_description": clean_data(course.get("full_description")),
        "last_modified": last_modified,
        "image": _transform_course_image(course.get("image")),
        "url": marketing_url
        or "{}{}/course/".format(config.alt_url, course.get("key")),
        "topics": [
            {"name": subject.get("name")} for subject in course.get("subjects", [])
        ],
        "runs": runs,
        "course": {
            "course_numbers": generate_course_numbers_json(course.get("key")),
        },
        "published": any(run["published"] is True for run in runs),
        "certification": has_certification,
        "certification_type": CertificationType.completion.name
        if has_certification
        else CertificationType.none.name,
        "availability": _get_course_availability(course),
        "format": [Format.asynchronous.name],
        "pace": _parse_course_pace(course.get("course_runs", [])),
    }


def _transform_program(config: OpenEdxConfiguration, program: dict) -> dict:
    """
    Transform raw program data into a normalized data structure

    Args:
        config (OpenEdxConfiguration): configuration for the openedx backend
        program (dict): the program data

    Returns:
        dict: the tranformed program data
    """
    last_modified = _parse_openedx_datetime(program.get("data_modified_timestamp"))
    marketing_url = program.get("marketing_url")
    image = _transform_program_image(program)
    instructors, topics = _parse_program_instructors_topics(program)
    program["instructors"] = instructors
    courses = [
        _transform_program_course(config, course)
        for course in program.get("courses", [])
    ]
    paces = sorted({pace for course in courses for pace in course["pace"]})
    runs = [_transform_program_run(program, last_modified, image)]
    has_certification = parse_certification(config.offered_by, runs)
    return {
        "readable_id": program.get("uuid"),
        "etl_source": config.etl_source,
        "platform": config.platform,
        "resource_type": LearningResourceType.program.name,
        "offered_by": {"code": config.offered_by},
        "title": program.get("title"),
        "description": clean_data(program.get("subtitle")),
        "full_description": clean_data(program.get("subtitle")),
        "last_modified": last_modified,
        "image": image,
        "url": marketing_url
        or "{}{}/course/".format(config.alt_url, program.get("key")),
        "topics": topics,
        "runs": runs,
        "published": any(run["published"] is True for run in runs),
        "certification": has_certification,
        "certification_type": CertificationType.completion.name
        if has_certification
        else CertificationType.none.name,
        "availability": runs[0]["availability"],
        "format": [Format.asynchronous.name],
        "pace": paces,
        "courses": courses,
    }


def _transform_resource(config: OpenEdxConfiguration, resource: dict) -> dict:
    """
    Transform the extracted openedx resource data into our normalized data structure

    Args:
        config (OpenEdxConfiguration): configuration for the openedx backend
        resource (dict): the data for the resource

    Returns:
        dict: the tranformed resource data
    """
    if config.resource_type == LearningResourceType.course.name:
        return _transform_course(config, resource)
    else:
        return _transform_program(config, resource)


def openedx_extract_transform_factory(get_config: callable) -> OpenEdxExtractTransform:
    """
    Factory for generating OpenEdx extract and transform functions based on the configuration

    Args:
        get_config (callable): callable to get configuration for the openedx backend

    Returns:
        OpenEdxExtractTransform: the generated extract and transform functions
    """  # noqa: D401, E501

    def extract(api_datafile=None):
        """
        Extract the OpenEdx catalog by walking all the pages

        Args:
            api_datafile (str): optional path to a local file containing the API
                data. If omitted, the API will be queried.

        Yields:
            dict: an object representing each course
        """
        config = get_config()

        if not all(
            [
                config.client_id,
                config.client_secret,
                config.access_token_url,
                config.api_url,
                config.base_url,
                config.alt_url,
            ]
        ):
            return []

        if api_datafile:
            if settings.ENVIRONMENT != "dev":
                msg = "api_datafile should only be used in development."
                raise ValueError(msg)
            with Path(api_datafile).open("r") as file:
                log.info("Loading local API data from %s", api_datafile)
                yield from json.load(file)
        else:
            access_token = _get_access_token(config)
            url = config.api_url

            while url:
                resources, url = _get_openedx_catalog_page(url, access_token)
                yield from resources

    def transform(resources: list[dict]) -> list[dict]:
        """
        Transforms the extracted openedx data into our normalized data structure

        Args:
            list of dict: the merged resources responses

        Returns:
            list of dict: the tranformed resources data

        """  # noqa: D401
        config = get_config()

        return [
            _transform_resource(config, resource)
            for resource in resources
            if _filter_resource(config, resource)
        ]

    return OpenEdxExtractTransform(
        compose(list, extract),  # ensure a list, not a a generator, is returned
        transform,
    )
