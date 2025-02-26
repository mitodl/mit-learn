import logging

from django.db import transaction
from django.db.models import Q
from litellm import completion

from learning_resources.models import ContentFile, ContentSummarizerConfig

logger = logging.getLogger(__name__)


class ContentSummarizer:
    """
    A service class to summarize and generate flashcards for the ContentFile objects .
    """

    def process_content(self) -> dict[str, int]:
        """Process all unprocessed content files."""
        stats = {}
        # Process the content files based on these conditions
        # 1. Content is not empty
        # 2. Summary or flashcards are not generated
        # 3. Process the oldest content first
        # 4. Use a transaction to ensure atomicity
        # For future improvements, you can add more conditions or filters like:
        # - Content is not too long
        # - The type of the content files to process
        # - The type of the platfrom to process

        summarizer_configurations = ContentSummarizerConfig.objects.filter(
            is_active=True
        )

        for summarizer_configuration in summarizer_configurations:
            logger.info(
                "Processing the content files with Platform: %s, Content Types: %s, File Extensions: %s",  # noqa: E501
                summarizer_configuration.platform,
                summarizer_configuration.allowed_content_types,
                summarizer_configuration.allowed_extensions,
            )
            unprocessed_content = ContentFile.objects.exclude(
                Q(content__isnull=True) | Q(content="")
            ).filter(
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
            logger.info("Processing (%d) content files", len(unprocessed_content))
            processed = failed = 0
            for content_file in unprocessed_content:
                try:
                    self.process_single_content_file(
                        content_file, summarizer_configuration.llm_model
                    )
                    processed += 1
                except Exception:
                    failed += 1
                    logger.exception("Failed to process content %s", content_file.id)

            stats[summarizer_configuration.platform.code] = {
                "processed": processed,
                "failed": failed,
            }

        return stats

    def process_single_content_file(
        self, content_file: ContentFile, llm_model: str
    ) -> None:
        """Process a single content file."""
        try:
            with transaction.atomic():
                # Generate summary and flashcards using OpenAI
                update_dict = {}
                if not content_file.summary:
                    summary = self.generate_summary(content_file.content, llm_model)
                    update_dict["summary"] = summary
                if not content_file.flashcards or content_file.flashcards == {}:
                    flashcards = self.generate_flashcards(
                        content_file.content, llm_model
                    )
                    update_dict["flashcards"] = flashcards

                ContentFile.objects.filter(
                    id=content_file.id
                ).select_for_update().update(**update_dict)

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
                max_tokens=200,
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
                max_tokens=200,
                temperature=0.0,
            )

            generated_flashcards = response.choices[0].message.content
            logger.info("Generated flashcards: %s", generated_flashcards)

        except Exception:
            logger.exception("An error occurred while generating flashcards.")
            raise
        else:
            return generated_flashcards
