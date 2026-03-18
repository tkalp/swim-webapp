# Swim-Scraper Integration Design

**Date:** 2026-03-18
**Status:** Approved
**Branch:** `feature/add-search-swimmer-feature`

## Problem

The existing worker scraping pipeline (curl/httpx/playwright/scraperapi fetchers) is blocked by Cloudflare Turnstile on swimrankings.net. The `swim-scraper` tool uses DrissionPage (Chromium automation) which bypasses Turnstile via persistent browser profiles. We need to replace the existing pipeline with the swim-scraper as the sole data source.

## Decision

**Replace the entire scraping pipeline (option B)** with the swim-scraper's `SwimRankings` client. The existing fetcher/parser/scraper layers are dead code since Cloudflare blocks everything — remove them entirely.

### Key Design Choices

- **No splits for now (option A):** Import core result data only (time, event, date, meet, points). Splits can be backfilled later.
- **Lazy singleton browser (option C):** First task spins up the DrissionPage browser, subsequent tasks reuse it. If the browser dies, the next task recreates it.
- **Credentials via env vars (option B):** `SWIMRANKINGS_EMAIL` and `SWIMRANKINGS_PASSWORD` passed through docker-compose.

## Architecture

```
Celery Task → SwimRankingsClient (lazy singleton) → swimrankings.net
                                                          |
                                                    RaceResult objects
                                                          |
                                              Converter (RaceResult -> WorkoutResult)
                                                          |
                                              Persister (bulk insert to DB)
```

### What Stays

| File | Purpose |
|------|---------|
| `celery_app.py` | Celery initialization, beat schedule, task config |
| `sync_tasks.py` | 3 Celery tasks (rewritten internals, same signatures including `force_update` param) |
| `services/database_service.py` | Sync status updates, bulk insert |
| `services/bulk_sync_service.py` | Job/failure tracking |
| `models.py` | `WorkoutResult`, `SyncResult`, `SyncProgress`, `SyncStatusUpdate` |
| `constants.py` | Style ID mappings (event -> distance/stroke conversion) |
| `config.py` | Trimmed down (remove fetcher/proxy/splits config, add DrissionPage config) |
| `database.py` | Synchronous SQLAlchemy session factory (`get_db()`) for worker DB access |

### What Gets Removed

| Path | Reason |
|------|--------|
| `fetchers/` | Entire directory (6 files) — curl, httpx, playwright, scraperapi, factory, base |
| `scrapers/` | Entire directory (3 files) — base_scraper, swimrankings_scraper |
| `parsers/` | Entire directory (2 files) — swimrankings_parser |
| `sync/` | Entire directory (8 files) — orchestrator + services (event_fetcher, result_converter, result_filter, result_persister, splits_fetcher) |
| `utils/distance_helper.py` | Split-related helpers |

**Note:** The existing `result_converter.py` has useful `parse_date()` logic (handles non-breaking spaces, multiple date formats). Migrate this into the new `converter.py` rather than writing a naive implementation.

### What Gets Added

| File | Purpose |
|------|---------|
| `swim-scraper/` | The cloned scraper repo, moved inside `worker/` (remove its `.git` directory) |
| `client.py` | Lazy singleton wrapper around `SwimRankings` client |
| `converter.py` | `RaceResult` -> `WorkoutResult` mapping logic (inherits `parse_date()` from existing converter) |

## Data Mapping

### `RaceResult` -> `WorkoutResult`

| RaceResult field | WorkoutResult field | Transformation |
|---|---|---|
| `event` ("100m Freestyle") | `distance` + `stroke` | Parse with `parts[0].rstrip('m')` for distance, map stroke name -> enum via `constants.py` `STROKE_NAME_TO_ENUM` (handles both "100m" and "100" formats) |
| `course` ("LCM" / "SCM") | `result_units` | Direct pass-through. The swim-scraper's parser already maps "Long Course (50m)" -> "LCM" and "Short Course (25m)" -> "SCM" internally. |
| `time` ("1:06.29") | `time_result` | Store as-is (string) |
| `date` ("12 Nov 2024") | `performed_on` | Multi-format parser migrated from existing `ResultConverter.parse_date()` — handles `\xa0` non-breaking spaces, 6+ date formats with fallback |
| `city` | `meet_city` | Direct |
| `meet` | `meet_name` | Direct |
| `points` | *(dropped for now)* | No points field on `WorkoutResult`. Note: `RaceResult.points` is `str` type, relevant when adding the column later. |
| *(n/a)* | `meet_nation` | `None` |
| *(n/a)* | `swimrankings_result_id` | Synthesized: `"{athlete_id}_{date}_{distance}_{stroke}_{course}_{time}_{meet}"` (includes meet name to avoid collisions from prelims/finals with identical times) |
| *(n/a)* | `reaction_time` | `None` (no splits) |
| *(n/a)* | `has_splits_available` | `None` (unknown) |
| *(n/a)* | `source` | `"swimrankings"` |
| *(n/a)* | `swimmer_id` | From task context |

### Deduplication

Same strategy as existing: synthesize `swimrankings_result_id` from result fields, check against existing DB records before insert.

## Sync Logic

### Single Swimmer Sync

1. Get `SwimRankings` client (lazy singleton)
2. Call `client.history(athlete_id)` -> `AthleteHistory` with all `RaceResult`s
3. Convert each `RaceResult` -> `WorkoutResult` via converter (skip unparseable results with warning)
4. Query DB for existing `swimrankings_result_id`s for this swimmer
5. Filter out duplicates
6. Bulk insert new results
7. Update `swimmer_external_links` sync status/timestamps

