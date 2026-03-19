# AI Coach Re-Engineer — SP1: Workout Data Pipeline & Ingestion

**Date:** 2026-03-19
**Status:** Approved
**Branch:** `feature/add-search-swimmer-feature`
**Part of:** AI Coach Re-Engineer (4 sub-projects: SP1 → SP2 → SP3 → SP4)

## Problem

The current AI Coach generates mediocre workouts because:
1. **No ingestion pipeline** — ChromaDB's `swimming_workouts` collection has no visible way to get populated. No `.add()` call, no scripts, no CSV imports exist in the codebase.
2. **Thin example base** — even if manually populated, the system is hardcoded to pull 6 examples from what appears to be a tiny corpus.
3. **No structured metadata** — workouts only have `title` and `coach_notes`. No way to filter by training focus, level, stroke breakdown, etc.

## Goal

Build the data infrastructure to populate ChromaDB with 750-1,200 high-quality, richly-tagged swim workouts from three sources: web scrapers, curated coaching resources, and AI-generated workouts.

## Context: The Full AI Coach Re-Engineer

This is the first of 4 sub-projects:

| Sub-Project | What | Depends On |
|-------------|------|------------|
| **SP1: Data Pipeline & Ingestion** (this spec) | Populate ChromaDB with 750-1,200 tagged workouts | Nothing |
| SP2: Two-Stage RAG & Coach Style Engine | Personalized retrieval + coach style learning | SP1 |
| SP3: Frontend Redesign | Multi-step wizard, edit-in-place, variations | SP2 |
| SP4: Quality & Feedback Loop | Self-improving system via ratings/analytics | SP2 + SP3 |

SP1 produces the foundation everything else depends on.

## Workout Schema

Every workout in ChromaDB has two parts:

### Document (embedded for vector search)

The full workout text, prefixed with `Title:` and `Workout:` markers for compatibility with the existing `build_context()` function in `workout_generator.py` (which parses `Workout:` to extract set text):

```
Title: Sprint Blast 3000
Workout:
Warm-up: 400 choice
8x50 kick @1:00
Main set: 12x50 Free @:40 (descend 1-4)
4x100 Free @1:10 (negative split)
Cool-down: 200 easy
```

This format ensures backward compatibility with `build_context()` while also embedding the title for richer vector search.

### Metadata (structured fields for filtered retrieval)

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `title` | string | "Sprint Blast 3000" | Display name |
| `total_distance` | int | 3000 | Filter by volume |
| `distance_unit` | string | "yards" / "meters" | Pool type |
| `estimated_minutes` | int | 60 | Filter by session length |
| `training_focus` | string | "sprint" / "endurance" / "technique" / "IM" / "recovery" / "race_prep" / "mixed" | Primary classification |
| `energy_zone` | string | "EN1" / "EN2" / "EN3" / "SP1" / "SP2" / "SP3" / "mixed" | Dominant zone |
| `level` | string | "beginner" / "age_group" / "senior" / "masters" | Target swimmer level |
| `pct_free` | int | 60 | % freestyle (ChromaDB-filterable) |
| `pct_back` | int | 20 | % backstroke |
| `pct_breast` | int | 10 | % breaststroke |
| `pct_fly` | int | 10 | % butterfly |
| `pct_im` | int | 0 | % individual medley |
| `pct_swim` | int | 70 | % swim activity |
| `pct_kick` | int | 15 | % kick activity |
| `pct_drill` | int | 10 | % drill activity |
| `pct_pull` | int | 5 | % pull activity |
| `source` | string | "scraped" / "curated" / "ai_generated" / "coach_created" | Origin tracking |
| `source_url` | string (nullable) | "https://swimswam.com/..." | For scraped workouts |
| `source_name` | string (nullable) | "SwimSwam" / "USMS" / "The Swim Coaching Bible" | Human-readable source |
| `coach_notes` | string (nullable) | "Focus on underwater dolphins" | Optional coaching context |
| `ingested_at` | string | "2026-03-19T14:30:00Z" | When workout was added to collection |

