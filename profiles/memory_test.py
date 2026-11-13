"""Tests for profile notes in learner memory"""

# pylint: disable=redefined-outer-name
import pytest
from django.urls import reverse
from ol_llm.memory import (
    InMemoryBackend,
    InMemoryStore,
    Memory,
    MemoryNotFound,
    MemoryUnavailable,
    SyncMemory,
)
from rest_framework import status

from learning_resources.factories import LearningResourceTopicFactory
from main.llm import configure_ol_llm
from profiles import memory as profile_memory
from profiles.models import Profile

pytestmark = [pytest.mark.django_db]

# The in-memory backend takes the session token to be the learner id.
TOKEN = "learner-session-token"  # noqa: S105


@pytest.fixture
def memory(mocker):
    """mit-learn's memory client on the in-memory backend"""
    configure_ol_llm()
    backend = InMemoryBackend("mit-learn", store=InMemoryStore())
    client = SyncMemory(Memory(backend))
    mocker.patch("profiles.memory.get_memory", return_value=client)
    return client


def learner_notes(client):
    """Return the notes the logged-in learner's token reads, by key"""
    return {
        note.key: note.text
        for note in client.learner(TOKEN, use_case="profile-notes-test").list()
    }


def patch_profile(client, profile, data, **headers):
    """PATCH the profile through the API"""
    url = reverse(
        "profile:v0:profile_api-detail",
        kwargs={"user__username": profile.user.username},
    )
    return client.patch(url, data=data, format="json", **headers)


def test_profile_save_writes_changed_fields(client, logged_in_profile, memory):
    """Only the note fields in the request are written, under mit-learn's keys"""
    topics = [
        LearningResourceTopicFactory.create(name="Physics", parent=None),
        LearningResourceTopicFactory.create(name="Biology", parent=None),
    ]
    resp = patch_profile(
        client,
        logged_in_profile,
        {
            "topic_interests": [topic.id for topic in topics],
            "time_commitment": Profile.TimeCommitment.FIVE_TO_TEN_HOURS,
            "bio": "not a note",
        },
        HTTP_X_ACCESS_TOKEN=TOKEN,
    )

    assert resp.status_code == status.HTTP_200_OK
    assert learner_notes(memory) == {
        "profile-topic-interests": "Interested in these topics: Biology, Physics.",
        "profile-time-commitment": "Time available for learning: 5-10 hours/week.",
    }
    note = memory.learner(TOKEN, use_case="test").get("profile-time-commitment")
    assert note.app == "mit-learn"


def test_clearing_a_field_deletes_its_note(client, logged_in_profile, memory):
    """A field saved empty removes the note it had"""
    patch_profile(
        client,
        logged_in_profile,
        {"current_education": Profile.CurrentEducation.MASTERS},
        HTTP_X_ACCESS_TOKEN=TOKEN,
    )
    assert learner_notes(memory) == {
        "profile-current-education": (
            "Education level: Master's or professional degree."
        )
    }

    resp = patch_profile(
        client,
        logged_in_profile,
        {"current_education": ""},
        HTTP_X_ACCESS_TOKEN=TOKEN,
    )

    assert resp.status_code == status.HTTP_200_OK
    with pytest.raises(MemoryNotFound):
        memory.learner(TOKEN, use_case="test").get("profile-current-education")


def test_onboarding_save_through_me_writes_notes(client, logged_in_profile, memory):
    """Onboarding saves through /profiles/me/, which writes the notes too"""
    url = reverse("profile:v0:profile_api-detail", kwargs={"user__username": "me"})

    resp = client.patch(
        url,
        data={
            "current_education": Profile.CurrentEducation.DOCTORATE,
            "time_commitment": Profile.TimeCommitment.THIRTY_PLUS_HOURS,
            "topic_interests": [],
        },
        format="json",
        HTTP_X_ACCESS_TOKEN=TOKEN,
    )

    assert resp.status_code == status.HTTP_200_OK
    assert learner_notes(memory) == {
        "profile-current-education": "Education level: Doctorate.",
        "profile-time-commitment": "Time available for learning: 30+ hours/week.",
    }


def test_staff_edit_of_another_profile_writes_nothing(
    staff_client, user, mocker, memory
):
    """A staff edit carries the staff member's token, so it must not write"""
    learner = mocker.spy(memory, "learner")

    resp = patch_profile(
        staff_client,
        user.profile,
        {"time_commitment": Profile.TimeCommitment.ZERO_TO_FIVE_HOURS},
        HTTP_X_ACCESS_TOKEN=TOKEN,
    )

    assert resp.status_code == status.HTTP_200_OK
    learner.assert_not_called()


