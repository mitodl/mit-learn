# Video Translation System

High-performance AI-powered subtitle translation system optimized for speed and quality.

## Features

- **Fast parallel processing**: Automatically chunks large files and processes them concurrently
- **Multiple model support**: Test different OpenAI models (gpt-4o-mini, gpt-4o, o1, etc.)
- **Reasoning effort control**: Fine-tune quality for reasoning models (o1/o3)
- **Batch translation**: Translate to multiple languages in one command
- **Automatic output naming**: Smart output file naming based on input filename

## Quick Start

### Basic Translation

Translate a file to Hindi using default model:

```bash
docker compose run --rm web python manage.py translate_srt \
  learning_resources/translation/demos/input.srt \
  --language hi
```

**Output**: `learning_resources/translation/demos/output-hi.srt`

### Multiple Languages

Translate to multiple languages at once:

```bash
docker compose run --rm web python manage.py translate_srt \
  learning_resources/translation/demos/input.srt \
  --language hi \
  --language es \
  --language fr
```

**Outputs**:

- `output-hi.srt` (Hindi)
- `output-es.srt` (Spanish)
- `output-fr.srt` (French)

### All Languages

Translate to all supported languages at once:

```bash
docker compose run --rm web python manage.py translate_srt \
  learning_resources/translation/demos/input.srt \
  --language all
```

**Outputs**: 13 files for all supported languages (fr, de, es, pt, hi, ar, zh, kr, ja, id, ru, uk, el)

### Batch Directory Processing

Translate all `.srt` files in a directory:

```bash
docker compose run --rm web python manage.py translate_srt \
  --directory /path/to/srt/files \
  --language hi \
  --language es
```

**Note**: When using `--directory`, you cannot specify an individual `input_file`. All `.srt` files in the directory will be processed automatically.

**Example output** (if directory contains `video1.srt` and `video2.srt`):

- `video1_output-hi.srt`
- `video1_output-es.srt`
- `video2_output-hi.srt`
- `video2_output-es.srt`

### Model Comparison

Test different models side-by-side:

```bash
docker compose run --rm web python manage.py translate_srt \
  learning_resources/translation/demos/input.srt \
  --language hi \
  --model gpt-4o-mini \
  --model gpt-4o
```

**Outputs**:

- `output-gpt-4o-mini-hi.srt`
- `output-gpt-4o-hi.srt`

### Reasoning Models

Use o1/o3 models with reasoning effort:

```bash
docker compose run --rm web python manage.py translate_srt \
  learning_resources/translation/demos/input.srt \
  --language hi \
  --model o1-preview \
  --effort medium
```

### Custom Output Directory

Specify where translated files should be saved:

```bash
docker compose run --rm web python manage.py translate_srt \
  learning_resources/translation/demos/input.srt \
  --language hi \
  --output-dir /path/to/output
```

### Adjust Chunk Size

For very large files, adjust chunk size for optimal performance:

```bash
docker compose run --rm web python manage.py translate_srt \
  learning_resources/translation/demos/input.srt \
  --language hi \
  --chunk-size 50  # Smaller chunks = more parallelization
```

## Command Reference

### Required Arguments

Either:

- `input_file`: Path to a single SRT file to translate
- `-d, --directory`: Path to a directory containing SRT files (all `.srt` files will be processed)

**Note**: You must specify either `input_file` OR `--directory`, but not both.

### Options

| Flag               | Description                                                                  | Example                   |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------- |
| `-d, --directory`  | Directory containing SRT files to translate (processes all `.srt` files)     | `-d /path/to/srt/files`   |
| `-l, --language`   | Target language code or 'all' for all languages (can specify multiple times) | `-l hi -l es` or `-l all` |
| `-m, --model`      | LLM model to use (can specify multiple times)                                | `-m gpt-4o-mini`          |
| `-e, --effort`     | Reasoning effort: `low`, `medium`, `high`                                    | `-e high`                 |
| `-c, --chunk-size` | Cues per chunk (default: 100)                                                | `-c 50`                   |
| `-o, --output-dir` | Custom output directory                                                      | `-o /path/to/output`      |

### Available Languages

| Code | Language   |
| ---- | ---------- |
| `fr` | French     |
| `de` | German     |
| `es` | Spanish    |
| `pt` | Portuguese |
| `hi` | Hindi      |
| `ar` | Arabic     |
| `zh` | Chinese    |
| `kr` | Korean     |
| `ja` | Japanese   |
| `id` | Indonesian |
| `ru` | Russian    |
| `uk` | Ukrainian  |
| `el` | Greek      |

