"""Tests for vector_search.encoders.utils"""

import pytest

from vector_search.encoders.utils import (
    DEFAULT_TRUNCATE_CHARS,
    _warn_character_fallback,
    truncate_to_model_limit,
)


class FakeEncoding:
    """Fake tiktoken encoding that treats each character as one token"""

    def encode(self, text):
        return list(text)

    def decode(self, tokens):
        return "".join(tokens)


@pytest.fixture(autouse=True)
def _clear_fallback_warning_cache():
    """Reset the once-per-model fallback warning between tests"""
    _warn_character_fallback.cache_clear()


@pytest.fixture
def warning_mock(mocker):
    """Mock the module logger's warning method"""
    return mocker.patch("vector_search.encoders.utils.logger.warning")


def test_truncate_to_model_limit_truncates_long_text(mocker, warning_mock):
    """Text over the model's max input tokens is cut to that token limit"""
    mocker.patch(
        "vector_search.encoders.utils.get_model_info",
        return_value={"max_input_tokens": 5},
    )
    mocker.patch(
        "vector_search.encoders.utils.tiktoken.get_encoding",
        return_value=FakeEncoding(),
    )

    result = truncate_to_model_limit(
        "0123456789",
        "test-model",
        token_encoding_name="test-encoding",  # noqa: S106
    )

    assert result == "01234"
    warning_mock.assert_not_called()


def test_truncate_to_model_limit_leaves_short_text_unchanged(mocker, warning_mock):
    """Text within the model's max input tokens is returned as-is"""
    mocker.patch(
        "vector_search.encoders.utils.get_model_info",
        return_value={"max_input_tokens": 5},
    )
    mocker.patch(
        "vector_search.encoders.utils.tiktoken.get_encoding",
        return_value=FakeEncoding(),
    )

    result = truncate_to_model_limit(
        "0123",
        "test-model",
        token_encoding_name="test-encoding",  # noqa: S106
    )

    assert result == "0123"
    warning_mock.assert_not_called()


def test_truncate_to_model_limit_unknown_model_falls_back_to_chars(
    mocker, warning_mock
):
    """Fall back to the character limit when model info can't be determined"""
    mocker.patch(
        "vector_search.encoders.utils.get_model_info",
        side_effect=ValueError("unknown model"),
    )
    get_encoding_mock = mocker.patch(
        "vector_search.encoders.utils.tiktoken.get_encoding"
    )
    text = "x" * (DEFAULT_TRUNCATE_CHARS + 100)

    result = truncate_to_model_limit(
        text,
        "mystery-model",
        token_encoding_name="test-encoding",  # noqa: S106
    )

    assert result == text[:DEFAULT_TRUNCATE_CHARS]
    get_encoding_mock.assert_not_called()
    warning_mock.assert_called_once()


def test_truncate_to_model_limit_missing_max_tokens_falls_back_to_chars(
    mocker, warning_mock
):
    """Fall back to the character limit when the model has no max_input_tokens"""
    mocker.patch(
        "vector_search.encoders.utils.get_model_info",
        return_value={},
    )
    text = "x" * (DEFAULT_TRUNCATE_CHARS + 100)

    result = truncate_to_model_limit(
        text,
        "test-model",
        token_encoding_name="test-encoding",  # noqa: S106
    )

    assert result == text[:DEFAULT_TRUNCATE_CHARS]
    warning_mock.assert_called_once()


def test_truncate_to_model_limit_no_token_encoding_falls_back_to_chars(
    mocker, warning_mock
):
    """Fall back to the character limit when no token encoding name is given"""
    mocker.patch(
        "vector_search.encoders.utils.get_model_info",
        return_value={"max_input_tokens": 5},
    )
    text = "x" * (DEFAULT_TRUNCATE_CHARS + 100)

    result = truncate_to_model_limit(text, "test-model")

    assert result == text[:DEFAULT_TRUNCATE_CHARS]
    warning_mock.assert_called_once()


def test_truncate_to_model_limit_bad_encoding_falls_back_to_chars(mocker, warning_mock):
    """Fall back to the character limit when the tiktoken encoding fails"""
    mocker.patch(
        "vector_search.encoders.utils.get_model_info",
        return_value={"max_input_tokens": 5},
    )
    mocker.patch(
        "vector_search.encoders.utils.tiktoken.get_encoding",
        side_effect=ValueError("bad encoding"),
    )
    text = "x" * (DEFAULT_TRUNCATE_CHARS + 100)

    result = truncate_to_model_limit(
        text,
        "test-model",
        token_encoding_name="bad-encoding",  # noqa: S106
    )

    assert result == text[:DEFAULT_TRUNCATE_CHARS]
    warning_mock.assert_called_once()


def test_truncate_to_model_limit_fallback_warns_once_per_model(mocker, warning_mock):
    """The fallback warning is deduplicated per model/encoding combination"""
    mocker.patch(
        "vector_search.encoders.utils.get_model_info",
        side_effect=ValueError("unknown model"),
    )

    truncate_to_model_limit("some text", "model-a")
    truncate_to_model_limit("other text", "model-a")
    assert warning_mock.call_count == 1

    truncate_to_model_limit("some text", "model-b")
    assert warning_mock.call_count == 2


@pytest.mark.parametrize(
    "model_info_kwargs",
    [
        {"side_effect": ValueError("unknown model")},
        {"return_value": {}},
        {"return_value": {"max_input_tokens": 5}},
    ],
)
def test_truncate_to_model_limit_strict_raises_instead_of_falling_back(
    mocker, model_info_kwargs
):
    """In strict mode any fallback condition raises instead of truncating"""
    mocker.patch(
        "vector_search.encoders.utils.get_model_info",
        **model_info_kwargs,
    )
    # no token_encoding_name, so even a known model can't use token truncation

    with pytest.raises(ValueError, match="Cannot apply a token limit"):
        truncate_to_model_limit("some text", "test-model", strict=True)


def test_truncate_to_model_limit_strict_allows_token_truncation(mocker, warning_mock):
    """Strict mode doesn't interfere when token-based truncation works"""
    mocker.patch(
        "vector_search.encoders.utils.get_model_info",
        return_value={"max_input_tokens": 5},
    )
    mocker.patch(
        "vector_search.encoders.utils.tiktoken.get_encoding",
        return_value=FakeEncoding(),
    )

    result = truncate_to_model_limit(
        "0123456789",
        "test-model",
        token_encoding_name="test-encoding",  # noqa: S106
        strict=True,
    )

    assert result == "01234"
    warning_mock.assert_not_called()
