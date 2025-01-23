"""ai_chat agent tools and schemas"""

import json
import logging
from typing import Annotated, Optional

import pydantic
import requests
from django.conf import settings
from langchain_core.tools import tool
from pydantic import Field

from ai_chat.utils import enum_zip
from learning_resources.constants import LearningResourceType, OfferedBy

log = logging.getLogger(__name__)


class SearchToolSchema(pydantic.BaseModel):
    """Schema for searching MIT learning resources.

    Attributes:
        q: The search query string
        resource_type: Filter by type of resource (course, program, etc)
        free: Filter for free resources only
        certification: Filter for resources offering certificates
        offered_by: Filter by institution offering the resource
    """

    q: str = Field(
        description=(
            "Query to find resources. Never use level terms like 'advanced' here"
        )
    )
    resource_type: Optional[
        list[Annotated[str, enum_zip("resource_type", LearningResourceType)]]
    ] = Field(
        default=None,
        description="Type of resource to search for: course, program, video, etc",
    )
    free: Optional[bool] = Field(
        default=None,
        description="Whether the resource is free to access, true|false",
    )
    certification: Optional[bool] = Field(
        default=None,
        description=(
            "Whether the resource offers a certificate upon completion, true|false"
        ),
    )
    offered_by: Optional[Annotated[str, enum_zip("offered_by", OfferedBy)]] = Field(
        default=None,
        description="Institution that offers the resource: ocw, mitxonline, etc",
    )


@tool(args_schema=SearchToolSchema)
def search_courses(q: str, **kwargs) -> str:
    """
    Query the MIT API for learning resources, and
    return simplified results as a JSON string
    """

    params = {"q": q, "limit": settings.AI_MIT_SEARCH_LIMIT}

    valid_params = {
        "resource_type": kwargs.get("resource_type"),
        "free": kwargs.get("free"),
        "offered_by": kwargs.get("offered_by"),
        "certification": kwargs.get("certification"),
    }
    params.update({k: v for k, v in valid_params.items() if v is not None})
    try:
        response = requests.get(settings.AI_MIT_SEARCH_URL, params=params, timeout=30)
        response.raise_for_status()
        raw_results = response.json().get("results", [])
        # Simplify the response to only include the main properties
        main_properties = [
            "title",
            "url",
            "description",
            "offered_by",
            "free",
            "certification",
            "resource_type",
        ]
        simplified_results = []
        for result in raw_results:
            simplified_result = {k: result.get(k) for k in main_properties}
            # Instructors and level will be in the runs data if present
            next_date = result.get("next_start_date", None)
            raw_runs = result.get("runs", [])
            best_run = None
            if next_date:
                runs = [run for run in raw_runs if run["start_date"] == next_date]
                if runs:
                    best_run = runs[0]
            elif raw_runs:
                best_run = raw_runs[-1]
            if best_run:
                for attribute in ("level", "instructors"):
                    simplified_result[attribute] = best_run.get(attribute, [])
            simplified_results.append(simplified_result)
        full_output = {
            "results": simplified_results,
            "metadata": {"parameters": params},
        }
        return json.dumps(full_output)
    except requests.exceptions.RequestException:
        log.exception("Error querying MIT API")
        return json.dumps({"error": "An error occurred while searching"})
