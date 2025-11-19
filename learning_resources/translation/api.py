"""Functions for AI based translation"""
# ruff: noqa: E501, PTH123, PTH103, PTH120, PTH118, PTH110, PLR0913, PLR0912, PLR0915, PLR2004, RUF013, BLE001, TRY003, EM101, EM102, TRY400, C901, F841

import asyncio
import logging
import os
import re
import time

import deepl
import srt
from django.conf import settings
from openai import AsyncOpenAI

log = logging.getLogger(__name__)


LANG_NAMES = {
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "pt": "Portuguese",
    "hi": "Hindi",
    "ar": "Arabic",
    "zh": "Chinese",
    "kr": "Korean",
    "ja": "Japanese",
    "id": "Indonesian",
    "ru": "Russian",
    "uk": "Ukrainian",
    "el": "Greek",
}

# Map our language codes to DeepL language codes
DEEPL_LANG_MAP = {
    "fr": "FR",
    "de": "DE",
    "es": "ES",
    "pt": "PT-PT",
    # Note: Hindi (hi) is not supported by DeepL
    "ar": "AR",
    "zh": "ZH",
    "kr": "KO",
    "ja": "JA",
    "id": "ID",
    "ru": "RU",
    "uk": "UK",
    "el": "EL",
}

# ------------------ I/O helpers ------------------
# Basic text file read/write utilities


def read_text(path: str) -> str:
    with open(path, encoding="utf-8-sig") as f:
        return f.read().strip()


