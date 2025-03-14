import json
import logging
from typing import Optional

from django.db import transaction
from django.db.models import Q
from litellm import completion

from learning_resources.models import (
    ContentFile,
    ContentSummarizerConfiguration,
)

logger = logging.getLogger(__name__)


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
            response = completion(
                model=llm_model,
                messages=[
                    {
                        "content": """You are a helpful assistant that creates concise\
                                        summaries from transcript.

                        Your Job:
                            1. Provide a summary of the transcript and include the timestamps of the key points in
                            the transcript. Don't specify that the summary is generated from transcript.
                            2. The summary can be divided into multiple paragraphs each with its own heading in
                            bold and a clickable transcript timestamp link at the end.

                            """,  # noqa: E501
                        "role": "system",
                    },
                    {
                        "content": f"Please create a clear concise summary with multiple headings and paragraphs containing timestamps from the following transcript:\n\n{content}",  # noqa: E501
                        "role": "user",
                    },
                ],
                max_tokens=500,
                temperature=0.3,
            )
            generated_summary = response.choices[0].message.content
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
            response = completion(
                model=llm_model,
                messages=[
                    {
                        "content": """Create a set of flashcards in the form of JSON list.\

                            Your Job:
                            1. Provide the flashcards from the transcript in the form of question, answer and
                            explanation in order.
                            2. The (question, answer, explanation) values can contain markdown tags.
                            3. The explanation should have a clickable timestamp link from transcript at the end of explanation.


                            **IMPORTANT**:
                            - Only return **Valid JSON response**.
                            - Do not include backticks (` ``` `) or a `json` code block or backslashes in your response.
                            """,  # noqa: E501
                        "role": "system",
                    },
                    {
                        "content": f"Please generate flashcards containing timestamps from the following transcript:\n\n{content}",  # noqa: E501
                        "role": "user",
                    },
                ],
                max_tokens=1000,
                temperature=0.3,
            )
            generated_flashcards = json.loads(response.choices[0].message.content)
            logger.info("Generated flashcards: %s", generated_flashcards)

        except Exception:
            logger.exception(
                "An error occurred while generating flashcards using model: %s",
                llm_model,
            )
            raise
        else:
            return generated_flashcards
