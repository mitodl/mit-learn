"""Unit tests for the views module."""

import pytest
from rest_framework.reverse import reverse


@pytest.mark.parametrize("clear_history", [True, False])
@pytest.mark.parametrize("is_authenticated", [True, False])
def test_post_search_agent_endpoint(
    mocker, client, user, clear_history, is_authenticated
):
    """Test SearchAgentView post endpoint"""
    expected_answer = [b"Here ", b"are ", b"some ", b"results"]
    expected_user_id = user.email if is_authenticated else "anonymous"
    user_message = "Do you have any good physics courses?"
    temperature = 0.1
    system_prompt = "Answer this question as best you can"
    mock_service = mocker.patch("ai_chat.views.SearchAgentService", autospec=True)
    mock_service.return_value.run_streaming_agent = mocker.Mock(
        return_value=iter(expected_answer)
    )
    model = "gpt-3.5-turbo"
    if is_authenticated:
        client.force_login(user)
    resp = client.post(
        f"{reverse('ai_chat:v0:chatbot_agent_api')}",
        session=client.session,
        data={
            "message": user_message,
            "clear_history": clear_history,
            "model": model,
            "temperature": 0.1,
            "instructions": system_prompt,
        },
    )
    expected_cache_prefix = (
        user.email if is_authenticated else resp.request["session"].session_key
    )
    mock_service.assert_called_once_with(
        "Learning Resource Search AI Assistant",
        user_id=expected_user_id,
        cache_key=f"{expected_cache_prefix}_search_chat_history",
        save_history=True,
        model=model,
        instructions=system_prompt,
        temperature=temperature,
    )
    instantiated_service = mock_service.return_value
    instantiated_service.run_streaming_agent.assert_called_once_with(user_message)
    assert instantiated_service.clear_chat_history.call_count == (
        1 if clear_history else 0
    )
    assert resp.status_code == 200
    assert list(resp.streaming_content) == expected_answer
