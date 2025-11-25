"""Constants for learning_resources ETL processes"""

from collections import namedtuple
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum

from django.conf import settings
from named_enum import ExtendedEnum

from learning_resources.constants import LearningResourceDelivery
from learning_resources.models import LearningResourcePrice

# A custom UA so that operators of OpenEdx will know who is pinging their service
COMMON_HEADERS = {
    "User-Agent": f"CourseCatalogBot/{settings.VERSION} ({settings.APP_BASE_URL})"
}

READABLE_ID_FIELD = "readable_id"

MIT_OWNER_KEYS = ["MITx", "MITx_PRO"]

TIME_INTERVAL_MAPPING = {
    "half-days": ["days"],
    "half-day": ["day"],
    "hours": [
        "horas",
    ],
    "hour": [
        "hora",
    ],
    "days": [
        "días",
        "jours",
    ],
    "day": [
        "día",
        "jour",
    ],
    "weeks": ["semanas", "semaines", "settimanes"],
    "week": [
        "semana",
        "semaine",
        "settimane",
    ],
    "months": ["meses", "mois", "mesi"],
    "month": [
        "mes",
        "mois",
    ],
}


OfferedByLoaderConfig = namedtuple(  # noqa: PYI024
    "OfferedByLoaderConfig", ["additive"], defaults=[False]
)
LearningResourceRunLoaderConfig = namedtuple(  # noqa: PYI024
    "RunLoaderConfig", ["offered_by"], defaults=[OfferedByLoaderConfig()]
)

CourseLoaderConfig = namedtuple(  # noqa: PYI024
    "CourseLoaderConfig",
    ["prune", "offered_by", "runs", "fetch_only"],
    defaults=[True, OfferedByLoaderConfig(), LearningResourceRunLoaderConfig(), False],
)

ProgramLoaderConfig = namedtuple(  # noqa: PYI024
    "ProgramLoaderConfig",
    ["prune", "courses", "offered_by", "runs"],
    defaults=[
        True,
        CourseLoaderConfig(),
        OfferedByLoaderConfig(),
        LearningResourceRunLoaderConfig(),
    ],
)

MIT_CLIMATE_TOPIC_MAP = {
    "Climate Modeling": {
        "topic": "Climate Science",
        "subtopic": "Science & Math: Earth Science",
    },
    "Atmosphere": {
        "topic": "Climate Science",
        "subtopic": "Science & Math: Earth Science",
    },
    "Weather & Natural Disasters": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Science & Math: Earth Science",
    },
    "Hurricanes": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Science & Math: Earth Science",
    },
    "Drought": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Science & Math: Earth Science",
    },
    "Heatwaves": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Science & Math: Earth Science",
    },
    "Flooding": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Science & Math: Earth Science",
    },
    "Wildfires": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Science & Math: Earth Science",
    },
    "Sea Level Rise": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Science & Math: Earth Science",
    },
    "Oceans": {"topic": "Ecosystems", "subtopic": "Science & Math: Earth Science"},
    "Forests": {"topic": "Ecosystems", "subtopic": "Science & Math: Earth Science"},
    "Biodiversity": {"topic": "Ecosystems", "subtopic": "Science & Math: Biology"},
    "Arctic & Antarctic": {
        "topic": "Ecosystems",
        "subtopic": "Science & Math: Earth Science",
    },
    "Food, Water & Agriculture": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Science & Math: Earth Science",
    },
    "Humanities & Social Science": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Social Sciences",
    },
    "Climate Justice": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Social Sciences",
    },
    "Health & Medicine": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Health & Medicine: Public Health",
    },
    "Cities & Planning": {
        "topic": "Built Environment",
        "subtopic": "Social Sciences: Urban Studies",
    },
    "Buildings": {
        "topic": "Built Environment",
        "subtopic": "Art, Design & Architecture: Architecture",
    },
    "Industry & Manufacturing": {
        "topic": "Sustainable Business",
        "subtopic": "Engineering: Manufacturing",
    },
    "Energy": {"topic": "Energy", "subtopic": "Engineering"},
    "Renewable Energy": {"topic": "Energy", "subtopic": "Engineering"},
    "Fossil Fuels": {"topic": "Energy", "subtopic": "Engineering"},
    "Nuclear & Fusion Energy": {
        "topic": "Energy",
        "subtopic": "Engineering: Nuclear Engineering",
    },
    "Batteries, Storage & Transmission": {
        "topic": "Energy",
        "subtopic": "Engineering",
    },
    "Energy Efficiency": {"topic": "Energy", "subtopic": "Engineering"},
    "Electrification": {
        "topic": "Energy",
        "subtopic": "Engineering: Electrical Engineering",
    },
    "Transportation": {"topic": "Energy", "subtopic": "Engineering"},
    "Air Travel": {"topic": "Energy", "subtopic": "Engineering: Aerospace Engineering"},
    "Cars": {"topic": "Energy", "subtopic": "Engineering"},
    "Public Transportation": {
        "topic": "Energy",
        "subtopic": "Engineering: Civil Engineering",
    },
    "Freight": {"topic": "Energy", "subtopic": "Business & Management: Supply Chain"},
    "Waste": {
        "topic": "Climate and Energy Policy",
        "subtopic": "Engineering: Environmental Engineering",
    },
    "Government & Politics": {
        "topic": "Climate and Energy Policy",
        "subtopic": "Policy and Administration",
    },
    "Advocacy & Activism": {
        "topic": "Climate and Energy Policy",
        "subtopic": "Policy and Administration",
    },
    "International Agreements": {
        "topic": "Climate and Energy Policy",
        "subtopic": "Policy and Administration",
    },
    "National Security": {
        "topic": "Climate and Energy Policy",
        "subtopic": "Policy and Administration",
    },
    "Carbon Capture": {"topic": "Energy", "subtopic": "Engineering"},
    "Geoengineering": {"topic": "Adaptation and Resilience", "subtopic": "Engineering"},
    "Finance & Economics": {
        "topic": "Climate and Energy Policy",
        "subtopic": "Social Sciences: Economics",
    },
    "Carbon Pricing": {
        "topic": "Climate and Energy Policy",
        "subtopic": "Social Sciences: Economics",
    },
    "Education": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Education & Teaching",
    },
    "Adaptation": {"topic": "Adaptation and Resilience", "subtopic": "Social Sciences"},
    "Communication & Arts": {
        "topic": "Adaptation and Resilience",
        "subtopic": "Humanities",
    },
    "Carbon Removal": {
        "topic": "Climate Science",
        "subtopic": "Engineering: Environmental Engineering",
    },
    "Alternative Fuels": {"topic": "Energy", "subtopic": "Chemical Engineering"},
}


