"""Utility functions for ai chat agents"""

import logging
from enum import Enum

from django.conf import settings
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool

from main.utils import Singleton

log = logging.getLogger(__name__)


class ChatMemory(metaclass=Singleton):
    """Singleton class to manage chat memory"""

    def __init__(self):
        self.checkpointer = (
            get_postgres_saver() if settings.AI_PERSISTENT_MEMORY else MemorySaver()
        )


def enum_zip(label: str, enum: Enum) -> type[Enum]:
    """Create a new Enum from a tuple of Enum names"""
    return Enum(label, dict(zip(enum.names(), enum.names())))


def persistence_db() -> str:
    """
    Return the database connection string for langgraph persistent AI memory
    """
    db = settings.DATABASES["default"]
    sslmode = "disable" if db["DISABLE_SERVER_SIDE_CURSORS"] else "require"
    return f"postgresql://{db['USER']}:{db['PASSWORD']}@{db['HOST']}:{db['PORT']}/{db['NAME']}?sslmode={sslmode}"


def get_postgres_saver() -> PostgresSaver:
    """
    Return a PostgresSaver instance for the AI memory
    """
    connection_kwargs = {
        "autocommit": True,
        "prepare_threshold": 0,
    }
    pool = ConnectionPool(
        conninfo=persistence_db(),
        max_size=settings.AI_PERSISTENT_POOL_SIZE,
        kwargs=connection_kwargs,
    )
    return PostgresSaver(pool)
