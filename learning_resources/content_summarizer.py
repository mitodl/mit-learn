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
    A service class to summarize and generate flashcards for the ContentFile objects .
    """

    def get_filter(self, summarizer_configuration):
        return (
            Q(
                Q(summary__isnull=True)
                | Q(summary="")
                | Q(flashcards__isnull=True)
                | Q(flashcards={})
            )
            & Q(run__learning_resource__platform=summarizer_configuration.platform)
            & (
                Q(content_type__in=summarizer_configuration.allowed_content_types)
                | Q(file_extension__in=summarizer_configuration.allowed_extensions)
            )
        )

    def can_process_content_file(self, content_file: ContentFile):
        """Check if a content file can be processed"""

        if not content_file.content:
            # No content available for summarizer
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
        self, overwrite, learning_resource_ids: Optional[list[int]] = None
    ) -> list[int]:
        """
        Get Ids of processable content files.
        If the Content summarizer was initialized with a list of content_file_ids,
        we will use that list. Otherwise, we will find the content files that need to
        be processed based on the following conditions:
        """
        summarizer_configurations = ContentSummarizerConfiguration.objects.filter(
            is_active=True
        )
        for summarizer_configuration in summarizer_configurations:
            unprocessed_content = ContentFile.objects.exclude(
                Q(content__isnull=True) | Q(content="")
            )
            if not overwrite:
                unprocessed_content = unprocessed_content.filter(
                    Q(
                        Q(summary__isnull=True)
                        | Q(summary="")
                        | Q(flashcards__isnull=True)
                        | Q(flashcards={})
                    )
                )

            unprocessed_content.filter(
                Q(run__learning_resource__platform=summarizer_configuration.platform)
                & (
                    Q(content_type__in=summarizer_configuration.allowed_content_types)
                    | Q(file_extension__in=summarizer_configuration.allowed_extensions)
                )
            )

            if learning_resource_ids:
                unprocessed_content = unprocessed_content.filter(
                    run__learning_resource__id__in=learning_resource_ids
                )

            unprocessed_content_file_ids = list(
                unprocessed_content.values_list("id", flat=True)
            )

        return unprocessed_content_file_ids

    def process_content_files_by_ids(self, overwrite, ids: list[int]) -> None:
        """Process multiple content files by id"""
        for content_file_id in ids:
            self.process_single_content_file(content_file_id, overwrite)

    def process_single_content_file(self, content_file_id: int, overwrite) -> None:
        """Process a single content file"""
        try:
            with transaction.atomic():
                # Generate summary and flashcards using platform specified LLM model
                content_file = ContentFile.objects.select_for_update().get(
                    id=content_file_id
                )
                if self.can_process_content_file(content_file):
                    llm_model = content_file.run.learning_resource.platform.summarizer_config.llm_model  # noqa: E501
                    if overwrite or not content_file.summary:
                        summary = self.generate_summary(content_file.content, llm_model)
                        content_file.summary = summary
                    if overwrite or not content_file.flashcards:
                        flashcards = self.generate_flashcards(
                            content_file.content, llm_model
                        )
                        content_file.flashcards = flashcards
                    content_file.save()

        except Exception:
            logger.exception("Error processing content: %d", content_file.id)
            raise

    def generate_summary(self, content: str, llm_model: str) -> str:
        """Generate summary using provided llm_model"""
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
                temperature=0.5,
            )
            generated_summary = response.choices[0].message.content
            logger.info("Generated summary: %s", generated_summary)

        except Exception:
            logger.exception("An error occurred while generating summary.")
            raise
        else:
            return generated_summary

    def generate_flashcards(self, content: str, llm_model: str) -> list[dict[str, str]]:
        """Generate flashcards using OpenAI."""
        try:
            response = completion(
                model=llm_model,
                messages=[
                    {
                        "content": """Create a set of flashcards in the form of JSON list.\

                            Your Job:
                            1. Provide the flashcards from the transcript in the form of question, answer and
                            explanation.
                            2. The explanation should have a clickable timestamp link from transcript at the end of explanation.


                            **IMPORTANT**:
                            - Do not include backticks (` ``` `) or a `json` code block in your response.
                            - Only return **valid JSON**.
                            """,  # noqa: E501
                        "role": "system",
                    },
                    {
                        "content": f"Please generate flashcards containing timestamps from the following transcript:\n\n{content}",  # noqa: E501
                        "role": "user",
                    },
                ],
                max_tokens=500,
                temperature=0.5,
            )
            generated_flashcards = response.choices[0].message.content
            logger.info("Generated flashcards: %s", generated_flashcards)

        except Exception:
            logger.exception("An error occurred while generating flashcards.")
            raise
        else:
            return generated_flashcards