class ETLSource(ExtendedEnum):
    """Enum of ETL sources"""

    micromasters = "micromasters"
    mit_edx = "mit_edx"
    mitpe = "mitpe"
    mitxonline = "mitxonline"
    oll = "oll"
    ocw = "ocw"
    podcast = "podcast"
    mit_climate = "mit_climate"
    see = "see"
    xpro = "xpro"
    youtube = "youtube"
    canvas = "canvas"


class CourseNumberType(Enum):
    """Enum of course number types"""

    primary = "primary"
    cross_listed = "cross-listed"


RESOURCE_FILE_ETL_SOURCES = [
    ETLSource.mit_edx.value,
    ETLSource.ocw.value,
    ETLSource.mitxonline.value,
    ETLSource.xpro.value,
]

MARKETING_PAGE_FILE_TYPE = "marketing_page"

RESOURCE_DELIVERY_MAPPING = {
    None: LearningResourceDelivery.online.name,
    "": LearningResourceDelivery.online.name,
    "Blended": LearningResourceDelivery.hybrid.name,
    "In Person": LearningResourceDelivery.in_person.name,
    "Live Virtual": LearningResourceDelivery.online.name,
    "Live Online": LearningResourceDelivery.online.name,
    "On Campus": LearningResourceDelivery.in_person.name,
    **{
        value: LearningResourceDelivery(value).name
        for value in LearningResourceDelivery.values()
    },
}


class ContentTagCategory(ExtendedEnum):
    """
    Enum for content tag categories.
    """

    videos = "Videos"
    notes = "Notes"
    exams = "Exams"
    problem_sets = "Problem Sets"


CONTENT_TAG_CATEGORIES = {
    "Lecture Videos": ContentTagCategory.videos.value,
    "Lecture Notes": ContentTagCategory.notes.value,
    "Exams with Solutions": ContentTagCategory.exams.value,
    "Exams": ContentTagCategory.exams.value,
    "Problem Sets with Solutions": ContentTagCategory.problem_sets.value,
    "Problem Sets": ContentTagCategory.problem_sets.value,
    "Assignments": ContentTagCategory.problem_sets.value,
    # Can add more here if ever needed, in format tag_name:category
}


@dataclass
class ResourceNextRunConfig:
    next_start_date: datetime = None
    prices: list[Decimal] = field(default_factory=list)
    resource_prices: list[LearningResourcePrice] = field(default_factory=list)
    availability: str = ""
    location: str = ""
    duration: str = ""
    min_weeks: int = None
    max_weeks: int = None
    time_commitment: str = ""
    min_weekly_hours: int = None
    max_weekly_hours: int = None


@dataclass
class DurationConfig:
    duration: str = ""
    min_weeks: int = None
    max_weeks: int = None


@dataclass
class CommitmentConfig:
    commitment: str = ""
    min_weekly_hours: int = None
    max_weekly_hours: int = None