**Note:** Stroke and activity breakdowns are stored as individual `pct_*` integer fields (not JSON strings) so ChromaDB's `where` filter can query them directly. Example SP2 query: `collection.query(query_texts=[...], where={"training_focus": "sprint", "level": "senior"}, n_results=10)`.

### Embedding Model

Default ChromaDB embeddings (`all-MiniLM-L6-v2`) for v1. The metadata-filtered retrieval in SP2 means embeddings don't need to be perfect — they just rank reasonably within an already-filtered subset. Upgrade path to `text-embedding-3-small` (OpenAI) or domain-tuned model if retrieval quality is insufficient after SP2.

### Document ID

SHA-256 hash of the normalized workout text. This serves as both the ChromaDB document ID and the deduplication key.

## Pipeline Architecture

```
Scrapers (SwimSwam, USMS)        ─┐
Curated imports (coaching books)  ─┼──→  Normalizer  ──→  Classifier  ──→  Validator  ──→  ChromaDB Writer
AI-generated workouts             ─┘
```

### Stage 1: Normalizer

Takes raw workout text from any source and outputs standard format:
- Strips HTML, ads, attribution boilerplate
- Standardizes notation ("Freestyle" → "Free", "4 × 100" → "4x100")
- Extracts total distance from set descriptions where possible
- Detects yards vs meters from context clues (pool size mentions, interval patterns)
- Formats document with `Title:` and `Workout:` markers
- Output: `{title: str, text: str, document: str, distance_unit: str | None, source: str, source_url: str | None, source_name: str | None, coach_notes: str | None}`

### Stage 2: Classifier

Takes normalized workout and fills metadata using Claude:
- **Single Claude call per workout** with structured JSON output
- **Model:** Claude Haiku (cheapest, sufficient for classification)
- **Cost:** ~$0.003/workout. 1,000 workouts ≈ $3.
- **Concurrency:** 10 concurrent API calls using `asyncio.gather()` with semaphore. Full pipeline for 1,000 workouts ≈ 5-8 minutes.

**Classifier prompt structure:**
```
Given this swim workout, classify it and extract structured metadata.
Return JSON only, no explanation.

Workout title: "{title}"
Workout text:
"""
{text}
"""

Energy zone definitions:
- EN1: Easy/recovery, very low intensity, conversational pace
- EN2: Aerobic/moderate, steady-state endurance, can sustain 30+ min
- EN3: Threshold, comfortably hard, lactate threshold pace
- SP1: VO2max, hard effort, sustainable for 3-8 minutes
- SP2: Anaerobic/race pace, very hard, 30sec-2min efforts
- SP3: Sprint/max effort, all-out, under 30sec

Return this exact JSON structure with these exact enum values:
{
  "total_distance": <int, total meters or yards>,
  "distance_unit": "<yards|meters>",
  "estimated_minutes": <int>,
  "training_focus": "<sprint|endurance|technique|IM|recovery|race_prep|mixed>",
  "energy_zone": "<EN1|EN2|EN3|SP1|SP2|SP3|mixed>",
  "level": "<beginner|age_group|senior|masters>",
  "pct_free": <int 0-100>,
  "pct_back": <int 0-100>,
  "pct_breast": <int 0-100>,
  "pct_fly": <int 0-100>,
  "pct_im": <int 0-100>,
  "pct_swim": <int 0-100>,
  "pct_kick": <int 0-100>,
  "pct_drill": <int 0-100>,
  "pct_pull": <int 0-100>
}
```

### Stage 3: Validator

Validates classifier output against the schema before writing:
- **Enum validation:** `training_focus` must be one of 7 allowed values, `energy_zone` one of 7, `level` one of 4, `distance_unit` one of 2
- **Range validation:** all `pct_*` fields must be 0-100, `total_distance` must be positive, `estimated_minutes` must be 1-300
- **Type validation:** ints are ints, strings are strings
- **Invalid output handling:** If Claude returns an unrecognized value (e.g., `"training_focus": "speed"`), map to closest match or default to `"mixed"`. Log the correction.
- **Missing fields:** Fill with sensible defaults (`"mixed"` for focus/zone, 0 for pct fields) rather than rejecting the workout entirely. A partially-classified workout is better than none.

