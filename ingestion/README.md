# Workout Ingestion Pipeline

Populates ChromaDB with swim workouts for the AI Coach feature. Three data sources feed into a 4-stage pipeline: **Normalizer** (standardize text) -> **Classifier** (Claude Haiku metadata extraction) -> **Validator** (Pydantic schema enforcement) -> **ChromaDB Writer** (deduped insert).

## Quick Start

```bash
# From repo root — requires ANTHROPIC_API_KEY and CHROMA_DB_PATH in .env
python -m ingestion generate --count 700
python -m ingestion status
```

## Setup

### Prerequisites

- Python 3.10+
- Anthropic API key (for classifier + AI generator)
- ChromaDB storage path (shared with the backend)

### Install Dependencies

```bash
pip install -r ingestion/requirements.txt
```

### Environment Variables

Set these in the root `.env` file (or `backend/.env` as fallback):

```
ANTHROPIC_API_KEY=sk-ant-...    # Required for classifier + AI generator
CHROMA_DB_PATH=/absolute/path/to/chroma_db   # Absolute path, shared with backend
```

The CLI loads `.env` automatically via `python-dotenv`. You can also pass `--chroma-path` to override.

## Commands

All commands are run from the **repo root**:

```bash
python -m ingestion [OPTIONS] COMMAND [ARGS]
```

### Global Options

| Flag | Description |
|------|-------------|
| `--chroma-path PATH` | Override `CHROMA_DB_PATH` env var |
| `--verbose` | Enable debug logging |

### `generate` — AI Workout Generation

Generates diverse swim workouts using Claude Haiku across a parameter matrix (training focus x level x distance x stroke emphasis).

```bash
# Generate 700 workouts in meters (default)
python -m ingestion generate --count 700

# Generate in yards
python -m ingestion generate --count 300 --unit yards

# Customize batch persistence (default: every 25 workouts)
python -m ingestion generate --count 700 --batch-size 50

# Preview without writing to ChromaDB
python -m ingestion generate --count 10 --dry-run
```

**Cost:** ~$0.003/workout with Haiku. 700 workouts ~ $2-3.
**Time:** ~35 min for 700 workouts (rate-limited to stay under API limits).
**Crash-safe:** Persists to ChromaDB every `--batch-size` workouts.

### `import` — Curated Workout Import

Imports workouts from JSON files. Ships with 55 pre-compiled workouts from coaching books, university programs, and online resources.

```bash
# Import all curated data files
python -m ingestion import

# Import a specific file
python -m ingestion import --file ingestion/curated/data/coaching_books.json
```

**Cost:** ~$0.15 for classifying 55 workouts (Haiku).

### `scrape` — Web Scraping

Scrapes workouts from public swim websites.

```bash
python -m ingestion scrape --source swimswam
python -m ingestion scrape --source usms
```

**Note:** SwimSwam may block bot requests (403). USMS requires login. Scrapers are best-effort — the curated + AI sources are the primary data pipeline.

### `run-all` — Full Pipeline

Runs all sources in sequence: scrape -> import curated -> generate AI workouts.

```bash
python -m ingestion run-all
```

### `status` — Collection Stats

Shows what's in ChromaDB.

```bash
python -m ingestion status
```

Output:
```
Collection: swimming_workouts
  Total workouts: 755

  By source:
    scraped:        0
    curated:        55
    ai_generated:   700
    coach_created:  0
```

### `export` — Backup

Export the full collection to JSON for backup or migration.

```bash
python -m ingestion export --output workouts_backup.json
```

## Data Sources

| Source | Target Count | Method | Cost |
|--------|-------------|--------|------|
| Curated | 55 (included) | Pre-compiled JSON files | Classification only (~$0.15) |
| AI-Generated | 300-700 | Claude Haiku generation | ~$1-3 |
| SwimSwam | 0-400 | Web scraping | Free (may be blocked) |
| USMS | 0-200 | Web scraping | Free (requires login) |

## Curated Data Format

To add your own curated workouts, create a JSON file in `ingestion/curated/data/`:

```json
[
  {
    "title": "Sprint Blast 3000",
    "text": "Warm-up: 400 choice\n8x50 kick @1:00\nMain set: 12x50 Free @:40 descend 1-4\n4x100 Free @1:10 negative split\nCool-down: 200 easy",
    "source_name": "Your Source Name",
    "coach_notes": "Optional coaching context"
  }
]
```

Then import:
```bash
python -m ingestion import --file ingestion/curated/data/your_file.json
```

## Pipeline Architecture

```
Raw workouts (any source)
    |
    v
Normalizer — strips HTML, standardizes notation (Freestyle->Free, 4 x 100->4x100),
             formats as Title:/Workout: document
    |
    v
Classifier — Claude Haiku extracts metadata: training_focus, energy_zone, level,
             stroke/activity percentages, total distance, estimated duration
    |
    v
Validator  — Pydantic enforces schema, fuzzy-matches enum values
             ("speed"->sprint, "hard"->SP1), clamps percentages to 0-100
    |
    v
ChromaDB Writer — check-then-add (skips duplicates by content hash),
                  batch writes of 50, retry with exponential backoff
```

## Workout Schema in ChromaDB

Each workout has a **document** (embedded text for vector search) and **metadata** (structured fields for filtering):

| Metadata Field | Type | Example |
|---------------|------|---------|
| `title` | string | "Sprint Blast 3000" |
| `total_distance` | int | 3000 |
| `distance_unit` | string | "meters" / "yards" |
| `estimated_minutes` | int | 45 |
| `training_focus` | string | sprint / endurance / technique / IM / recovery / race_prep / mixed |
| `energy_zone` | string | EN1-EN3 / SP1-SP3 / mixed |
| `level` | string | beginner / age_group / senior / masters |
| `pct_free` | int | 60 (% freestyle) |
| `pct_back` | int | 20 |
| `pct_breast` | int | 10 |
| `pct_fly` | int | 10 |
| `pct_im` | int | 0 |
| `pct_swim` | int | 70 |
| `pct_kick` | int | 15 |
| `pct_drill` | int | 10 |
| `pct_pull` | int | 5 |
| `source` | string | scraped / curated / ai_generated / coach_created |
| `ingested_at` | string | ISO 8601 timestamp |

## Idempotency

The pipeline is idempotent — running the same command twice won't create duplicates. Each workout is identified by a SHA-256 hash of its normalized text. If the hash already exists in ChromaDB, the workout is skipped.

## Rate Limits

The pipeline is configured for Anthropic's free/starter tier (50 RPM):
- **2 concurrent** API requests max
- **1.5s delay** between requests (~40 RPM)
- Classifier retries once on invalid JSON

If you have a higher-tier API plan, you can increase concurrency by editing the `max_concurrent` defaults in `classifier.py` and `generators/ai_generator.py`.

## Testing

```bash
python -m pytest ingestion/tests/ -v
```
