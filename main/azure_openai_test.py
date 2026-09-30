"""Tests for the Azure OpenAI connection helpers"""

import litellm
import pytest
from django.core.exceptions import ImproperlyConfigured
from langchain_litellm import ChatLiteLLM

from main import azure_openai
from main.azure_openai import (
    COGNITIVE_SERVICES_SCOPE,
    azure_ad_token_provider,
    azure_openai_chat_litellm_kwargs,
    azure_openai_litellm_params,
    is_azure_model,
    strip_azure_prefix,
)

AZURE_ENDPOINT = "https://ol-openai-test.openai.azure.com/"


def fake_token_provider():
    """Stand in for the azure-identity bearer token provider"""
    return "fake-entra-token"


@pytest.fixture
def azure_settings(settings, mocker):
    """Configure Azure OpenAI with a fake token provider"""
    settings.AZURE_OPENAI_ENDPOINT = AZURE_ENDPOINT
    settings.AZURE_OPENAI_API_VERSION = "2024-10-21"
    mocker.patch(
        "main.azure_openai.azure_ad_token_provider",
        return_value=fake_token_provider,
    )
    return settings


@pytest.mark.parametrize(
    ("model", "is_azure", "stripped"),
    [
        ("azure/gpt-4o", True, "gpt-4o"),
        ("azure/text-embedding-3-large", True, "text-embedding-3-large"),
        ("gpt-4o", False, "gpt-4o"),
        ("openai/gpt-4o", False, "openai/gpt-4o"),
        ("text-embedding-3-large", False, "text-embedding-3-large"),
        (None, False, None),
    ],
)
def test_azure_model_prefix(model, is_azure, stripped):
    """Only an "azure/" prefix opts a model in to Azure OpenAI"""
    assert is_azure_model(model) is is_azure
    assert strip_azure_prefix(model) == stripped


def test_azure_openai_litellm_params(azure_settings):
    """The litellm params carry the endpoint, API version and token provider"""
    assert azure_openai_litellm_params() == {
        "custom_llm_provider": "azure",
        "api_base": AZURE_ENDPOINT,
        "api_version": "2024-10-21",
        "azure_ad_token_provider": fake_token_provider,
    }


def test_azure_openai_litellm_params_blank_api_version(azure_settings):
    """A blank API version is left to litellm's default rather than sent empty"""
    azure_settings.AZURE_OPENAI_API_VERSION = ""
    assert azure_openai_litellm_params()["api_version"] is None


def test_azure_openai_litellm_params_requires_endpoint(azure_settings):
    """An azure/ model without an endpoint fails instead of calling OpenAI"""
    azure_settings.AZURE_OPENAI_ENDPOINT = ""
    with pytest.raises(ImproperlyConfigured, match="AZURE_OPENAI_ENDPOINT"):
        azure_openai_litellm_params()


def test_azure_openai_chat_litellm_kwargs(azure_settings):
    """The endpoint goes in model_kwargs as base_url, not as ChatLiteLLM's api_base"""
    assert azure_openai_chat_litellm_kwargs() == {
        "custom_llm_provider": "azure",
        "model_kwargs": {
            "base_url": AZURE_ENDPOINT,
            "api_version": "2024-10-21",
            "azure_ad_token_provider": fake_token_provider,
        },
    }


def test_chat_litellm_passes_azure_kwargs_to_litellm(azure_settings, mocker):
    """
    ChatLiteLLM forwards the Azure kwargs to litellm.completion and leaves the
    litellm.api_base global unset.
    """
    mock_completion = mocker.patch(
        "litellm.completion",
        return_value={
            "choices": [
                {
                    "message": {"role": "assistant", "content": "hello"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {},
        },
    )
    mocker.patch("litellm.api_base", None)
    llm = ChatLiteLLM(model="azure/gpt-4o", **azure_openai_chat_litellm_kwargs())

    assert llm.invoke("hi").content == "hello"

    kwargs = mock_completion.call_args.kwargs
    assert kwargs["model"] == "azure/gpt-4o"
    assert kwargs["custom_llm_provider"] == "azure"
    assert kwargs["base_url"] == AZURE_ENDPOINT
    assert kwargs["api_version"] == "2024-10-21"
    assert kwargs["azure_ad_token_provider"] is fake_token_provider
    assert kwargs["api_base"] is None
    assert litellm.api_base is None


def test_azure_ad_token_provider_is_built_once(mocker):
    """The credential is created once per process, not per call"""
    azure_ad_token_provider.cache_clear()
    mock_credential = mocker.patch.object(azure_openai, "DefaultAzureCredential")
    mock_get_provider = mocker.patch.object(azure_openai, "get_bearer_token_provider")
    try:
        first = azure_ad_token_provider()
        second = azure_ad_token_provider()
    finally:
        azure_ad_token_provider.cache_clear()

    assert first is second
    mock_credential.assert_called_once_with()
    mock_get_provider.assert_called_once_with(
        mock_credential.return_value, COGNITIVE_SERVICES_SCOPE
    )