Uses a Pydantic model for validation.

### Stage 4: ChromaDB Writer

Writes validated workouts into the `swimming_workouts` collection:
- **Collection access:** Uses `get_or_create_collection()` (not `get_collection()`) — creates the collection on first run, reuses on subsequent runs.
- **ID:** SHA-256 content hash of the normalized workout text.
- **Deduplication:** Before writing a batch, query existing IDs via `collection.get(ids=[...])`. Only write IDs that don't exist. This is "check-then-add" (not upsert), preserving existing data.
- **Batch writes:** Groups of 50 via `collection.add()`.
- **Metadata:** All fields from the schema, plus `ingested_at` timestamp.

## ChromaDB Path Resolution

The ingestion pipeline and backend must use the **same ChromaDB path**. This is critical.

- **`CHROMA_DB_PATH`** environment variable is the single source of truth (absolute path recommended).
- **CLI always requires `--chroma-path` or `CHROMA_DB_PATH`** — no relative path default. This prevents accidental writes to the wrong directory.
- **Local dev:** Set `CHROMA_DB_PATH` to an absolute path in `backend/.env` (e.g., `Z:/Source/swim_app_repos/aquilus-webapp/chroma_db`). The ingestion CLI reads from the same `.env` via `python-dotenv`.
- **Docker:** Add `CHROMA_DB_PATH=/app/chroma_db` to the backend service in `docker-compose.yml` with a named volume mount. The ingestion pipeline runs outside Docker (on host or in a one-off container) pointing to the same volume.

## Data Sources

### Source 1: Web Scrapers (target: 400-600 workouts)

**SwimSwam Workout of the Week**
- Publishes weekly workouts with structured sets
- Consistent format, coach-attributed
- Archive of 200-400+ workouts
- Scraper extracts: title, workout text, source URL

**USMS Workout Library**
- US Masters Swimming public workout database
- Searchable by distance/focus
- Hundreds of workouts with good existing metadata
- Scraper extracts: title, workout text, distance, source URL

Each scraper is a standalone Python module that outputs a list of raw workout dicts. The normalizer handles format standardization.

### Source 2: Curated from Online Resources (target: 50-100 workouts)

The implementer researches and compiles workouts from publicly available coaching resources:
- Coaching books with published workout examples
- University swim team published programs
- USA Swimming training resources
- Coaching forums with shared sets
- YouTube coaches who post workouts in descriptions

Compiled into JSON files in `ingestion/curated/data/`:
- `coaching_books.json` — workouts from published coaching literature
- `university_programs.json` — college/university team workouts
- `online_resources.json` — forums, blogs, YouTube descriptions

Each JSON file is an array of `{title, text, source_name, coach_notes?}`.

### Source 3: AI-Generated Workouts (target: 300-500 workouts)

Claude generates diverse workouts across a parameter matrix:
- **Training focus:** sprint, endurance, technique, IM, recovery, race_prep (6)
- **Level:** age_group, senior, masters (3)
- **Distance range:** 2000-6000 in 500 increments (9)
- **Stroke emphasis:** free-heavy, back-heavy, breast-heavy, fly-heavy, IM, mixed (6)

Sample ~300-500 combinations from the full matrix (972 total). Each generation uses a specialized prompt that produces realistic, varied workouts. Generated workouts are tagged with `source: "ai_generated"`.

**Generation prompt** emphasizes:
- Realistic set structures (not just round numbers)
- Varied warm-up/cool-down approaches
- Appropriate intervals for the target level
- Creative set names and coaching cues
- Variation in workout personality (some technical, some aggressive, some playful)

## File Structure