### Squad/Bulk Sync

Unchanged pattern: loop through swimmers, call single swimmer sync, track progress in `BulkSyncJob`, sleep 1-2s between swimmers.

### Freshness Check

Before calling `client.history()`, check `last_sync_completed_at` on the external link. If within `SYNC_FRESHNESS_HOURS` (default 48h), skip. The `force_update` parameter on `bulk_sync_all_swimmers_task` bypasses this check.

## Lazy Singleton Browser

```python
# worker/client.py

class SwimRankingsClientManager:
    _instance: SwimRankings | None = None

    @classmethod
    def get_client(cls) -> SwimRankings:
        if cls._instance is None or not cls._is_alive():
            cls._cleanup()
            cls._instance = SwimRankings(
                email=config.SWIMRANKINGS_EMAIL,
                password=config.SWIMRANKINGS_PASSWORD,
                browser_path=config.CHROMIUM_PATH,
                profile_dir=config.BROWSER_PROFILE_DIR,
                cf_timeout=config.CF_TIMEOUT,
            ).start()
        return cls._instance

    @classmethod
    def _is_alive(cls) -> bool:
        """Probe the browser to verify it's responsive, not just that the object exists."""
        try:
            _ = cls._instance.page.title  # Actually hits the browser process
            return True
        except Exception:
            return False

    @classmethod
    def _cleanup(cls):
        if cls._instance is not None:
            try:
                cls._instance.close()
            except Exception:
                pass
            cls._instance = None
```

## Docker Changes

### Dockerfile

- Remove Playwright install (`playwright install chromium`) and Playwright apt dependencies
- Install Chromium directly (`apt-get install chromium`)
- Install DrissionPage (`pip install DrissionPage`)
- Copy `worker/swim-scraper/` and install as local package
- Keep Python 3.11-slim base

### docker-compose.yml

**Add:**
```yaml
SWIMRANKINGS_EMAIL=${SWIMRANKINGS_EMAIL}
SWIMRANKINGS_PASSWORD=${SWIMRANKINGS_PASSWORD}
CHROMIUM_PATH=/usr/bin/chromium
BROWSER_PROFILE_DIR=/tmp/swimrankings_profile
```

**Remove from worker service:**
```yaml
FETCH_MODE, SCRAPERAPI_KEY, USE_OXYLABS_PROXY, OXYLABS_USERNAME,
OXYLABS_PASSWORD, OXYLABS_COUNTRY,
SCRAPER_MAX_WORKERS, SCRAPER_MIN_DELAY, SCRAPER_MAX_DELAY,
SPLITS_MAX_WORKERS, GLOBAL_SPLITS_SEMAPHORE_SIZE,
EVENT_BATCH_SIZE, MAX_CONCURRENT_REQUESTS
```

**Also remove from backend service** (if present):
```yaml
USE_OXYLABS_PROXY, OXYLABS_USERNAME, OXYLABS_PASSWORD, OXYLABS_COUNTRY
```

**Keep:**
```yaml
DATABASE_URL, REDIS_URL, CELERY_BROKER_URL, CELERY_RESULT_BACKEND
```

### Memory Considerations

The current `mem_limit: 1g` / `mem_reservation: 512m` stays as-is. DrissionPage + Chromium has a similar footprint to Playwright (~200-400MB). Monitor in production — if the persistent browser + Celery worker exceeds limits, bump to 1.5GB.

## Config Changes

### `worker/config.py`

Remove: all fetcher mode, proxy, splits, scraper concurrency settings (FETCH_MODE, SCRAPERAPI_KEY, USE_OXYLABS_PROXY, OXYLABS_*, SCRAPER_MAX_WORKERS, SCRAPER_MIN/MAX_DELAY, SPLITS_MAX_WORKERS, GLOBAL_SPLITS_SEMAPHORE_SIZE, etc.).

Add:
```python
SWIMRANKINGS_EMAIL: str       # env: SWIMRANKINGS_EMAIL
SWIMRANKINGS_PASSWORD: str    # env: SWIMRANKINGS_PASSWORD
CHROMIUM_PATH: str            # env: CHROMIUM_PATH, default: /usr/bin/chromium
BROWSER_PROFILE_DIR: str      # env: BROWSER_PROFILE_DIR, default: /tmp/swimrankings_profile
CF_TIMEOUT: int               # env: CF_TIMEOUT, default: 90
SYNC_FRESHNESS_HOURS: int     # env: SYNC_FRESHNESS_HOURS, default: 48 (already exists)
```

## Error Handling

- **Browser crash:** Lazy singleton probes browser with `page.title`; recreates on next `get_client()` call if unresponsive
- **Cloudflare timeout:** `cf_timeout=90` gives Turnstile time to solve. If it fails, task fails with clear error.
- **swimrankings.net unreachable:** Task fails, sync status updated to `failed` with error message
- **Invalid result data:** Converter skips unparseable results, logs warnings, continues with valid ones
- **Rate limiting:** Handled by swim-scraper's built-in `RateLimiter` (2-5s random delay between requests)

## Out of Scope

- Split time fetching (backfill later)
- FINA points storage (no column exists; `RaceResult.points` is `str` type — note for future schema)
- Meet nation extraction (not available from scraper)
- Search functionality integration (scraper has it, but not needed for sync tasks)
- Existing worker tests — will need rewriting to match new architecture (separate task)
