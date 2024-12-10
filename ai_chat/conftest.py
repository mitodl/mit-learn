import pytest


@pytest.fixture
def mock_search_agent_service(mocker):
    """Mock the SearchAgentService class."""
    return mocker.patch(
        "ai_chat.views.SearchAgentService",
        autospec=True,
    )
