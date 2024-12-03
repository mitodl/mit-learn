"""Utility functions for ai chat agents"""

import logging
from enum import Enum

log = logging.getLogger(__name__)


def enum_zip(label: str, names: tuple[str or int]) -> type[Enum]:
    """Create a new enum from a tuple"""
    return Enum(label, dict(zip(names, names)))