## Performance

### Optimizations

1. **Parallel Processing**: Files >100 cues are automatically chunked and translated in parallel
2. **SRT Library**: Uses optimized `srt` library for parsing/rebuilding
3. **Single-Pass Translation**: Translates with structure preserved (no re-segmentation needed)
4. **Async API Calls**: Multiple chunks call the LLM API simultaneously

### Benchmarks

| File Size | Model       | Old Time       | New Time         | Speedup         |
| --------- | ----------- | -------------- | ---------------- | --------------- |
| 301 cues  | gpt-4o-mini | 393s (6.5 min) | ~50-60s (<1 min) | **6.5x faster** |

## Output File Naming

The command intelligently generates output filenames:

| Input            | Language | Model    | Output                 |
| ---------------- | -------- | -------- | ---------------------- |
| `input.srt`      | `hi`     | default  | `output-hi.srt`        |
| `input.srt`      | `hi`     | `gpt-4o` | `output-gpt-4o-hi.srt` |
| `demo_input.srt` | `es`     | default  | `demo_output-es.srt`   |

**Rules**:

- Replaces "input" with "output" if present in filename
- Adds `-<model>-<lang>.srt` suffix when testing multiple models
- Adds `-<lang>.srt` suffix when using single model
- Uses input file's directory unless `-o` is specified

## Configuration

### Environment Variables

Set defaults in your `.env` file:

```bash
# Default model for translation
AI_TRANSLATION_MODEL=gpt-4o-mini

# Default reasoning effort for o1/o3 models (optional)
# Valid values: low, medium, high
AI_TRANSLATION_EFFORT=

# OpenAI API key (required)
OPENAI_API_KEY=sk-...
```

## Examples

### Production Workflow

Translate a course video to Hindi with high quality:

```bash
docker compose run --rm web python manage.py translate_srt \
  /path/to/course/video_en.srt \
  --language hi \
  --model gpt-4o \
  --output-dir /path/to/course/translations
```

### Quality Testing

Compare translation quality across models:

```bash
docker compose run --rm web python manage.py translate_srt \
  learning_resources/translation/demos/input.srt \
  --language hi \
  --model gpt-4o-mini \
  --model gpt-4o \
  --model o1-preview
```

Review the outputs to determine best model for your use case.

### Batch Multi-Language Production

Translate to all supported languages:

```bash
docker compose run --rm web python manage.py translate_srt \
  /path/to/video.srt \
  --language all \
  --model gpt-4o-mini \
  --output-dir /path/to/translations
```

### Batch Directory Translation

Translate all SRT files in a directory to multiple languages:

```bash
docker compose run --rm web python manage.py translate_srt \
  --directory /path/to/course/subtitles \
  --language hi \
  --language es \
  --language fr \
  --output-dir /path/to/course/translations
```

This will process all `.srt` files in the directory and create translated versions for each language.

## Troubleshooting

### "Input file not found"

Ensure the path is correct and the file exists:

```bash
ls -la learning_resources/translation/demos/input.srt
```

### "OpenAI API key not provided"

Set your API key in the environment:

```bash
export OPENAI_API_KEY=sk-...
```

Or add it to your `.env` file.

### Slow translations

- Reduce chunk size for more parallelization: `--chunk-size 50`
- Use faster model: `--model gpt-4o-mini`
- Check your internet connection

### Out of memory

Increase chunk size to reduce concurrent API calls: `--chunk-size 200`

## Advanced Usage

### Programmatic API

Call the translation function directly from Python:

```python
from learning_resources.translation.api import translate_transcript

translate_transcript(
    input_srt="path/to/input.srt",
    output_srt="path/to/output-hi.srt",
    lang_code="hi",
    chunk_size=100,
    model="gpt-4o-mini",
    effort=None,  # or "low", "medium", "high" for reasoning models
)
```

## Architecture

See [api.py](./api.py) for implementation details.

**Key components**:

- `translate_transcript()`: Main entry point with automatic chunking
- `translate_with_structure_preserved()`: Async single-pass translation
- `parse_srt()`: SRT parsing using `srt` library
- `rebuild_srt()`: SRT reconstruction with translated text

**Translation flow**:

1. Parse input SRT file
2. Chunk cues if needed (>100 cues)
3. Translate all chunks in parallel via async API calls
4. Merge translated cues
5. Rebuild and write output SRT file
