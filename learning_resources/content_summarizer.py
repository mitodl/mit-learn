import logging
from typing import Optional

from django.db import transaction
from django.db.models import Q
from litellm import completion

from learning_resources.models import ContentFile, ContentSummarizerConfig

logger = logging.getLogger(__name__)


class ContentSummarizer:
    """
    A service class to summarize and generate flashcards for the ContentFile objects .
    """

    def __init__(self, content_file_ids: Optional[list[int]] = None):
        self.content_file_ids = content_file_ids

    def get_unprocessed_content_file_ids(self) -> list[int]:
        """
        Get Ids of processable content files.
        If the Content summarizer was initialized with a list of content_file_ids,
        we will use that list. Otherwise, we will find the content files that need to
        be processed based on the following conditions:
        """
        if self.content_file_ids:
            return self.content_file_ids

        processable_content_file_ids = []
        summarizer_configurations = ContentSummarizerConfig.objects.filter(
            is_active=True
        )
        for summarizer_configuration in summarizer_configurations:
            unprocessed_content = (
                ContentFile.objects.exclude(Q(content__isnull=True) | Q(content=""))
                .filter(
                    Q(
                        Q(summary__isnull=True)
                        | Q(summary="")
                        | Q(flashcards__isnull=True)
                        | Q(flashcards={})
                    )
                    & Q(
                        run__learning_resource__platform=summarizer_configuration.platform
                    )
                    & (
                        Q(
                            content_type__in=summarizer_configuration.allowed_content_types
                        )
                        | Q(
                            file_extension__in=summarizer_configuration.allowed_extensions
                        )
                    )
                )
                .values_list("id", flat=True)
            )
            processable_content_file_ids.extend(unprocessed_content)
        return processable_content_file_ids

    def process_single_content_file(self, content_file_id: int, llm_model: str) -> None:
        """Process a single content file."""
        try:
            with transaction.atomic():
                # Generate summary and flashcards using provided LLM model
                content_file = ContentFile.objects.select_for_update().get(
                    id=content_file_id
                )

                if not content_file.summary:
                    summary = self.generate_summary(content_file.content, llm_model)
                    content_file.summary = summary
                if not content_file.flashcards or content_file.flashcards == {}:
                    flashcards = self.generate_flashcards(
                        content_file.content, llm_model
                    )
                    content_file.flashcards = flashcards
                content_file.save()

        except Exception:
            logger.exception("Error processing content: %d", content_file.id)
            raise

    def generate_summary(self, content: str, llm_model: str) -> str:
        """Generate summary using provided llm_model."""
        try:
            response = completion(
                model=llm_model,
                messages=[
                    {
                        "content": "You are a helpful assistant that creates concise summaries.",  # noqa: E501
                        "role": "system",
                    },
                    {
                        "content": f"Please create a clear and concise summary of the following content:\n\n{content}",  # noqa: E501
                        "role": "user",
                    },
                ],
                max_tokens=500,
                temperature=0.0,
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
                        "content": "Create a set of flashcards in the form of JSON list. Each flashcard JSON should have a 'question', 'answer' and 'explanation' field.",  # noqa: E501
                        "role": "system",
                    },
                    {
                        "content": f"Generate flashcards from this content:\n\n{content}",  # noqa: E501
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
