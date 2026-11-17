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
    from ol_llm.memory import SyncLearnerMemory, SyncMemory

log = logging.getLogger(__name__)

USE_CASE = "profile-notes"
ACCESS_TOKEN_HEADER = "HTTP_X_ACCESS_TOKEN"  # noqa: S105 - a header name
NOTE_TEMPLATES = {
    "topic_interests": "Interested in these topics: {}.",
    "goals": "Learning goals: {}.",
    "certificate_desired": "Wants a certificate: {}.",
    "current_education": "Education level: {}.",
    "time_commitment": "Time available for learning: {}.",
    "delivery": "Preferred learning formats: {}.",
}
NOTE_FIELDS = tuple(NOTE_TEMPLATES)
NOTE_KEYS = {field: f"profile-{field.replace('_', '-')}" for field in NOTE_FIELDS}
# The choice labels are written as the learner's answer ("Yes, I am looking for
# a certificate"), which reads wrong in a note about them.
CERTIFICATE_DESIRED_ANSWERS = {
    Profile.CertificateDesired.YES: "yes",
    Profile.CertificateDesired.NO: "no",
    Profile.CertificateDesired.NOT_SURE_YET: "not sure yet",
}
LIST_CHOICES = {"goals": Profile.Goal, "delivery": Profile.LearningResourceDelivery}


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


def _note_value(profile: Profile, field: str) -> str:
    """Return the field's value as note text, or "" when the field is empty."""
    if field == "topic_interests":
        names = [topic.name for topic in profile.topic_interests.all()]
    elif field in LIST_CHOICES:
        names = [
            str(LIST_CHOICES[field](value).label) for value in getattr(profile, field)
        ]
    elif not getattr(profile, field):
        return ""
    elif field == "certificate_desired":
        return CERTIFICATE_DESIRED_ANSWERS[profile.certificate_desired]
    else:
        return getattr(profile, f"get_{field}_display")()
    return ", ".join(sorted(names))


def note_text(profile: Profile, field: str) -> str:
    """Return the note for one profile field, or "" when the field is empty."""
    if field not in NOTE_TEMPLATES:
        msg = f"{field} is not a profile note field"
        raise ValueError(msg)
    value = _note_value(profile, field)
    return NOTE_TEMPLATES[field].format(value) if value else ""


def _write_note(notes: "SyncLearnerMemory", profile: Profile, field: str) -> None:
    """
    Write or delete one field's note, so a failure leaves the others to be tried.

    A forget in progress refuses every write, so it is raised to stop the rest.
    """
    from ol_llm.memory import MemoryFenced

    text = note_text(profile, field)
    try:
        if text:
            notes.put(NOTE_KEYS[field], text)
        else:
            notes.delete(NOTE_KEYS[field])
    except MemoryFenced:
        raise
    except Exception as exc:  # noqa: BLE001 - the other fields still get written
        # The exception's message can carry a service response; the class is
        # enough to triage and keeps anything token-shaped out of the logs.
        log.warning(
            "Profile note %s was not written: %s", NOTE_KEYS[field], type(exc).__name__
        )


def sync_profile_notes(
    request: HttpRequest, profile: Profile, fields: Iterable[str]
) -> None:
    """
    Write the notes for the given profile fields to the learner's memory.

    Only the learner's own request writes: a staff edit of someone else's
    profile carries the staff member's token, which would write to their memory.
    A memory outage, a forget in progress, a misconfigured memory client, or any
    other failure leaves notes unwritten rather than failing the profile save,
    which has already been committed. A failed write skips only its own note.
    """
    fields = [field for field in NOTE_FIELDS if field in fields]
    if not fields or profile.user_id != request.user.id:
        return
    try:
        memory = get_memory()
    except ValueError as exc:
        # An incomplete OL_LLM_MEMORY_* deployment, logged as an error on every
        # save so it reaches Sentry. No stack: Sentry captures frame locals, and
        # the raising frame in ol-llm holds the client secret and the environment.
        log.error(  # noqa: TRY400
            "Learner memory is misconfigured, so profile notes were not written: %s",
            type(exc).__name__,
        )
        return
    if memory is None:
        return
    token = request.META.get(ACCESS_TOKEN_HEADER)
    if not token:
        log.warning("No forwarded access token, so profile notes were not written")
        return
    from ol_llm import close_thread_loop
    from ol_llm.memory import MemoryFenced

    try:
        notes = memory.learner(token, use_case=USE_CASE)
        for field in fields:
            _write_note(notes, profile, field)
    except MemoryFenced:
        log.info("Learner memory is being forgotten, so profile notes were not written")
    except Exception as exc:  # noqa: BLE001 - the save is already committed
        # e.g. a refused token exchange, or a 2xx exchange whose body isn't the
        # expected JSON, which ol-llm doesn't wrap. See _write_note for why only
        # the class is logged.
        log.warning("Profile notes were not written: %s", type(exc).__name__)
    finally:
        # SyncMemory runs on a per-thread ol-llm loop, and under ASGI each
        # request's sync code runs on a thread that ends with the request, so
        # close the loop and its HTTP clients now rather than leaving them to GC.
        close_thread_loop()