def write_text(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


# ------------------ SRT helpers ------------------
# Utilities for parsing and rebuilding SRT subtitle files


def parse_srt(srt_text: str) -> list[dict[str, str]]:
    """Parse SRT text into a list of cue dictionaries using srt library.

    Returns list of dicts containing:
        - 'number': cue index (string)
        - 'timestamp': timestamp line (e.g., "00:00:00,000 --> 00:00:02,000")
        - 'text': cue text (possibly multiline)
    """
    subtitles = list(srt.parse(srt_text))
    blocks = []
    for sub in subtitles:
        # Convert srt.Subtitle object to dict format for backward compatibility
        timestamp = f"{srt.timedelta_to_srt_timestamp(sub.start)} --> {srt.timedelta_to_srt_timestamp(sub.end)}"
        blocks.append(
            {
                "number": str(sub.index),
                "timestamp": timestamp,
                "text": sub.content.strip(),
            }
        )
    return blocks


def rebuild_srt(blocks: list[dict[str, str]], per_num_text: dict[str, str]) -> str:
    """Rebuild a complete SRT string using srt library.

    Args:
        blocks: parsed from the original file (each with 'number' and 'timestamp')
        per_num_text: {number -> translated text} mapping

    Restores timestamps from the original blocks automatically.
    """
    subtitles = []
    for b in blocks:
        num = b["number"]
        # Parse timestamp back to start/end timedelta objects
        timestamp_parts = b["timestamp"].split(" --> ")
        start = srt.srt_timestamp_to_timedelta(timestamp_parts[0])
        end = srt.srt_timestamp_to_timedelta(
            timestamp_parts[1].split()[0]
        )  # Remove any trailing flags

        txt = per_num_text.get(num, "").strip()

        subtitles.append(
            srt.Subtitle(index=int(num), start=start, end=end, content=txt)
        )

    return srt.compose(subtitles)


# ------------------ Few-shot examples (NOT FOR HINDI) ------------------
FEW_SHOT_DIR = "few_shot_examples"
_SECTION_RE = re.compile(r"^###\s*([A-Z][A-Z0-9 \-\(\)]*)\s*$", flags=re.M | re.I)


def load_few_shot_sections(
    lang_code: str, base_dir: str = FEW_SHOT_DIR
) -> dict[str, str]:
    """
    Load few_shot_examples/<lang>_examples.txt
    Returns keys like: 'source', 'unformatted', 'expected' (case-insensitive).
    """
    path = os.path.join(base_dir, f"{lang_code}_examples.txt")
    if not os.path.exists(path):
        return {}

    with open(path, encoding="utf-8-sig") as f:
        text = f.read()

    matches: list[re.Match[str]] = list(_SECTION_RE.finditer(text))
    if not matches:
        return {"raw": text.strip()}

    sections: dict[str, str] = {}
    for i, m in enumerate(matches):
        hdr = m.group(1).strip().lower()
        key = (
            "source"
            if "source" in hdr
            else "unformatted"
            if "unformatted" in hdr
            else "expected"
            if "expected" in hdr
            else hdr.replace(" ", "_")
        )
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections[key] = text[start:end].strip()

    return sections


def provider_uses_few_shot(lang_code: str) -> bool:
    # Skip few-shot if you're using Sarvam (Hindi path)
    return lang_code != "hi"


async def translate_with_structure_preserved(
    srt_blocks: list[dict[str, str]],
    lang_code: str,
    client: AsyncOpenAI,
    chunk_id: str = "",
    model: str | None = None,
    effort: str | None = None,
) -> dict[str, str]:
    """Single-pass translation that maintains cue structure.

    Args:
        srt_blocks: List of parsed SRT blocks with 'number' and 'text' keys
        lang_code: Target language code (e.g., 'fr', 'es', 'de')
        client: AsyncOpenAI client instance
        chunk_id: Optional identifier for logging (e.g., "Chunk 1/3")
        model: LLM model to use (defaults to settings.AI_TRANSLATION_MODEL)

    Returns:
        Dictionary mapping cue numbers to translated text
    """
    if model is None:
        model = settings.AI_TRANSLATION_MODEL

    prefix = f"[{chunk_id}] " if chunk_id else ""
    step_start = time.time()
    lang_name = LANG_NAMES.get(lang_code, lang_code.capitalize())

    # Format input as numbered cues
    log.info("%s⏱️  [Step 1/6] Formatting input cues...", prefix)
    formatted_input = "\n\n".join(
        [f"### {b['number']}\n{b['text']}" for b in srt_blocks]
    )
    log.info("%s✓ Formatting complete (%.2fs)", prefix, time.time() - step_start)

    # System prompt for single-pass translation
    step_start = time.time()
    log.info("%s⏱️  [Step 2/6] Building system prompt...", prefix)
    system_prompt = (
        f"You are a professional English→{lang_name} translator for subtitle cues.\n\n"
        "# TASK:\n"
        f"Translate each numbered cue (### N) from English to {lang_name} while:\n"
        "- Maintaining full context awareness across all cues for consistent terminology\n"
        f"- Using natural, idiomatic {lang_name} phrasing\n"
        "- Preserving every word, phrase, and nuance from the English\n"
        "- Keeping the exact ### N numbering structure\n"
        "- Translating each cue independently but with awareness of the full context\n\n"
        "# STRICT RULES:\n"
        "1) Return PLAIN TEXT ONLY (no markdown formatting, no code blocks)\n"
        "2) Do NOT add, omit, summarize, or simplify content\n"
        "3) Keep line-by-line alignment with English source\n"
        "4) Keep units, numbers, and named entities faithful\n"
        f"5) Use established {lang_name} terminology for technical/academic expressions\n"
        "6) Keep mathematical expressions in spoken form as they appear\n"
        "7) Each cue should start with ### followed by its number\n"
        "8) CRITICAL: Do NOT merge or combine multiple cues together\n"
        "9) CRITICAL: Every input cue number MUST appear in the output with its own translation\n"
        "10) CRITICAL: Even if a sentence is split across multiple cues, translate each cue fragment separately\n\n"
        "# OUTPUT FORMAT:\n"
        "Return the same ### N structure with translated text for each cue.\n"
        "You MUST return the exact same number of cues as the input."
    )

    user_prompt = f"Translate to {lang_name}:\n\n{formatted_input}"
    log.info("%s✓ Prompt building complete (%.2fs)", prefix, time.time() - step_start)

    # Add few-shot examples if applicable
    step_start = time.time()
    log.info("%s⏱️  [Step 3/6] Loading few-shot examples (if applicable)...", prefix)
    few_shot_msgs = []
    if provider_uses_few_shot(lang_code):
        fs_en = load_few_shot_sections("en")
        fs_source = fs_en.get("source") or fs_en.get("raw")

        fs = load_few_shot_sections(lang_code)
        fs_expected = fs.get("expected")

        if fs_source and fs_expected:
            few_shot_msgs = [
                {
                    "role": "user",
                    "content": f"Translate to {lang_name}:\n\n{fs_source}",
                },
                {"role": "assistant", "content": fs_expected},
            ]
            log.info(
                "%s✓ Few-shot examples loaded (%.2fs)", prefix, time.time() - step_start
            )
        else:
            log.info(
                "%s✓ No few-shot examples found (%.2fs)",
                prefix,
                time.time() - step_start,
            )
    else:
        log.info(
            "%s✓ Skipping few-shot for %s (%.2fs)",
            prefix,
            lang_code,
            time.time() - step_start,
        )

    # Build messages
    step_start = time.time()
    log.info("%s⏱️  [Step 4/6] Building message payload...", prefix)
    messages = [
        {"role": "system", "content": system_prompt},
        *few_shot_msgs,
        {"role": "user", "content": user_prompt},
    ]

    total_tokens_estimate = sum(len(m["content"]) for m in messages) // 4
    log.info(
        "%s✓ Message payload ready (%.2fs, ~%d tokens)",
        prefix,
        time.time() - step_start,
        total_tokens_estimate,
    )

    # Async LLM call
    step_start = time.time()
    log.info("%s⏱️  [Step 5/6] 🚀 CALLING LLM API (model: %s)...", prefix, model)
    log.info("%s   Translating %d cues...", prefix, len(srt_blocks))

    # Build API call parameters
    api_params = {
        "model": model,
        "messages": messages,
    }

    # Add reasoning_effort only if specified (only works with reasoning models like o1/o3)
    if model == "gpt-5":
        if effort:
            api_params["reasoning_effort"] = effort
        elif (
            hasattr(settings, "AI_TRANSLATION_EFFORT")
            and settings.AI_TRANSLATION_EFFORT
        ):
            api_params["reasoning_effort"] = settings.AI_TRANSLATION_EFFORT

    response = await client.chat.completions.create(**api_params)

    api_elapsed = time.time() - step_start
    log.info("%s✓ LLM API call complete (%.2fs) ⚡", prefix, api_elapsed)

    content = response.choices[0].message.content.strip()

    # Parse response
    step_start = time.time()
    log.info("%s⏱️  [Step 6/6] Parsing response...", prefix)

    # Parse back into cue mapping
    parts = re.split(r"^###\s*(\d+)\s*$", content, flags=re.MULTILINE)
    per_num_text: dict[str, str] = {}
    for i in range(1, len(parts), 2):
        num = parts[i].strip()
        body = parts[i + 1].lstrip() if i + 1 < len(parts) else ""
        lines = body.splitlines()
        txt = "\n".join(lines).strip()
        per_num_text[num] = txt

    # Ensure every cue exists
    for b in srt_blocks:
        per_num_text.setdefault(b["number"], "")

    log.info("%s✓ Response parsing complete (%.2fs)", prefix, time.time() - step_start)
    log.info("%s📊 Mapped %d cues successfully", prefix, len(per_num_text))

    # Validate that we got all expected cues
    expected_cues = {b["number"] for b in srt_blocks}
    returned_cues = set(per_num_text.keys())
    missing_cues = expected_cues - returned_cues
    extra_cues = returned_cues - expected_cues

    if missing_cues or extra_cues:
        log.warning("%s⚠️  CUE MISMATCH DETECTED:", prefix)
        if missing_cues:
            log.warning("%s   Missing cues: %s", prefix, sorted(missing_cues, key=int))
        if extra_cues:
            log.warning("%s   Extra cues: %s", prefix, sorted(extra_cues, key=int))
        log.warning(
            "%s   Expected %d cues, got %d cues",
            prefix,
            len(expected_cues),
            len(returned_cues),
        )
        log.warning("%s   This may cause timestamp misalignment!", prefix)

    return per_num_text


def translate_with_deepl(
    srt_blocks: list[dict[str, str]],
    lang_code: str,
    chunk_id: str = "",
) -> dict[str, str]:
    """Translate SRT blocks using DeepL API.

    Args:
        srt_blocks: List of parsed SRT blocks with 'number' and 'text' keys
        lang_code: Target language code (e.g., 'fr', 'es', 'de')
        chunk_id: Optional identifier for logging (e.g., "Chunk 1/3")

    Returns:
        Dictionary mapping cue numbers to translated text
    """
    if not settings.DEEPL_API_KEY:
        raise RuntimeError("DEEPL_API_KEY setting is required for DeepL translation")

    prefix = f"[{chunk_id}] " if chunk_id else ""
    overall_start = time.time()
    lang_name = LANG_NAMES.get(lang_code, lang_code.capitalize())

    log.info("%s🌍 Starting DeepL translation to %s...", prefix, lang_name)

    deepl_target = DEEPL_LANG_MAP.get(lang_code)
    if not deepl_target:
        raise ValueError(f"Language code '{lang_code}' not supported by DeepL")

    translator = deepl.Translator(settings.DEEPL_API_KEY)
    per_num_text: dict[str, str] = {}

    # Log DeepL usage info
    try:
        usage = translator.get_usage()
        if usage.character.limit_exceeded:
            log.warning("%sDeepL character limit exceeded!", prefix)
        else:
            remaining = (
                usage.character.limit - usage.character.count
                if usage.character.limit
                else "unlimited"
            )
            log.info(
                "%sDeepL usage: %d characters used, %s remaining",
                prefix,
                usage.character.count,
                remaining,
            )
    except Exception as e:
        log.warning("%sCould not fetch DeepL usage info: %s", prefix, e)

    # Translate each cue individually to maintain structure
    # Rate limiting: ensure at least 1 second between requests
    last_request_time = 0.0
    min_interval = 0.33  # Minimum seconds between requests

    for i, block in enumerate(srt_blocks, 1):
        num = block["number"]
        text = block["text"]

        if not text.strip():
            per_num_text[num] = ""
            continue

        try:
            # Rate limiting: wait if needed to maintain 1 req/second
            elapsed_since_last = time.time() - last_request_time
            if elapsed_since_last < min_interval:
                sleep_time = min_interval - elapsed_since_last
                time.sleep(sleep_time)

            # Make the API request
            request_start = time.time()
            result = translator.translate_text(
                text,
                target_lang=deepl_target,
            )
            per_num_text[num] = result.text
            last_request_time = time.time()

            if i % 10 == 0:
                log.info("%s   Translated %d/%d cues...", prefix, i, len(srt_blocks))

        except Exception as e:
            log.error("%s   Error translating cue %s: %s", prefix, num, e)
            per_num_text[num] = text  # Fall back to original text
            last_request_time = time.time()  # Update time even on error

    elapsed = time.time() - overall_start
    log.info(
        "%s✓ DeepL translation complete (%.2fs, %d cues)",
        prefix,
        elapsed,
        len(srt_blocks),
    )

    return per_num_text


async def evaluate_translation_with_llm(
    original_blocks: list[dict[str, str]],
    translated_mapping: dict[str, str],
    lang_code: str,
    model: str,
    chunk_id: str = "",
) -> dict[str, dict[str, any]]:
    """Evaluate translation quality using an LLM.

    Args:
        original_blocks: List of original SRT blocks with 'number' and 'text' keys
        translated_mapping: Dictionary mapping cue numbers to translated text
        lang_code: Target language code
        model: LLM model to use for evaluation
        chunk_id: Optional identifier for logging

    Returns:
        Dictionary mapping cue numbers to evaluation results with 'score', 'feedback', and 'text' keys
    """
    prefix = f"[{chunk_id}] " if chunk_id else ""
    lang_name = LANG_NAMES.get(lang_code, lang_code.capitalize())

    log.info("%s🔍 Starting LLM evaluation with %s...", prefix, model)
    start_time = time.time()

    # Build evaluation prompt
    system_prompt = (
        f"You are an expert translation evaluator for English→{lang_name} translations.\n\n"
        "# TASK:\n"
        "Evaluate each translated subtitle cue for:\n"
        "1. Accuracy - Does it preserve the original meaning?\n"
        "2. Fluency - Is it natural and idiomatic?\n"
        "3. Completeness - Are all details preserved?\n\n"
        "# OUTPUT FORMAT:\n"
        "For each cue, provide:\n"
        "- A quality score (1-10)\n"
        "- Brief feedback on any issues\n"
        "- Optionally, an improved translation if the original has significant issues\n\n"
        "Return results in this format:\n"
        "### N\n"
        "SCORE: X/10\n"
        "FEEDBACK: [your feedback]\n"
        "IMPROVED: [optional improved translation]\n"
    )

    # Format cues for evaluation
    eval_input = []
    for block in original_blocks:
        num = block["number"]
        original = block["text"]
        translated = translated_mapping.get(num, "")
        eval_input.append(f"### {num}\nORIGINAL: {original}\nTRANSLATED: {translated}")

    user_prompt = f"Evaluate these {lang_name} translations:\n\n" + "\n\n".join(
        eval_input
    )

    async with AsyncOpenAI(api_key=settings.OPENAI_API_KEY) as async_client:
        response = await async_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

    content = response.choices[0].message.content.strip()

    # Parse evaluation results
    results: dict[str, dict[str, any]] = {}
    cue_pattern = re.compile(
        r"###\s*(\d+)\s*\n"
        r"SCORE:\s*(\d+)/10\s*\n"
        r"FEEDBACK:\s*([^\n]+)\s*\n"
        r"(?:IMPROVED:\s*([^\n]+(?:\n(?!###)[^\n]+)*))?",
        re.MULTILINE,
    )

    for match in cue_pattern.finditer(content):
        num = match.group(1)
        score = int(match.group(2))
        feedback = match.group(3).strip()
        improved = match.group(4).strip() if match.group(4) else None

        results[num] = {
            "score": score,
            "feedback": feedback,
            "text": improved
            if improved and score < 7
            else translated_mapping.get(num, ""),
        }

    # Fill in any missing cues with default values
    for block in original_blocks:
        num = block["number"]
        if num not in results:
            results[num] = {
                "score": 5,
                "feedback": "No evaluation available",
                "text": translated_mapping.get(num, ""),
            }

    elapsed = time.time() - start_time
    avg_score = (
        sum(r["score"] for r in results.values()) / len(results) if results else 0
    )
    log.info(
        "%s✓ LLM evaluation complete (%.2fs, avg score: %.1f/10)",
        prefix,
        elapsed,
        avg_score,
    )

    return results


def translate_transcript(
    input_srt: str,
    output_srt: str,
    lang_code: str,
    chunk_size: int = 100,
    model: str | None = None,
    effort: str = None,
    method: str = "openai",
    existing_translation_file: str | None = None,
) -> str:
    """Translate an SRT subtitle file using parallel translation with automatic chunking.

    For large files (>100 cues), automatically chunks the translation and processes
    all chunks in parallel for maximum speed while preserving context quality.

    Args:
        input_srt: Path to input SRT file
        output_srt: Path to output translated SRT file
        lang_code: Target language code (e.g., 'fr', 'es', 'de')
        chunk_size: Max cues per API call (default: 100). Smaller = faster parallel processing.
        model: LLM model to use (defaults to settings.AI_TRANSLATION_MODEL)
        effort: Reasoning effort for o1/o3 models
        method: Translation method. Can be:
                - "openai" - Use OpenAI for translation (default)
                - "deepl" - Use DeepL for translation
                - "deepl|gpt-4o" - Hybrid: DeepL translation + GPT-4o evaluation
        existing_translation_file: Path to existing translation file (for reusing API translations)

    Returns:
        Path to the output SRT file
    """
    if model is None:
        model = settings.AI_TRANSLATION_MODEL

    # Parse method for hybrid approach
    is_hybrid = "|" in method
    if is_hybrid:
        translation_method, eval_model = method.split("|", 1)
        translation_method = translation_method.strip()
        eval_model = eval_model.strip()
    else:
        translation_method = method
        eval_model = None

    overall_start = time.time()
    log.info("=" * 80)
    log.info("🌍 TRANSLATION JOB STARTED")
    log.info("   Input: %s", input_srt)
    log.info("   Output: %s", output_srt)
    log.info("   Language: %s (%s)", lang_code, LANG_NAMES.get(lang_code, lang_code))
    log.info("   Method: %s", translation_method)
    if is_hybrid:
        log.info("   Evaluation model: %s", eval_model)
    if translation_method == "openai":
        log.info("   Effort level: %s", effort or "default")
        log.info("   Model: %s", model)
    log.info("=" * 80)

    # Parse input SRT file using srt library
    step_start = time.time()
    log.info("📖 [PHASE 1/4] Reading and parsing input SRT file...")
    srt_text = read_text(input_srt)
    log.info("   File size: %d characters", len(srt_text))

    srt_blocks = parse_srt(srt_text)
    if not srt_blocks:
        raise RuntimeError("No SRT blocks parsed from input file")

    log.info(
        "✓ Parsing complete: %d subtitle cues found (%.2fs)",
        len(srt_blocks),
        time.time() - step_start,
    )

    # Prepare blocks for translation (without timestamps)
    step_start = time.time()
    log.info("🔧 [PHASE 2/4] Preparing blocks for translation...")
    blocks_no_ts = [{"number": b["number"], "text": b["text"]} for b in srt_blocks]

    # Determine if chunking is needed
    num_cues = len(blocks_no_ts)
    needs_chunking = num_cues > chunk_size

    if needs_chunking:
        num_chunks = (num_cues + chunk_size - 1) // chunk_size
        log.info(
            "⚠️  Large file detected: %d cues will be split into %d chunks of ~%d cues",
            num_cues,
            num_chunks,
            chunk_size,
        )
        log.info("   This preserves speed while maintaining context quality.")
    else:
        log.info(
            "   Single-pass translation (file has %d cues, under %d threshold)",
            num_cues,
            chunk_size,
        )

    log.info("✓ Preparation complete (%.2fs)", time.time() - step_start)

    # Check if we can reuse existing translation
    per_num_text = None
    if existing_translation_file and is_hybrid:
        step_start = time.time()
        log.info(
            "📖 [PHASE 3/5] Loading existing %s translation...", translation_method
        )
        log.info("   Reading from: %s", existing_translation_file)

        # Parse the existing translated SRT file
        existing_srt_text = read_text(existing_translation_file)
        existing_blocks = parse_srt(existing_srt_text)

        # Extract translations into per_num_text mapping
        per_num_text = {}
        for block in existing_blocks:
            per_num_text[block["number"]] = block["text"]

        log.info(
            "✓ Loaded %d translations from existing file (%.2fs)",
            len(per_num_text),
            time.time() - step_start,
        )
        log.info("-" * 80)

    # Translation with automatic chunking (skip if we loaded existing)
    if per_num_text is None:
        step_start = time.time()
        phase_label = "[PHASE 3/5]" if is_hybrid else "[PHASE 3/4]"
        log.info(
            "🤖 %s TRANSLATION %s",
            phase_label,
            f"({num_chunks} CHUNKS IN PARALLEL)" if needs_chunking else "(SINGLE PASS)",
        )
        log.info("-" * 80)

        # Choose translation method
        if translation_method == "deepl":
            # DeepL translation (non-async, processes sequentially)
            if needs_chunking:
                log.info(
                    "   🔄 Processing %d chunks sequentially with DeepL...", num_chunks
                )
                per_num_text = {}
                for chunk_idx in range(num_chunks):
                    chunk_start_idx = chunk_idx * chunk_size
                    chunk_end_idx = min((chunk_idx + 1) * chunk_size, num_cues)
                    chunk_blocks = blocks_no_ts[chunk_start_idx:chunk_end_idx]
                    chunk_id = f"Chunk {chunk_idx + 1}/{num_chunks}"

                    chunk_result = translate_with_deepl(
                        chunk_blocks, lang_code, chunk_id
                    )
                    per_num_text.update(chunk_result)
            else:
                per_num_text = translate_with_deepl(blocks_no_ts, lang_code, "")
        # OpenAI translation (async, parallel processing)
        elif needs_chunking:
            log.info(
                "   🚀 Running %d chunks in parallel for maximum speed...",
                num_chunks,
            )
            log.info("   Each chunk will translate independently and simultaneously")
            log.info("-" * 80)

            # Parallel chunked translation using async
            async def translate_all_chunks():
                async with AsyncOpenAI(api_key=settings.OPENAI_API_KEY) as async_client:
                    # Create all chunk tasks
                    tasks = []
                    for chunk_idx in range(num_chunks):
                        chunk_start_idx = chunk_idx * chunk_size
                        chunk_end_idx = min((chunk_idx + 1) * chunk_size, num_cues)
                        chunk_blocks = blocks_no_ts[chunk_start_idx:chunk_end_idx]

                        chunk_id = f"Chunk {chunk_idx + 1}/{num_chunks}"
                        log.info(
                            "   📦 %s: Preparing cues %d-%d (%d cues)",
                            chunk_id,
                            chunk_start_idx + 1,
                            chunk_end_idx,
                            len(chunk_blocks),
                        )

                        task = translate_with_structure_preserved(
                            chunk_blocks,
                            lang_code,
                            async_client,
                            chunk_id,
                            model,
                            effort,
                        )
                        tasks.append(task)

                    log.info("-" * 80)
                    log.info("   ⚡ Launching %d parallel API calls...", num_chunks)

                    # Run all chunks in parallel
                    results = await asyncio.gather(*tasks)

                    # Merge results
                    merged = {}
                    for result in results:
                        merged.update(result)

                    return merged

            # Run the async function
            per_num_text = asyncio.run(translate_all_chunks())
            log.info("-" * 80)
            log.info("   ✅ All %d chunks completed in parallel!", num_chunks)
        else:
            # Single-pass for small files (also async for consistency)
            async def translate_single():
                async with AsyncOpenAI(api_key=settings.OPENAI_API_KEY) as async_client:
                    return await translate_with_structure_preserved(
                        blocks_no_ts, lang_code, async_client, "", model, effort
                    )

            per_num_text = asyncio.run(translate_single())

        translation_elapsed = time.time() - step_start
        log.info("-" * 80)
        log.info("✓ Translation phase complete (%.2fs)", translation_elapsed)

    # Hybrid evaluation phase
    if is_hybrid:
        step_start = time.time()
        log.info("🔍 [PHASE 4/5] LLM EVALUATION AND IMPROVEMENT")
        log.info("-" * 80)
        log.info("   Evaluating translation quality with %s...", eval_model)

        async def run_evaluation():
            return await evaluate_translation_with_llm(
                blocks_no_ts, per_num_text, lang_code, eval_model, ""
            )

        eval_results = asyncio.run(run_evaluation())

        # Replace translations with evaluated/improved versions
        for num, result in eval_results.items():
            per_num_text[num] = result["text"]

        # Log evaluation summary
        avg_score = sum(r["score"] for r in eval_results.values()) / len(eval_results)
        improved_count = sum(1 for r in eval_results.values() if r["score"] < 7)

        log.info("-" * 80)
        log.info("✓ Evaluation complete (%.2fs)", time.time() - step_start)
        log.info("   Average quality score: %.1f/10", avg_score)
        log.info("   Translations improved: %d/%d", improved_count, len(eval_results))

    # Rebuild and write output SRT using srt library
    step_start = time.time()
    final_phase = "[PHASE 5/5]" if is_hybrid else "[PHASE 4/4]"
    log.info("💾 %s Rebuilding SRT and writing output file...", final_phase)
    out_srt = rebuild_srt(srt_blocks, per_num_text)
    log.info("   Output size: %d characters", len(out_srt))

    write_text(output_srt, out_srt)
    log.info("✓ File write complete (%.2fs)", time.time() - step_start)

    overall_elapsed = time.time() - overall_start
    log.info("=" * 80)
    log.info("✅ TRANSLATION JOB COMPLETE!")
    log.info("   Total time: %.2fs", overall_elapsed)
    log.info(
        "   Translation time: %.2fs (%.1f%% of total)",
        translation_elapsed,
        (translation_elapsed / overall_elapsed) * 100,
    )
    log.info("   Average time per cue: %.2fs", overall_elapsed / num_cues)
    log.info("   Output: %s", output_srt)
    log.info("=" * 80)

    return output_srt
