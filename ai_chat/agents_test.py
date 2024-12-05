"""Tests for AI agent services."""

import json

import pytest
from django.conf import settings
from django.core.cache import caches
from llama_index.core.constants import DEFAULT_TEMPERATURE

from ai_chat.agents import SearchAgentService
from main.factories import UserFactory


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
    """Test the SearchAgentService class instantiation."""
    name = "My search agent"
    user_id = "testuser@test.edu"

    service = SearchAgentService(
        name,
        model=model,
        temperature=temperature,
        instructions=instructions,
        user_id=user_id,
    )
    assert service.model == (model if model else settings.AI_MODEL)
    assert service.temperature == (temperature if temperature else DEFAULT_TEMPERATURE)
    assert service.instructions == (
        instructions if instructions else service.instructions
    )
    assert service.agent.__class__.__name__ == "OpenAIAgent"


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
    """Test that the SearchAgentService chat history settings are set correctly."""
    if save_history and not cache_key:
        with pytest.raises(
            ValueError, match="cache_key must be set to save chat history"
        ):
            SearchAgentService(
                "test agent",
                cache_key=cache_key,
                cache_timeout=cache_timeout,
                save_history=save_history,
            )
    else:
        service = SearchAgentService(
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


def test_get_or_create_chat_history_cache(settings, user):
    """Test that the SearchAgentService get_or_create_chat_history_cache method works."""
    settings.AI_CACHE = "default"
    user_chat_history = [
        {"role": "user", "content": "Recommend me a biology course"},
        {"role": "chatbot", "content": "I recommend Intro to Biology 101"},
    ]

    caches[settings.AI_CACHE].set(
        f"{user.email}_test_cache_key", json.dumps(user_chat_history)
    )
    user_service = SearchAgentService(
        "test agent",
        user_id=user.email,
        cache_key=f"{user.email}_test_cache_key",
        save_history=True,
    )
    assert [
        (message.role, message.content) for message in user_service.agent.chat_history
    ] == [(message["role"], message["content"]) for message in user_chat_history]

    # Different user should have different chat history
    user2 = UserFactory.create()
    user2_service = SearchAgentService(
        "test agent",
        user_id=user2.email,
        cache_key=f"{user2.email}_test_cache_key",
        save_history=True,
    )
    assert user2_service.agent.chat_history == []

    # Same user different cache should have different chat history
    user_service2 = SearchAgentService(
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
