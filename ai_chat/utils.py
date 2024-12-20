"""Utility functions for ai chat agents"""

import logging
from enum import Enum

log = logging.getLogger(__name__)


def enum_zip(label: str, enum: Enum) -> type[Enum]:
    """Create a new Enum from a tuple of Enum names"""
    return Enum(label, dict(zip(enum.names(), enum.names())))
