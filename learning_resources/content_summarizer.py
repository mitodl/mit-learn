import logging
from typing import Annotated, Optional

from django.db import transaction
from django.db.models import Q
from langchain_community.chat_models import ChatLiteLLM
from typing_extensions import TypedDict

from learning_resources.models import (
    ContentFile,
    ContentSummarizerConfiguration,
)

logger = logging.getLogger(__name__)


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

        summarizer_config = getattr(
            content_file.run.learning_resource.platform, "summarizer_config", None
        )

        if not summarizer_config or not summarizer_config.is_active:
            return False

        return (
            content_file.content_type in summarizer_config.allowed_content_types
            or content_file.file_extension in summarizer_config.allowed_extensions
        )

    def get_unprocessed_content_file_ids(
        self,
        overwrite,
        learning_resource_ids: Optional[list[int]] = None,
        content_file_ids: Optional[list[int]] = None,
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
    ) -> None:
        """Process multiple content files by id.

        Args:
            - ids (list[int]): List of content file ids to process
            - overwrite (bool): Whether to overwrite existing summary and flashcards

        Returns:
            - None
        """
        for content_file_id in content_file_ids:
            self.summarize_single_content_file(content_file_id, overwrite=overwrite)

    def summarize_single_content_file(
        self,
        content_file_id: int,
        overwrite,
    ) -> None:
        """Process a single content file
        Args:
            - content_file_id (int): Id of the content file to process
            - overwrite (bool): Whether to overwrite existing summary and flashcards

        Returns:
            - None
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

        except Exception:
            logger.exception("Error processing content: %d", content_file.id)
            raise

    def _generate_summary(self, content: str, llm_model: str) -> str:
        """Generate summary using provided llm_model
        Args:
            - content (str): Content to summarize
            - llm_model (str): LLM model to use for summarization
        Returns:
            - str: Generated summary
        """
        try:
            llm = ChatLiteLLM(model=llm_model, temperature=0.3, max_tokens=1000)
            response = llm.invoke(
                f"Summarize the key points from this video transcript. Transcript:{content}"  # noqa: E501
            )
            generated_summary = response.content
            logger.info("Generated summary: %s", generated_summary)

        except Exception:
            logger.exception(
                "An error occurred while generating summary using model: %s", llm_model
            )
            raise
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
            llm = ChatLiteLLM(model=llm_model, temperature=0.3, max_tokens=1000)
            structured_llm = llm.with_structured_output(FlashcardsResponse)
            response = structured_llm.invoke(
                f"Generate flashcards from the following transcript. Each flashcard should have a question and answer. Transcript:{content}"  # noqa: E501
            )
            generated_flashcards = response.get("flashcards")
            logger.info("Generated flashcards: %s", generated_flashcards)

        except Exception:
            logger.exception(
                "An error occurred while generating flashcards using model: %s",
                llm_model,
            )
            raise
        else:
            return generated_flashcards
