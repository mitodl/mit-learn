"""Profile notes in the learner's shared memory, through ol-llm's memory interface.

A note is what a bot reads about the learner, not a copy of the profile, which
stays the source of truth. One note per field under a fixed key, so a later save
replaces it and clearing the field deletes it. Nothing identifying goes into a
note or its key: the memory service redacts emails and phone numbers in note
text but not in keys.

Notes are written in the learner's own request because the memory service takes
the learner from the session token the gateway forwards (X-Access-Token), which
mit-learn exchanges as its memory client. That token is held only for the call
and never logged.

ol_llm is imported inside the functions that use it, so importing this module
from the profile views keeps it (and opik) off the boot path.
"""

import logging
from collections.abc import Iterable
from functools import cache
from typing import TYPE_CHECKING

from django.conf import settings
from django.http import HttpRequest

from profiles.models import Profile

if TYPE_CHECKING:
    from ol_llm.memory import SyncMemory

log = logging.getLogger(__name__)

USE_CASE = "profile-notes"
ACCESS_TOKEN_HEADER = "HTTP_X_ACCESS_TOKEN"  # noqa: S105 - a header name
NOTE_FIELDS = ("topic_interests", "current_education", "time_commitment")
NOTE_KEYS = {field: f"profile-{field.replace('_', '-')}" for field in NOTE_FIELDS}


@cache
def get_memory() -> "SyncMemory | None":
    """
    Return mit-learn's memory client, or None when learner memory is off.

    ol-llm reads the rest of the configuration (URL, exchange client) from the
    OL_LLM_MEMORY_* environment.
    """
    if not settings.OL_LLM_MEMORY_BACKEND:
        return None
    from ol_llm.memory import SyncMemory, build_memory

    from main.llm import configure_ol_llm

    configure_ol_llm()
    return SyncMemory(build_memory())


def note_text(profile: Profile, field: str) -> str:
    """Return the note for one profile field, or "" when the field is empty."""
    if field == "topic_interests":
        names = sorted(topic.name for topic in profile.topic_interests.all())
        return f"Interested in these topics: {', '.join(names)}." if names else ""
    if field == "current_education":
        if not profile.current_education:
            return ""
        return f"Education level: {profile.get_current_education_display()}."
    if field == "time_commitment":
        if not profile.time_commitment:
            return ""
        return f"Time available for learning: {profile.get_time_commitment_display()}."
    msg = f"{field} is not a profile note field"
    raise ValueError(msg)


def sync_profile_notes(
    request: HttpRequest, profile: Profile, fields: Iterable[str]
) -> None:
    """
    Write the notes for the given profile fields to the learner's memory.

    Only the learner's own request writes: a staff edit of someone else's
    profile carries the staff member's token, which would write to their memory.
    A memory outage or a forget in progress leaves the notes unwritten rather
    than failing the profile save.
    """
    fields = [field for field in NOTE_FIELDS if field in fields]
    if not fields or profile.user_id != request.user.id:
        return
    memory = get_memory()
    if memory is None:
        return
    token = request.META.get(ACCESS_TOKEN_HEADER)
    if not token:
        log.warning("No forwarded access token, so profile notes were not written")
        return
    from ol_llm import close_thread_loop
    from ol_llm.memory import MemoryFenced, MemoryStoreError

    try:
        notes = memory.learner(token, use_case=USE_CASE)
        for field in fields:
            text = note_text(profile, field)
            if text:
                notes.put(NOTE_KEYS[field], text)
            else:
                notes.delete(NOTE_KEYS[field])
    except MemoryFenced:
        log.info("Learner memory is being forgotten, so profile notes were not written")
    except MemoryStoreError as exc:
        # The exception's message can carry a service response; the class is
        # enough to triage and keeps anything token-shaped out of the logs.
        log.warning("Profile notes were not written: %s", type(exc).__name__)
    finally:
        # SyncMemory runs on a per-thread ol-llm loop, and under ASGI each
        # request's sync code runs on a thread that ends with the request, so
        # close the loop and its HTTP clients now rather than leaving them to GC.
        close_thread_loop()