```
aquilus-webapp/
├── ingestion/                    # New — standalone workout data pipeline
│   ├── __init__.py
│   ├── normalizer.py             # Raw text → standard format with Title:/Workout: markers
│   ├── classifier.py             # Claude call → metadata fields (async, concurrent)
│   ├── validator.py              # Pydantic validation of classifier output
│   ├── chromadb_writer.py        # Check-then-add to ChromaDB with dedup
│   ├── pipeline.py               # Orchestrator: normalize → classify → validate → write
│   ├── scrapers/
│   │   ├── __init__.py
│   │   ├── base.py               # Base scraper interface
│   │   ├── swimswam.py           # SwimSwam workout scraper
│   │   └── usms.py               # USMS workout library scraper
│   ├── generators/
│   │   ├── __init__.py
│   │   └── ai_generator.py       # Claude-based workout generation
│   ├── curated/
│   │   ├── __init__.py
│   │   ├── importer.py           # JSON import script
│   │   └── data/                 # Compiled workout files
│   │       ├── coaching_books.json
│   │       ├── university_programs.json
│   │       └── online_resources.json
│   ├── cli.py                    # CLI entry point (click-based)
│   └── requirements.txt          # chromadb, anthropic, httpx, beautifulsoup4, pydantic, click, python-dotenv
```

**Dependency note:** Pin `chromadb` and `anthropic` to the same versions as `backend/requirements.txt` to avoid data format incompatibilities. Document this in `requirements.txt` with a comment.

## CLI Interface

```bash
# Individual sources
python -m ingestion.cli scrape --source swimswam --chroma-path /path/to/chroma_db
python -m ingestion.cli scrape --source usms
python -m ingestion.cli import --file curated/data/coaching_books.json
python -m ingestion.cli generate --count 300

# Pipeline operations
python -m ingestion.cli run-all             # Full pipeline: scrape + import + generate
python -m ingestion.cli status              # Show collection stats (count, source breakdown, latest ingestion)

# All commands support:
#   --chroma-path PATH    Override CHROMA_DB_PATH env var
#   --dry-run             Preview what would be ingested without writing
#   --verbose             Detailed logging

# Maintenance
python -m ingestion.cli export --format json --output workouts_backup.json  # Full backup (document + metadata + ID)
```

## Environment Variables

```
CHROMA_DB_PATH=/absolute/path/to/chroma_db    # Absolute path required — shared with backend
ANTHROPIC_API_KEY=...                          # For classifier + AI generator
```

The CLI loads from `backend/.env` via `python-dotenv` for convenience. `--chroma-path` CLI flag overrides the env var.

## Error Handling

- **Scraper failures:** Log and skip individual workouts that fail to parse. Report success/fail counts at end.
- **Classifier failures:** If Claude returns invalid JSON, retry once with a simplified prompt. If still invalid, pass to validator with empty metadata (defaults applied). Never block the pipeline on one workout.
- **Validation failures:** Validator corrects out-of-range values to nearest valid option and logs corrections. Only rejects a workout if the text itself is empty.
- **ChromaDB write failures:** Retry up to 3 times with exponential backoff. Log failures with workout ID.
- **Deduplication:** Content hash already exists = skip silently. Report skip count in summary.

## Success Criteria

- [ ] ChromaDB `swimming_workouts` collection has 750+ workouts
- [ ] Every workout has all metadata fields populated (validated by Pydantic)
- [ ] Source breakdown: scraped (400+), curated (50+), AI-generated (300+)
- [ ] `python -m ingestion.cli status` shows collection stats with source breakdown
- [ ] Pipeline is idempotent (running twice doesn't create duplicates)
- [ ] Total pipeline runtime under 15 minutes for full `run-all`
- [ ] Documents follow `Title:` / `Workout:` format (compatible with `build_context()`)
- [ ] All `pct_*` fields are individual integers (ChromaDB `where`-filterable)

## Out of Scope (Handled in SP2-SP4)

- Coach workout auto-ingestion (SP2)
- Two-stage retrieval / personalized RAG (SP2)
- Frontend changes (SP3)
- Quality scoring / feedback loop (SP4)
- Custom embedding models (future optimization)
- Updating `build_context()` in `workout_generator.py` (SP2 — this spec ensures format compatibility)
