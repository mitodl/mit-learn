"""Tests for AI agent services."""

import pytest
from django.conf import settings
from llama_index.core.constants import DEFAULT_TEMPERATURE

from ai_chat.agents import SearchAgentService


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