def test_no_forwarded_token_writes_nothing(client, logged_in_profile, mocker, memory):
    """Without the gateway's token there is no learner to write for"""
    learner = mocker.spy(memory, "learner")

    resp = patch_profile(
        client,
        logged_in_profile,
        {"time_commitment": Profile.TimeCommitment.ZERO_TO_FIVE_HOURS},
    )

    assert resp.status_code == status.HTTP_200_OK
    learner.assert_not_called()


def test_memory_outage_does_not_fail_the_save(client, logged_in_profile, mocker):
    """An unavailable memory service leaves the profile saved"""
    client_mock = mocker.Mock()
    client_mock.learner.side_effect = MemoryUnavailable("down", operation="exchange")
    mocker.patch("profiles.memory.get_memory", return_value=client_mock)

    resp = patch_profile(
        client,
        logged_in_profile,
        {"time_commitment": Profile.TimeCommitment.ZERO_TO_FIVE_HOURS},
        HTTP_X_ACCESS_TOKEN=TOKEN,
    )

    assert resp.status_code == status.HTTP_200_OK
    logged_in_profile.refresh_from_db()
    assert (
        logged_in_profile.time_commitment == Profile.TimeCommitment.ZERO_TO_FIVE_HOURS
    )


def test_forget_in_progress_does_not_fail_the_save(client, logged_in_profile, memory):
    """A fenced memory refuses the writes and the profile still saves"""
    memory.admin(use_case="profile-notes-test").forget(TOKEN)

    resp = patch_profile(
        client,
        logged_in_profile,
        {"time_commitment": Profile.TimeCommitment.ZERO_TO_FIVE_HOURS},
        HTTP_X_ACCESS_TOKEN=TOKEN,
    )

    assert resp.status_code == status.HTTP_200_OK
    assert learner_notes(memory) == {}


def test_failure_partway_leaves_the_save(client, logged_in_profile, mocker):
    """An outage on one write skips the rest and the profile still saves"""
    notes = mocker.Mock()
    notes.put.side_effect = MemoryUnavailable("down", operation="put")
    client_mock = mocker.Mock()
    client_mock.learner.return_value = notes
    mocker.patch("profiles.memory.get_memory", return_value=client_mock)

    resp = patch_profile(
        client,
        logged_in_profile,
        {
            "current_education": Profile.CurrentEducation.BACHELORS,
            "time_commitment": Profile.TimeCommitment.ZERO_TO_FIVE_HOURS,
        },
        HTTP_X_ACCESS_TOKEN=TOKEN,
    )

    assert resp.status_code == status.HTTP_200_OK
    # current_education is written first and fails, so time_commitment is not tried
    notes.put.assert_called_once_with(
        "profile-current-education", "Education level: Bachelor's degree."
    )
    logged_in_profile.refresh_from_db()
    assert logged_in_profile.current_education == Profile.CurrentEducation.BACHELORS


def test_thread_loop_closed_after_writing(client, logged_in_profile, mocker, memory):
    """The request's ol-llm loop and its clients are closed after the writes"""
    close_thread_loop = mocker.patch("ol_llm.close_thread_loop")

    patch_profile(
        client,
        logged_in_profile,
        {"time_commitment": Profile.TimeCommitment.ZERO_TO_FIVE_HOURS},
        HTTP_X_ACCESS_TOKEN=TOKEN,
    )

    close_thread_loop.assert_called_once_with()


@pytest.fixture
def fresh_get_memory():
    """Clear get_memory's cached client before and after the test"""
    profile_memory.get_memory.cache_clear()
    yield profile_memory.get_memory
    profile_memory.get_memory.cache_clear()


def test_memory_off_without_a_backend(settings, fresh_get_memory):
    """No backend configured means no memory client"""
    settings.OL_LLM_MEMORY_BACKEND = None

    assert fresh_get_memory() is None


def test_memory_built_from_the_environment(settings, monkeypatch, fresh_get_memory):
    """A configured backend gives a client that writes as mit-learn"""
    settings.OL_LLM_MEMORY_BACKEND = "in-memory"
    monkeypatch.setenv("OL_LLM_MEMORY_BACKEND", "in-memory")
    monkeypatch.setenv("OL_LLM_MEMORY_APP", "mit-learn")

    client = fresh_get_memory()

    assert isinstance(client, SyncMemory)
    assert client.app == "mit-learn"
