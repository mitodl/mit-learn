import logging
from typing import Annotated

import litellm
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from langchain_litellm import ChatLiteLLM
from litellm import get_max_tokens
from typing_extensions import TypedDict

from learning_resources.exceptions import (
    FlashcardsGenerationError,
    SummaryGenerationError,
)
from learning_resources.models import (
    ContentFile,
    ContentSummarizerConfiguration,
)
from learning_resources.utils import truncate_to_tokens

logger = logging.getLogger(__name__)

# drop unsupported model params
litellm.drop_params = True


class Flashcard(TypedDict):
    """Flashcard structure model"""

    question: Annotated[str, ..., "The question for the flashcard"]
    answer: Annotated[str, ..., "The answer for the flashcard"]


class FlashcardsResponse(TypedDict):
    """Flashcards response model"""

    flashcards: Annotated[list[Flashcard], ..., "A list of generated flashcards"]


class ContentSummarizer:
    """
    A service class to generate summaries and flashcards for the ContentFiles.
    """

    def _can_process_content_file(self, content_file: ContentFile) -> bool:
        """Check if a content file can be processed
        Args:
            - content_file (ContentFile): Content file to check
        Returns:
            - bool: Whether the content file can be processed
        """

        if not content_file.content:
            # Summarizer needs content to process, if there is no content then skip
            return False

        platform = (
            content_file.run.learning_resource.platform
            if content_file.run
            else content_file.learning_resource.platform
        )
        summarizer_config = getattr(platform, "summarizer_config", None)

        if not summarizer_config or not summarizer_config.is_active:
            return False

        return (
            content_file.content_type in summarizer_config.allowed_content_types
            and content_file.file_extension in summarizer_config.allowed_extensions
        )

    def get_unprocessed_content_file_ids(
        self,
        overwrite,
        learning_resource_ids: list[int] | None = None,
        content_file_ids: list[int] | None = None,
    ) -> list[int]:
        """
        Get Ids of unprocessed content files with applied filters.

        Args:
            - learning_resource_ids (list[int]): List of learning resource ids to
            process
            - content_file_ids (list[int]): List of content file ids to process
            - overwrite (bool): Whether to force regenerate existing summary and
            flashcards

        Returns:
            - list[int]: List of valid unprocessed content file ids
        """

        summarizer_configurations = ContentSummarizerConfiguration.objects.filter(
            is_active=True
        )
        unprocessed_content_file_ids = []
        for summarizer_configuration in summarizer_configurations:
            unprocessed_content = ContentFile.objects.exclude(
                Q(content__isnull=True) | Q(content="")
            )
            # The content file platform and configuration platform should match
            unprocessed_content = unprocessed_content.filter(
                run__learning_resource__platform=summarizer_configuration.platform
            )
            # The content_file's extension and content_type should match with allowed
            # extension and content types configuration.
            unprocessed_content = unprocessed_content.filter(
                content_type__in=summarizer_configuration.allowed_content_types,
                file_extension__in=summarizer_configuration.allowed_extensions,
            )
            # Don't check for existing summaries and flashcards if overwrite is True
            if not overwrite:
                unprocessed_content = unprocessed_content.filter(
                    Q(summary="") | Q(flashcards=[])
                )

            # Filter specific content files if content file Ids are provided
            if content_file_ids:
                unprocessed_content = unprocessed_content.filter(
                    id__in=content_file_ids
                )

            # Filter specific content files if learning resource Ids are provided
            if learning_resource_ids:
                unprocessed_content = unprocessed_content.filter(
                    run__learning_resource__id__in=learning_resource_ids
                )

            unprocessed_content_file_ids = list(
                unprocessed_content.values_list("id", flat=True)
            )

        return unprocessed_content_file_ids

    def summarize_content_files_by_ids(
        self, content_file_ids: list[int], overwrite
    ) -> list[str]:
        """Process multiple content files by id.

        Args:
            - ids (list[int]): List of content file ids to process
            - overwrite (bool): Whether to overwrite existing summary and flashcards

        Returns:
            - list[str]: List of status messages for each content file
        """
        status_messages = []
        for content_file_id in content_file_ids:
            status_msg = self.summarize_single_content_file(
                content_file_id, overwrite=overwrite
            )
            status_messages.append(status_msg)
        return status_messages

    def summarize_single_content_file(
        self,
        content_file_id: int,
        overwrite,
    ) -> str:
        """Process a single content file
        Args:
            - content_file_id (int): Id of the content file to process
            - overwrite (bool): Whether to overwrite existing summary and flashcards

        Returns:
            - str: A string message indicating the status of the summarization
        """
        try:
            with transaction.atomic():
                # Generate summary and flashcards using platform specified LLM model
                content_file = ContentFile.objects.select_for_update().get(
                    id=content_file_id
                )
                # Process only if the content file passes the summarizer config filter
                updated = False
                if self._can_process_content_file(content_file):
                    llm_model = content_file.run.learning_resource.platform.summarizer_config.llm_model  # noqa: E501
                    if overwrite or not content_file.summary:
                        summary = self._generate_summary(
                            content_file.content, llm_model
                        )
                        content_file.summary = summary
                        updated = True
                    if overwrite or not content_file.flashcards:
                        flashcards = self._generate_flashcards(
                            content_file.content, llm_model
                        )
                        content_file.flashcards = flashcards
                        updated = True

                    if updated:
                        content_file.save()
                    return f"Summarization succeeded for CONTENT_FILE_ID: {content_file_id}"  # noqa: E501
                return f"Summarization skipped for CONTENT_FILE_ID: {content_file_id}"
        except SummaryGenerationError as exc:
            # Log and return a specific readable error message when summary
            # generation fails.
            logger.exception("Error processing content: %d", content_file.id)
            return f"Summary generation failed for CONTENT_FILE_ID: {content_file_id}\nError: {exc.args[0]}\n\n"  # noqa: E501
        except FlashcardsGenerationError as exc:
            # Log and return a specific readable error message when flashcards
            # generation fails.
            return f"Flashcards generation failed for CONTENT_FILE_ID: {content_file_id}\nError: {exc.args[0]}\n\n"  # noqa: E501
        except Exception as exc:
            # Log and return a specific readable error message when an  unknown
            # error occurs.
            logger.exception("Error processing content: %d", content_file.id)
            return (
                f"Summarization failed for CONTENT_FILE_ID: {content_file_id}\nError: {exc.args[0]}\n\n",  # noqa: E501
            )

    def _get_llm(self, model=None, temperature=0.0, max_tokens=1000) -> ChatLiteLLM:
        """Get the ChatLiteLLM instance"""

        if not model:
            raise ValueError("The 'model' parameter must be specified.")  # noqa: EM101, TRY003

        if not settings.OPENAI_API_KEY:
            raise ValueError("The 'OPENAI_API_KEY' setting must be set.")  # noqa: EM101, TRY003

        if not settings.LITELLM_CUSTOM_PROVIDER:
            raise ValueError("The 'LITELLM_CUSTOM_PROVIDER' setting must be set.")  # noqa: EM101, TRY003

        return ChatLiteLLM(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            custom_llm_provider=settings.LITELLM_CUSTOM_PROVIDER,
            api_base=settings.LITELLM_API_BASE,
        )

    def _generate_summary(self, content: str, llm_model: str) -> str:
        """Generate summary using provided llm_model
        Args:
            - content (str): Content to summarize
            - llm_model (str): LLM model to use for summarization
        Returns:
            - str: Generated summary
        """
        try:
            max_output_tokens = 1000
            max_input_tokens = get_max_tokens(llm_model)
            summarizer_message = truncate_to_tokens(
                f"Summarize the key points from this video. Transcript:{content}",
                max_input_tokens - max_output_tokens,
                llm_model,
            )
            llm = self._get_llm(
                model=llm_model, temperature=0.3, max_tokens=max_output_tokens
            )
            response = llm.invoke(summarizer_message)
            logger.debug("Generating Summary using model: %s", llm)
            generated_summary = response.content
            logger.debug("Generated summary: %s", generated_summary)

        except Exception as exc:
            # We do not want to raise the exception as is, we will log the exception and
            # raise SummaryGenerationError that will be used to make further decisions
            # in the code.
            logger.exception(
                "An error occurred while generating summary using model: %s", llm_model
            )
            raise SummaryGenerationError(exc) from exc

        else:
            return generated_summary

    def _generate_flashcards(
        self, content: str, llm_model: str
    ) -> list[dict[str, str]]:
        """Generate flashcards using provided llm_model.
        Args:
            - content (str): Content to generate flashcards from
            - llm_model (str): LLM model to use for generating flashcards
        Returns:
            - list[dict[str, str]]: List of flashcards
        """
        try:
            max_output_tokens = 2048
            max_input_tokens = get_max_tokens(llm_model)
            llm = self._get_llm(
                model=llm_model, temperature=1, max_tokens=max_output_tokens
            )
            logger.debug("Generating flashcards using model: %s", llm)
            structured_llm = llm.with_structured_output(FlashcardsResponse)

            flashcard_prompt = settings.CONTENT_SUMMARIZER_FLASHCARD_PROMPT.format(
                content=content
            )
            flashcard_prompt = truncate_to_tokens(
                flashcard_prompt,
                max_input_tokens - max_output_tokens,
                llm_model,
            )
            response = structured_llm.invoke(flashcard_prompt)
            if response:
                generated_flashcards = response.get("flashcards", [])
                logger.debug("Generated flashcards: %s", generated_flashcards)
            else:
                return []
        except Exception as exc:
            # We do not want to raise the exception as is, we will log the exception and
            # raise FlashcardsGenerationError that will be used to make further
            # decisions in the code.
            logger.exception(
                "An error occurred while generating flashcards using model: %s",
                llm_model,
            )
            raise FlashcardsGenerationError(exc) from exc
        else:
            return generated_flashcards
