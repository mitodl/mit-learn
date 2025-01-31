"""Tests for AI agent services."""

import json

import pytest
from django.conf import settings
from django.core.cache import caches
from llama_index.core.base.llms.types import MessageRole
from llama_index.core.constants import DEFAULT_TEMPERATURE

from ai_chat.agents import SearchAgent, SyllabusAgent
from ai_chat.factories import ChatMessageFactory
from learning_resources.factories import LearningResourceFactory
from learning_resources.serializers import (
    CourseResourceSerializer,
)
from main.factories import UserFactory
from main.test_utils import assert_json_equal


@pytest.fixture(autouse=True)
def ai_settings(settings):
    """Set the AI settings for the tests."""
    settings.AI_CACHE = "default"
    settings.AI_PROXY_URL = ""
    return settings


@pytest.fixture
def chat_history():
    """Return one round trip chat history for testing."""
    return [
        ChatMessageFactory(role=MessageRole.USER),
        ChatMessageFactory(role=MessageRole.ASSISTANT),
    ]


@pytest.mark.parametrize(
    ("model", "temperature", "instructions"),
    [
        ("gpt-3.5-turbo", 0.1, "Answer this question as best you can"),
        ("gpt-4o", 0.3, None),
        ("gpt-4", None, None),
        (None, None, None),
    ],
)
def test_search_agent_service_initialization_defaults(model, temperature, instructions):
    """Test the SearchAgent class instantiation."""
    name = "My search agent"
    user_id = "testuser@test.edu"

    search_agent = SearchAgent(
        name,
        model=model,
        temperature=temperature,
        instructions=instructions,
        user_id=user_id,
    )
    assert search_agent.model == (model if model else settings.AI_MODEL)
    assert search_agent.temperature == (
        temperature if temperature else DEFAULT_TEMPERATURE
    )
    assert search_agent.instructions == (
        instructions if instructions else search_agent.instructions
    )
    assert search_agent.agent.__class__.__name__ == "OpenAIAgent"
    assert search_agent.agent.agent_worker._llm.model == (  # noqa: SLF001
        model if model else settings.AI_MODEL
    )


@pytest.mark.parametrize(
    ("cache_key", "cache_timeout", "save_history"),
    [
        ("test_cache_key", 60, True),
        ("test_cache_key", 60, False),
        (None, 60, True),
        (None, 60, False),
        ("test_cache_key", None, True),
        ("test_cache_key", None, False),
    ],
)
def test_search_agent_service_chat_history_settings(
    cache_key, cache_timeout, save_history
):
    """Test that the SearchAgent chat history settings are set correctly."""
    if save_history and not cache_key:
        with pytest.raises(
            ValueError, match="cache_key must be set to save chat history"
        ):
            SearchAgent(
                "test agent",
                cache_key=cache_key,
                cache_timeout=cache_timeout,
                save_history=save_history,
            )
    else:
        service = SearchAgent(
            "test agent",
            cache_key=cache_key,
            cache_timeout=cache_timeout,
            save_history=save_history,
        )
        assert service.cache_key == (cache_key if save_history else "")
        assert service.cache_timeout == (
            (cache_timeout if cache_timeout else settings.AI_CACHE_TIMEOUT)
            if save_history
            else None
        )


def test_get_or_create_chat_history_cache(settings, user, chat_history):
    """Test that the SearchAgent get_or_create_chat_history_cache method works."""

    caches[settings.AI_CACHE].set(
        f"{user.email}_test_cache_key",
        json.dumps([message.dict() for message in chat_history]),
    )
    user_service = SearchAgent(
        "test agent",
        user_id=user.email,
        cache_key=f"{user.email}_test_cache_key",
        save_history=True,
    )
    assert [
        (message.role, message.content) for message in user_service.agent.chat_history
    ] == [(message.role, message.content) for message in chat_history]

    # Different user should have different chat history
    user2 = UserFactory.create()
    user2_service = SearchAgent(
        "test agent",
        user_id=user2.email,
        cache_key=f"{user2.email}_test_cache_key",
        save_history=True,
    )
    assert user2_service.agent.chat_history == []

    # Same user different cache should have different chat history
    user_service2 = SearchAgent(
        "test agent",
        user_id=user.email,
        cache_key=f"{user.email}_other_cache_key",
        save_history=True,
    )
    assert user_service2.agent.chat_history == []

    # Chat history should be cleared out if requested
    assert len(user_service.agent.chat_history) == 2
    user_service.clear_chat_history()
    assert user_service.agent.chat_history == []
    assert caches[settings.AI_CACHE].get(f"{user.email}_test_cache_key") == "[]"


