import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from openai import OpenAI

from learning_resources.models import ContentFile, ContentSummarizerConfig

logger = logging.getLogger(__name__)


class ContentSummarizer:
    """
    A service class to summarize and generate flashcards for the ContentFile objects .
    """

    ai_client = None

    def __init__(self):
        """Initialize the ContentSummarizer class."""
        self.ai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def process_content(self) -> dict[str, int]:
        """Process all unprocessed content files."""
        stats = {"platform": "", "processed": 0, "failed": 0}
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
                Q(Q(summary__isnull=True) | Q(summary=""))
                | Q(Q(flashcards__isnull=True) | Q(flashcards=""))
                & Q(run__learning_resource__platform=summarizer_configuration.platform)
                & Q(
                    Q(content_type__in=summarizer_configuration.allowed_content_types)
                    | Q(file_extension__in=summarizer_configuration.allowed_extensions)
                )
            )
            logger.info("Processing (%d) content files", len(unprocessed_content))
            for content_file in unprocessed_content:
                try:
                    self._process_single_content_file(
                        content_file, summarizer_configuration.llm_model
                    )
                    stats["processed"] += 1
                except Exception:
                    stats["failed"] += 1
                    logger.exception("Failed to process content %s", content_file.id)

        return stats

    def _process_single_content_file(
        self, content_file: ContentFile, llm_model: str
    ) -> None:
        """Process a single content file."""
        try:
            with transaction.atomic():
                # Generate content using OpenAI
                update_dict = {}
                if not content_file.summary:
                    summary = self._generate_summary(content_file.content, llm_model)
                    update_dict["summary"] = summary
                if not content_file.flashcards:
                    flashcards = self._generate_flashcards(
                        content_file.content, llm_model
                    )
                    update_dict["flashcards"] = flashcards

                # Update content file
                ContentFile.objects.filter(
                    id=content_file.id
                ).select_for_update().update(**update_dict)

        except Exception:
            logger.exception("Error processing content: %d", content_file.id)
            raise

    def _generate_summary(self, content: str, llm_model: str) -> str:
        """Generate summary using OpenAI."""
        try:
            response = self.ai_client.chat.completions.create(
                model=llm_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that creates concise summaries.",  # noqa: E501
                    },
                    {
                        "role": "user",
                        "content": f"Please create a clear and concise summary of the following content:\n\n{content}",  # noqa: E501
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

    def _generate_flashcards(
        self, content: str, llm_model: str
    ) -> list[dict[str, str]]:
        """Generate flashcards using OpenAI."""
        try:
            response = self.ai_client.chat.completions.create(
                model=llm_model,
                messages=[
                    {
                        "role": "system",
                        "content": "Create a set of flashcards. Each flashcard should have a 'question', 'answer' and 'explanation' field.",  # noqa: E501
                    },
                    {
                        "role": "user",
                        "content": f"Generate flashcards from this content:\n\n{content}",  # noqa: E501
                    },
                ],
                max_tokens=500,
                temperature=0.7,
            )

            generated_flashcards = response.choices[0].message.content
            logger.info("Generated flashcards: %s", generated_flashcards)

        except Exception:
            logger.exception("An error occurred while generating flashcards.")
            raise
        else:
            return generated_flashcards
