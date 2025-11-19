"""Management command for translating SRT subtitle files"""
# ruff: noqa: E501, PTH112, PTH208, PERF401, PTH118, PTH110, PTH119, PTH103, PTH120, F841, C901, PLR

import os
import re
from pathlib import Path

from django.conf import settings
from django.core.management import BaseCommand

from learning_resources.translation.api import LANG_NAMES, translate_transcript


class Command(BaseCommand):
    """Translate SRT subtitle files to various languages using AI models"""

    help = (
        "Translate SRT subtitle files using OpenAI or DeepL with optional "
        "LLM evaluation"
    )

    def add_arguments(self, parser):
        """Configure arguments for this command"""
        parser.add_argument(
            "input_file",
            type=str,
            nargs="?",
            default=None,
            help="Path to input SRT file to translate",
        )
        parser.add_argument(
            "-d",
            "--directory",
            dest="input_directory",
            type=str,
            default=None,
            help=(
                "Path to directory containing SRT files to translate "
                "(all .srt files will be processed)"
            ),
        )
        parser.add_argument(
            "-l",
            "--language",
            dest="language_codes",
            action="append",
            required=True,
            choices=list(LANG_NAMES.keys()) + ["all"],  # noqa: RUF005
            help=(
                f"Target language code(s) to translate to. "
                f"Available: {', '.join(LANG_NAMES.keys())}. "
                f"Use 'all' to translate to all languages. "
                f"Can be specified multiple times."
            ),
        )
        parser.add_argument(
            "-m",
            "--model",
            dest="models",
            action="append",
            default=None,
            help=(
                "LLM model(s) to use (e.g., gpt-4o-mini, gpt-4o). "
                "If --api is specified, this model evaluates/improves the API "
                "translation (hybrid mode). "
                "If --api is NOT specified, this model is used for translation. "
                "Can be specified multiple times to test different models. "
                "Defaults to AI_TRANSLATION_MODEL setting if not specified."
            ),
        )
        parser.add_argument(
            "-e",
            "--effort",
            dest="effort",
            default="minimal",
            choices=["minimal", "medium", "high"],
            help=(
                "Reasoning effort level for o1/o3 models. "
                "Only works with reasoning models. "
                "Choices: minimal, medium, high"
            ),
        )
        parser.add_argument(
            "-c",
            "--chunk-size",
            dest="chunk_size",
            type=int,
            default=100,
            help=(
                "Number of subtitle cues per chunk for parallel processing "
                "(default: 100)"
            ),
        )
        parser.add_argument(
            "-o",
            "--output-dir",
            dest="output_dir",
            default=None,
            help=(
                "Output directory for translated files. "
                "If not specified, uses the input file's directory."
            ),
        )
        parser.add_argument(
            "--api",
            dest="api",
            default=None,
            choices=["openai", "deepl"],
            help=(
                "Translation API to use. Options: 'openai' (uses LLM for "
                "translation), 'deepl' (uses DeepL API). If not specified, uses "
                "--model for translation. If both --api and --model are specified, "
                "uses hybrid mode: "
                "--api for translation, --model for evaluation/improvement."
            ),
        )

    def handle(self, *args, **options):  # noqa: ARG002, PLR0912, PLR0915
        """Execute the translation command"""
        input_file = options["input_file"]
        input_directory = options["input_directory"]
        language_codes = options["language_codes"]
        models = options["models"] or [None]  # None uses default from settings
        effort = options["effort"]
        chunk_size = options["chunk_size"]
        output_dir = options["output_dir"]
        api = options["api"]

        # Validate that either input_file or input_directory is provided, but not both
        if not input_file and not input_directory:
            self.stdout.write(
                self.style.ERROR(
                    "❌ Error: You must specify either an input file or a directory (--directory)"
                )
            )
            return

        if input_file and input_directory:
            self.stdout.write(
                self.style.ERROR(
                    "❌ Error: You cannot specify both an input file and a directory. Choose one."
                )
            )
            return

        # Expand "all" to all available languages
        if "all" in language_codes:
            language_codes = list(LANG_NAMES.keys())

        # Collect files to process
        files_to_process = []

        if input_directory:
            # Validate directory exists
            if not os.path.isdir(input_directory):
                self.stdout.write(
                    self.style.ERROR(f"❌ Directory not found: {input_directory}")
                )
                return

            # Find all .srt files in the directory
            for filename in sorted(os.listdir(input_directory)):
                if filename.lower().endswith(".srt"):
                    files_to_process.append(os.path.join(input_directory, filename))

            if not files_to_process:
                self.stdout.write(
                    self.style.WARNING(
                        f"⚠️  No .srt files found in directory: {input_directory}"
                    )
                )
                return

            self.stdout.write(
                self.style.SUCCESS(
                    f"📁 Found {len(files_to_process)} .srt file(s) in {input_directory}"
                )
            )
        else:
            # Single file mode
            if not os.path.exists(input_file):
                self.stdout.write(
                    self.style.ERROR(f"❌ Input file not found: {input_file}")
                )
                return
            files_to_process.append(input_file)

        # Track overall progress
        total_files = len(files_to_process)
        total_translations_per_file = len(language_codes) * len(models)
        grand_total_translations = total_files * total_translations_per_file

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{'=' * 80}\n"
                f"🌍 TRANSLATION BATCH STARTED\n"
                f"   Files to process: {total_files}\n"
                f"   Languages: {', '.join([LANG_NAMES[lc] for lc in language_codes])}\n"
                f"   Models: {', '.join([m or 'default' for m in models])}\n"
                f"   Translations per file: {total_translations_per_file}\n"
                f"   Total translations: {grand_total_translations}\n"
                f"{'=' * 80}\n"
            )
        )

        # Process each file
        for file_index, current_input_file in enumerate(files_to_process, 1):
            self.stdout.write(
                self.style.WARNING(
                    f"\n📄 Processing file {file_index}/{total_files}: {os.path.basename(current_input_file)}"
                )
            )

            # Determine output directory for this file
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
                output_base_dir = output_dir
            else:
                output_base_dir = os.path.dirname(current_input_file)

            # Get base filename for output
            input_path = Path(current_input_file)
            base_name = input_path.stem  # filename without extension

            # Strip language code suffix if present (e.g., "-en", "-es")
            # Check for common language code patterns at the end
            lang_code_pattern = r"-[a-z]{2}$"

            if re.search(lang_code_pattern, base_name):
                output_base_name = re.sub(lang_code_pattern, "-output", base_name)
            elif "input" in base_name:
                # Replace "input" with "output" if present
                output_base_name = base_name.replace("input", "output")
            else:
                output_base_name = f"{base_name}-output"

            # Track translations for this file
            current = 0

            # Perform translations for each language and model combination
            for lang_code in language_codes:
                for model in models:
                    current += 1

                    # Generate output filename based on API and model parameters
                    # Patterns:
                    # - Both API and model: output-<api>-<model>-<lang>.srt
                    # - Only API: output-<api>-<lang>.srt
                    # - Only model: output-<model>-<lang>.srt
                    # - Neither: output-<default_model>-<lang>.srt

                    filename_parts = [output_base_name]

                    if api:
                        # Add API to filename
                        filename_parts.append(api)

                    if model:
                        # Add model to filename
                        model_slug = model.replace(":", "-").replace("/", "-")
                        filename_parts.append(model_slug)
                    elif not api:
                        # No API and no model specified - use default model

                        default_model = getattr(
                            settings, "AI_TRANSLATION_MODEL", "default"
                        )
                        model_slug = default_model.replace(":", "-").replace("/", "-")
                        filename_parts.append(model_slug)

                    # Add language code
                    filename_parts.append(lang_code)

                    output_filename = "-".join(filename_parts) + ".srt"

                    output_file = os.path.join(output_base_dir, output_filename)

                    # Build description of what's being used
                    method_desc_parts = []
                    if api and model:
                        method_desc_parts.append(f"API: {api}, Model: {model}")
                    elif api:
                        method_desc_parts.append(f"API: {api}")
                    elif model:
                        method_desc_parts.append(f"Model: {model}")

                    method_desc = (
                        f" ({method_desc_parts[0]})" if method_desc_parts else ""
                    )

                    self.stdout.write(
                        self.style.WARNING(
                            f"\n[File {file_index}/{total_files}][{current}/{total_translations_per_file}] "
                            f"Translating to {LANG_NAMES[lang_code]} ({lang_code}){method_desc}"
                        )
                    )
                    self.stdout.write(f"   Output: {output_file}\n")

                    try:
                        # Determine translation method based on --api and --model
                        skip_translation = False
                        existing_api_file = None

                        if api and model:
                            # Hybrid mode: check if API-only translation already exists
                            # Build the API-only filename
                            api_only_parts = [output_base_name, api, lang_code]
                            api_only_filename = "-".join(api_only_parts) + ".srt"
                            api_only_path = os.path.join(
                                output_base_dir, api_only_filename
                            )

                            if os.path.exists(api_only_path):
                                # API translation exists, reuse it for evaluation
                                skip_translation = True
                                existing_api_file = api_only_path
                                method = f"{api}|{model}"
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f"   ✓ Found existing {api} translation: {api_only_filename}"
                                    )
                                )
                                self.stdout.write(
                                    "   → Skipping re-translation, will evaluate and improve existing translation\n"
                                )
                            else:
                                # No existing file, do full hybrid translation
                                method = f"{api}|{model}"
                        elif api:
                            # Use specified API only
                            method = api
                        else:
                            # Default: use OpenAI LLM for translation
                            method = settings.AI_TRANSLATION_MODEL

                        # Perform translation
                        translate_transcript(
                            input_srt=current_input_file,
                            output_srt=output_file,
                            lang_code=lang_code,
                            chunk_size=chunk_size,
                            model=model,
                            effort=effort,
                            method=method,
                            existing_translation_file=existing_api_file,
                        )

                        self.stdout.write(
                            self.style.SUCCESS(
                                f"✅ [File {file_index}/{total_files}][{current}/{total_translations_per_file}] "
                                f"Successfully translated to {LANG_NAMES[lang_code]}{method_desc}"
                            )
                        )

                    except Exception as e:  # noqa: BLE001
                        self.stdout.write(
                            self.style.ERROR(
                                f"❌ [File {file_index}/{total_files}][{current}/{total_translations_per_file}] "
                                f"Translation failed for {LANG_NAMES[lang_code]}{method_desc}: {e!s}"
                            )
                        )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{'=' * 80}\n"
                f"✅ TRANSLATION BATCH COMPLETE\n"
                f"   Files processed: {total_files}\n"
                f"   Total translations: {grand_total_translations}\n"
                f"   Output directory: {output_dir if output_dir else 'Same as input file(s)'}\n"
                f"{'=' * 80}\n"
            )
        )