def test_clear_chat_history(client, user, chat_history):
    """Test that the SearchAgent clears chat_history."""

    caches[settings.AI_CACHE].set(
        f"{user.email}_test_cache_key",
        json.dumps([message.dict() for message in chat_history]),
    )
    search_agent = SearchAgent(
        "test agent",
        user_id=user.email,
        cache_key=f"{user.email}_test_cache_key",
        save_history=True,
    )
    assert len(search_agent.agent.chat_history) == 2
    assert (
        len(json.loads(caches[settings.AI_CACHE].get(f"{user.email}_test_cache_key")))
        == 2
    )

    search_agent.clear_chat_history()
    assert search_agent.agent.chat_history == []
    assert caches[settings.AI_CACHE].get(f"{user.email}_test_cache_key") == "[]"


@pytest.mark.django_db
def test_search_agent_tool(settings, mocker):
    """The search agent tool should be created and function correctly."""
    settings.AI_MIT_SEARCH_LIMIT = 5
    retained_attributes = [
        "title",
        "url",
        "description",
        "offered_by",
        "free",
        "certification",
        "resource_type",
    ]
    raw_results = [
        CourseResourceSerializer(resource).data
        for resource in LearningResourceFactory.create_batch(5)
    ]
    expected_results = [
        {key: resource.get("key") for key in retained_attributes}
        for resource in raw_results
    ]
    mock_post = mocker.patch(
        "ai_chat.agents.requests.get",
        return_value=mocker.Mock(
            json=mocker.Mock(return_value={"results": expected_results})
        ),
    )
    search_agent = SearchAgent("test agent")
    search_parameters = {
        "q": "physics",
        "resource_type": ["course", "program"],
        "free": False,
        "certification": True,
        "offered_by": "xpro",
        "limit": 5,
    }
    tool = search_agent.create_tools()[0]
    results = tool._fn(**search_parameters)  # noqa: SLF001
    mock_post.assert_called_once_with(
        settings.AI_MIT_SEARCH_URL, params=search_parameters, timeout=30
    )
    assert_json_equal(json.loads(results), expected_results)


@pytest.mark.django_db
def test_get_completion(mocker):
    """Test that the SearchAgent get_completion method returns expected values."""
    metadata = {
        "metadata": {
            "search_parameters": {"q": "physics"},
            "search_results": [
                CourseResourceSerializer(resource).data
                for resource in LearningResourceFactory.create_batch(5)
            ],
            "system_prompt": SearchAgent.INSTRUCTIONS,
        }
    }
    expected_return_value = ["Here ", "are ", "some ", "results"]
    mocker.patch(
        "ai_chat.agents.OpenAIAgent.stream_chat",
        return_value=mocker.Mock(response_gen=iter(expected_return_value)),
    )
    mock_hog = mocker.patch("ai_chat.agents.posthog.Posthog")
    search_agent = SearchAgent("test agent", user_id="testuser@email.edu")
    search_agent.search_parameters = metadata["metadata"]["search_parameters"]
    search_agent.search_results = metadata["metadata"]["search_results"]
    search_agent.instructions = metadata["metadata"]["system_prompt"]
    search_agent.search_parameters = {"q": "physics"}
    search_agent.search_results = [
        CourseResourceSerializer(resource).data
        for resource in LearningResourceFactory.create_batch(5)
    ]
    results = "".join(
        [
            str(chunk)
            for chunk in search_agent.get_completion(
                "I want to learn physics",
            )
        ]
    )
    search_agent.agent.stream_chat.assert_called_once_with("I want to learn physics")
    mock_hog.return_value.capture.assert_called_once_with(
        "testuser@email.edu",
        event=search_agent.JOB_ID,
        properties={
            "question": "I want to learn physics",
            "answer": "Here are some results",
            "metadata": search_agent.get_comment_metadata(),
            "user": "testuser@email.edu",
        },
    )
    assert "".join([str(value) for value in expected_return_value]) in results


@pytest.mark.django_db
def test_collection_name_param(settings, mocker):
    """The collection name should be passed through to the contentfile search"""
    settings.AI_MIT_SEARCH_LIMIT = 5
    settings.AI_MIT_SYLLABUS_URL = "https://test.com/api/v0/contentfiles/"
    mock_post = mocker.patch(
        "ai_chat.agents.requests.get",
        return_value=mocker.Mock(json=mocker.Mock(return_value={})),
    )
    search_agent = SyllabusAgent("test agent", collection_name="content_files_512")
    search_agent.get_completion("I want to learn physics", readable_id="test")
    search_agent.search_content_files()
    mock_post.assert_called_once_with(
        settings.AI_MIT_SYLLABUS_URL,
        params={
            "q": "I want to learn physics",
            "resource_readable_id": "test",
            "limit": 20,
            "collection_name": "content_files_512",
        },
        timeout=30,
    )
