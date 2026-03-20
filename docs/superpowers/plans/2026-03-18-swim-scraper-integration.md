# Swim-Scraper Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cloudflare-blocked worker scraping pipeline with the swim-scraper's DrissionPage-based client as the sole data source.

**Architecture:** The swim-scraper package (moved into `worker/swim-scraper/`) provides a `SwimRankings` client that bypasses Cloudflare Turnstile. A lazy singleton manages the browser lifecycle across Celery tasks. A converter maps `RaceResult` → `WorkoutResult` for DB insertion. The existing sync tasks keep their signatures but get rewritten internals.

**Tech Stack:** DrissionPage (Chromium automation), Celery, SQLAlchemy (sync), PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-18-swim-scraper-integration-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `worker/client.py` | Lazy singleton `SwimRankingsClientManager` — browser lifecycle, health checks, auto-recreation |
| `worker/converter.py` | `RaceResultConverter` — maps `RaceResult` → `WorkoutResult`, date parsing, event parsing, dedup ID synthesis |

### Modified Files
| File | Changes |
|------|---------|
| `worker/config.py` | Remove fetcher/proxy/splits config, add DrissionPage + credentials config |
| `worker/sync_tasks.py` | Rewrite task internals to use `SwimRankingsClientManager` + `RaceResultConverter` instead of `SwimRankingsScraper` + `SyncOrchestrator`. Remove `limit_events` param (swim-scraper fetches all history). |
| `worker/models.py` | Remove `RaceSplit`, `AttemptData`, `ResultWithSplits` (unused without splits) |
| `worker/services/database_service.py` | Remove split-related methods, add `get_last_sync_time()` helper |
| `worker/requirements.txt` | Remove playwright/beautifulsoup4/lxml/httpx, add DrissionPage |
| `worker/Dockerfile` | Remove Playwright, install Chromium + DrissionPage, copy swim-scraper |
| `docker-compose.yml` | Remove fetcher/proxy env vars from worker+backend, add SwimRankings credentials |

### Deleted Files/Directories
| Path | Reason |
|------|--------|
| `worker/fetchers/` | Entire directory (6 files) — replaced by swim-scraper client |
| `worker/scrapers/` | Entire directory (3 files) — replaced by swim-scraper client |
| `worker/parsers/` | Entire directory (2 files) — replaced by swim-scraper parsers |
| `worker/sync/` | Entire directory (8 files) — orchestrator replaced by simpler task logic |
| `worker/utils/distance_helper.py` | Split-related, no longer needed |

### Moved
| From | To |
|------|-----|
| `swim-scraper/` (repo root) | `worker/swim-scraper/` (remove `.git` dir) |

---

## Task 1: Move swim-scraper into worker and set up imports

**Files:**
- Move: `swim-scraper/` → `worker/swim-scraper/`
- Verify: `worker/swim-scraper/swimrankings/__init__.py`

- [ ] **Step 1: Move the swim-scraper directory**

```bash
# Move directory (it's currently at repo root)
mv swim-scraper worker/swim-scraper

# Remove nested .git (it was cloned separately)
rm -rf worker/swim-scraper/.git
```

- [ ] **Step 2: Verify the package is importable**

```bash
cd worker && python -c "import sys; sys.path.insert(0, 'swim-scraper'); from swimrankings import SwimRankings, RaceResult, AthleteHistory; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/swim-scraper/
git commit -m "chore: move swim-scraper into worker directory"
```

---

## Task 2: Write the converter (TDD)

**Files:**
- Create: `worker/tests/conftest.py` (shared swim-scraper path setup)
- Create: `worker/converter.py`
- Create: `worker/tests/test_converter.py`

- [ ] **Step 0: Create conftest.py for swim-scraper imports**

Create `worker/tests/conftest.py` (if it doesn't exist, or add to existing):

```python
"""Shared test configuration for worker tests."""

import sys
import os

# Add swim-scraper to Python path so `from swimrankings import ...` works in tests
_scraper_path = os.path.join(os.path.dirname(__file__), "..", "swim-scraper")
if _scraper_path not in sys.path:
    sys.path.insert(0, os.path.abspath(_scraper_path))
```

- [ ] **Step 1: Write failing tests for the converter**

Create `worker/tests/test_converter.py`:

```python
"""Tests for RaceResultConverter."""

import pytest
from swimrankings.models import RaceResult
from worker.converter import RaceResultConverter


class TestParseDate:
    def test_standard_date(self):
        assert RaceResultConverter.parse_date("12 Nov 2024") == "2024-11-12"

    def test_full_month_name(self):
        assert RaceResultConverter.parse_date("22 November 2024") == "2024-11-22"

    def test_non_breaking_spaces(self):
        assert RaceResultConverter.parse_date("12\xa0Nov\xa02024") == "2024-11-12"

    def test_slash_format(self):
        assert RaceResultConverter.parse_date("22/11/2024") == "2024-11-22"

    def test_iso_format_passthrough(self):
        assert RaceResultConverter.parse_date("2024-11-22") == "2024-11-22"

    def test_empty_string(self):
        assert RaceResultConverter.parse_date("") == ""

    def test_none_returns_empty(self):
        assert RaceResultConverter.parse_date(None) == ""


class TestParseEvent:
    def test_freestyle(self):
        d, s = RaceResultConverter.parse_event("100m Freestyle")
        assert d == 100
        assert s == "free"

    def test_backstroke(self):
        d, s = RaceResultConverter.parse_event("200m Backstroke")
        assert d == 200
        assert s == "back"

    def test_breaststroke(self):
        d, s = RaceResultConverter.parse_event("50m Breaststroke")
        assert d == 50
        assert s == "breast"

    def test_butterfly(self):
        d, s = RaceResultConverter.parse_event("100m Butterfly")
        assert d == 100
        assert s == "fly"

    def test_individual_medley(self):
        d, s = RaceResultConverter.parse_event("200m Individual Medley")
        assert d == 200
        assert s == "im"

    def test_no_m_suffix(self):
        """Handle format without 'm' like '200 Freestyle'."""
        d, s = RaceResultConverter.parse_event("200 Freestyle")
        assert d == 200
        assert s == "free"

    def test_invalid_returns_none(self):
        result = RaceResultConverter.parse_event("garbage")
        assert result is None

    def test_uses_stroke_enum_from_raceresult(self):
        """Converter uses RaceResult.stroke.value when available."""
        from swimrankings.models import Stroke
        rr = RaceResult(event="100m Freestyle", course="LCM", time="52.34")
        assert rr.stroke == Stroke.FREESTYLE
        # Stroke.UNKNOWN events should be skipped
        rr_unknown = RaceResult(event="100m Unknown", course="LCM", time="52.34")
        rr_unknown.stroke = Stroke.UNKNOWN
        result = RaceResultConverter.convert(rr_unknown, "sid", "aid")
        assert result is None


class TestSynthesizeResultId:
    def test_basic(self):
        result_id = RaceResultConverter.synthesize_result_id(
            athlete_id="12345",
            date="2024-11-12",
            distance=100,
            stroke="free",
            course="LCM",
            time="52.34",
            meet="World Cup",
        )
        assert result_id == "12345_2024-11-12_100_free_LCM_52.34_World Cup"

    def test_empty_meet(self):
        result_id = RaceResultConverter.synthesize_result_id(
            athlete_id="12345",
            date="2024-11-12",
            distance=100,
            stroke="free",
            course="LCM",
            time="52.34",
            meet="",
        )
        assert result_id == "12345_2024-11-12_100_free_LCM_52.34_"


class TestConvertRaceResult:
    def test_full_conversion(self):
        race_result = RaceResult(
            event="100m Freestyle",
            course="LCM",
            time="52.34",
            points="850",
            date="12 Nov 2024",
            city="Budapest",
            meet="World Cup",
        )
        workout = RaceResultConverter.convert(
            race_result=race_result,
            swimmer_id="swimmer-uuid-123",
            athlete_id="12345",
        )
        assert workout is not None
        assert workout.swimmer_id == "swimmer-uuid-123"
        assert workout.distance == 100
        assert workout.stroke == "free"
        assert workout.time_result == "52.34"
        assert workout.result_units == "LCM"
        assert workout.performed_on == "2024-11-12"
        assert workout.meet_city == "Budapest"
        assert workout.meet_name == "World Cup"
        assert workout.source == "swimrankings"
        assert workout.reaction_time is None
        assert workout.has_splits_available is None
        assert "12345" in workout.swimrankings_result_id
        assert "World Cup" in workout.swimrankings_result_id

    def test_scm_course(self):
        race_result = RaceResult(
            event="50m Backstroke",
            course="SCM",
            time="25.95",
            date="1 Dec 2024",
            city="Toronto",
            meet="Nationals",
        )
        workout = RaceResultConverter.convert(race_result, "sid", "aid")
        assert workout.result_units == "SCM"
        assert workout.distance == 50
        assert workout.stroke == "back"

    def test_unparseable_event_returns_none(self):
        race_result = RaceResult(event="garbage", course="LCM", time="1:00.00")
        result = RaceResultConverter.convert(race_result, "sid", "aid")
        assert result is None


class TestConvertBatch:
    def test_skips_invalid_and_converts_valid(self):
        results = [
            RaceResult(event="100m Freestyle", course="LCM", time="52.34",
                       date="12 Nov 2024", city="Budapest", meet="WC"),
            RaceResult(event="garbage", course="LCM", time="1:00.00"),
            RaceResult(event="200m Backstroke", course="SCM", time="2:05.00",
                       date="1 Dec 2024", city="Toronto", meet="Nats"),
        ]
        workouts = RaceResultConverter.convert_batch(results, "sid", "aid")
        assert len(workouts) == 2
        assert workouts[0].distance == 100
        assert workouts[1].distance == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /app && python -m pytest worker/tests/test_converter.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'worker.converter'`

- [ ] **Step 3: Write the converter implementation**

Create `worker/converter.py`:

```python
"""
Converter: RaceResult (swim-scraper) -> WorkoutResult (worker domain model).

Handles date parsing, event name parsing, stroke mapping, and dedup ID synthesis.
"""

import logging
from datetime import datetime
from typing import Optional, Tuple, List

from worker.models import WorkoutResult
from worker.constants import get_stroke_enum

logger = logging.getLogger("converter")


class RaceResultConverter:
    """Converts swim-scraper RaceResult objects to worker WorkoutResult objects."""

    @staticmethod
    def parse_date(date_str) -> str:
        """Parse date string to ISO format (YYYY-MM-DD).

        Handles multiple formats and non-breaking spaces.
        Migrated from worker/sync/services/result_converter.py.
        """
        if not date_str or not str(date_str).strip():
            return ""

        normalized = str(date_str).strip().replace("\xa0", " ").replace("  ", " ")

        formats = [
            "%d %b %Y",   # "22 Nov 2024"
            "%d %B %Y",   # "22 November 2024"
            "%d/%m/%Y",   # "22/11/2024"
            "%d-%m-%Y",   # "22-11-2024"
            "%d.%m.%Y",   # "22.11.2024"
            "%Y-%m-%d",   # "2024-11-22"
        ]

        for fmt in formats:
            try:
                return datetime.strptime(normalized, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue

        logger.warning(f"Could not parse date '{date_str}', returning normalized")
        return normalized

    @staticmethod
    def parse_event(event_name: str) -> Optional[Tuple[int, str]]:
        """Parse event name into (distance, stroke_enum).

        Handles both "100m Freestyle" and "100 Freestyle" formats.

        Returns:
            (distance, stroke_enum) tuple, or None if unparseable.
        """
        if not event_name or not event_name.strip():
            return None

        parts = event_name.strip().split(None, 1)
        if len(parts) < 2:
            return None

        try:
            distance = int(parts[0].rstrip("m"))
        except ValueError:
            return None

        stroke_name = parts[1]
        stroke_enum = get_stroke_enum(stroke_name)
        if not stroke_enum:
            return None

        return distance, stroke_enum

    # Mapping from swim-scraper Stroke enum values to worker stroke enums
    _STROKE_VALUE_MAP = {
        "Freestyle": "free",
        "Backstroke": "back",
        "Breaststroke": "breast",
        "Butterfly": "fly",
        "Medley": "im",
    }

    @staticmethod
    def synthesize_result_id(
        athlete_id: str,
        date: str,
        distance: int,
        stroke: str,
        course: str,
        time: str,
        meet: str,
    ) -> str:
        """Synthesize a unique dedup key for a race result.

        Includes meet name to avoid collisions from prelims/finals
        with identical times on the same day.
        """
        return f"{athlete_id}_{date}_{distance}_{stroke}_{course}_{time}_{meet}"

    @staticmethod
    def convert(race_result, swimmer_id: str, athlete_id: str) -> Optional[WorkoutResult]:
        """Convert a single RaceResult to a WorkoutResult.

        Uses the swim-scraper's pre-computed stroke enum when available,
        falling back to event name parsing. Skips UNKNOWN strokes.

        Args:
            race_result: swim-scraper RaceResult object.
            swimmer_id: Database swimmer UUID.
            athlete_id: SwimRankings athlete ID string.

        Returns:
            WorkoutResult or None if the result can't be parsed.
        """
        # Use swim-scraper's pre-computed stroke (avoids double-parsing)
        stroke = None
        if race_result.stroke is not None:
            stroke_value = race_result.stroke.value if hasattr(race_result.stroke, "value") else str(race_result.stroke)
            if stroke_value == "Unknown":
                logger.warning(f"Skipping unknown stroke event: {race_result.event}")
                return None
            stroke = RaceResultConverter._STROKE_VALUE_MAP.get(stroke_value)

        # Parse distance from event name
        parsed = RaceResultConverter.parse_event(race_result.event)
        if parsed is None:
            logger.warning(f"Skipping unparseable event: {race_result.event}")
            return None

        distance = parsed[0]
        if stroke is None:
            stroke = parsed[1]  # Fallback to parsed stroke
        performed_on = RaceResultConverter.parse_date(race_result.date)
        course = race_result.course  # Already "LCM" or "SCM" from swim-scraper parser

        result_id = RaceResultConverter.synthesize_result_id(
            athlete_id=athlete_id,
            date=performed_on,
            distance=distance,
            stroke=stroke,
            course=course,
            time=race_result.time,
            meet=race_result.meet or "",
        )

        return WorkoutResult(
            swimmer_id=swimmer_id,
            distance=distance,
            stroke=stroke,
            time_result=race_result.time,
            result_units=course,
            performed_on=performed_on,
            meet_name=race_result.meet or None,
            meet_city=race_result.city or None,
            meet_nation=None,
            source="swimrankings",
            swimrankings_result_id=result_id,
            reaction_time=None,
            activity="swim",
            equipment="none",
            has_splits_available=None,
        )

    @staticmethod
    def convert_batch(
        race_results: list,
        swimmer_id: str,
        athlete_id: str,
    ) -> List[WorkoutResult]:
        """Convert a list of RaceResults, skipping unparseable ones."""
        workouts = []
        skipped = 0
        for rr in race_results:
            workout = RaceResultConverter.convert(rr, swimmer_id, athlete_id)
            if workout is not None:
                workouts.append(workout)
            else:
                skipped += 1

        if skipped:
            logger.warning(f"Skipped {skipped}/{len(race_results)} unparseable results")

        return workouts
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /app && python -m pytest worker/tests/test_converter.py -v
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add worker/converter.py worker/tests/test_converter.py worker/tests/conftest.py
git commit -m "feat: add RaceResultConverter for swim-scraper integration (TDD)"
```

---

## Task 3: Write the lazy singleton client manager (TDD)

**Files:**
- Create: `worker/client.py`
- Create: `worker/tests/test_client.py`

- [ ] **Step 1: Write failing tests for the client manager**

Create `worker/tests/test_client.py`:

```python
"""Tests for SwimRankingsClientManager."""

import pytest
from unittest.mock import patch, MagicMock


class TestSwimRankingsClientManager:
    def setup_method(self):
        """Reset singleton before each test."""
        from worker.client import SwimRankingsClientManager
        SwimRankingsClientManager._cleanup()

    def test_get_client_creates_instance(self):
        from worker.client import SwimRankingsClientManager

        with patch("worker.client.SwimRankings") as MockSR:
            mock_instance = MagicMock()
            mock_instance.page.title = "SwimRankings"
            MockSR.return_value.start.return_value = mock_instance

            client = SwimRankingsClientManager.get_client()
            assert client is mock_instance
            MockSR.return_value.start.assert_called_once()

    def test_get_client_reuses_existing(self):
        from worker.client import SwimRankingsClientManager

        with patch("worker.client.SwimRankings") as MockSR:
            mock_instance = MagicMock()
            mock_instance.page.title = "SwimRankings"
            MockSR.return_value.start.return_value = mock_instance

            client1 = SwimRankingsClientManager.get_client()
            client2 = SwimRankingsClientManager.get_client()
            assert client1 is client2
            # start() should only be called once
            assert MockSR.return_value.start.call_count == 1

    def test_get_client_recreates_if_dead(self):
        from worker.client import SwimRankingsClientManager

        with patch("worker.client.SwimRankings") as MockSR:
            mock_dead = MagicMock()
            mock_dead.page.title = property(side_effect=Exception("browser crashed"))
            mock_alive = MagicMock()
            mock_alive.page.title = "SwimRankings"

            # First call returns dead browser, second returns alive
            MockSR.return_value.start.side_effect = [mock_dead, mock_alive]

            client1 = SwimRankingsClientManager.get_client()
            # Simulate crash — _is_alive will fail
            type(client1.page).title = property(side_effect=Exception("crashed"))

            client2 = SwimRankingsClientManager.get_client()
            assert client2 is mock_alive
            assert MockSR.return_value.start.call_count == 2

    def test_cleanup_closes_browser(self):
        from worker.client import SwimRankingsClientManager

        with patch("worker.client.SwimRankings") as MockSR:
            mock_instance = MagicMock()
            mock_instance.page.title = "SwimRankings"
            MockSR.return_value.start.return_value = mock_instance

            SwimRankingsClientManager.get_client()
            SwimRankingsClientManager._cleanup()

            mock_instance.close.assert_called_once()
            assert SwimRankingsClientManager._instance is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /app && python -m pytest worker/tests/test_client.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'worker.client'`

- [ ] **Step 3: Write the client manager implementation**

Create `worker/client.py`:

```python
"""
Lazy singleton manager for the SwimRankings DrissionPage client.

The browser is created on first use and reused across Celery tasks.
If the browser crashes, it is automatically recreated on next access.
"""

import sys
import os
import logging

# Add swim-scraper to path so swimrankings package is importable
_scraper_path = os.path.join(os.path.dirname(__file__), "swim-scraper")
if _scraper_path not in sys.path:
    sys.path.insert(0, _scraper_path)

from swimrankings import SwimRankings
from worker.config import WorkerConfig as config

logger = logging.getLogger("client")


class SwimRankingsClientManager:
    """Lazy singleton for the SwimRankings browser client.

    - First call to get_client() starts the browser.
    - Subsequent calls reuse it.
    - If the browser dies, the next call recreates it.
    """

    _instance: SwimRankings | None = None

    @classmethod
    def get_client(cls) -> SwimRankings:
        """Get or create the SwimRankings client."""
        if cls._instance is None or not cls._is_alive():
            cls._cleanup()
            logger.info("Creating new SwimRankings client...")
            cls._instance = SwimRankings(
                email=config.SWIMRANKINGS_EMAIL,
                password=config.SWIMRANKINGS_PASSWORD,
                browser_path=config.CHROMIUM_PATH,
                profile_dir=config.BROWSER_PROFILE_DIR,
                cf_timeout=config.CF_TIMEOUT,
            ).start()
            logger.info("SwimRankings client started successfully.")
        return cls._instance

    @classmethod
    def _is_alive(cls) -> bool:
        """Probe the browser to verify it's responsive."""
        try:
            _ = cls._instance.page.title
            return True
        except Exception:
            return False

    @classmethod
    def _cleanup(cls):
        """Close the browser and clear the singleton."""
        if cls._instance is not None:
            try:
                cls._instance.close()
            except Exception:
                pass
            cls._instance = None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /app && python -m pytest worker/tests/test_client.py -v
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add worker/client.py worker/tests/test_client.py
git commit -m "feat: add SwimRankingsClientManager lazy singleton (TDD)"
```

---

## Task 4: Update config.py — remove old config, add new

**Files:**
- Modify: `worker/config.py`

- [ ] **Step 1: Rewrite config.py**

Replace the contents of `worker/config.py` with:

```python
"""
Configuration management for worker service.
"""

import os


class WorkerConfig:
    """Configuration for worker service."""

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Task limits
    TASK_SOFT_TIME_LIMIT: int = int(os.getenv("TASK_SOFT_TIME_LIMIT", "3600"))
    TASK_TIME_LIMIT: int = int(os.getenv("TASK_TIME_LIMIT", "7200"))

    # SwimRankings credentials
    SWIMRANKINGS_EMAIL: str = os.getenv("SWIMRANKINGS_EMAIL", "")
    SWIMRANKINGS_PASSWORD: str = os.getenv("SWIMRANKINGS_PASSWORD", "")

    # DrissionPage / Chromium
    CHROMIUM_PATH: str = os.getenv("CHROMIUM_PATH", "/usr/bin/chromium")
    BROWSER_PROFILE_DIR: str = os.getenv("BROWSER_PROFILE_DIR", "/tmp/swimrankings_profile")
    CF_TIMEOUT: int = int(os.getenv("CF_TIMEOUT", "90"))

    # Sync freshness — results synced within this window are skipped
    SYNC_FRESHNESS_HOURS: int = int(os.getenv("SYNC_FRESHNESS_HOURS", "0"))

    @classmethod
    def validate(cls) -> None:
        """Validate required configuration."""
        if not cls.DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable is required")


# Validate on import
WorkerConfig.validate()
```

- [ ] **Step 2: Verify config imports work**

```bash
cd /app && python -c "from worker.config import WorkerConfig; print(WorkerConfig.CHROMIUM_PATH)"
```

Expected: `/usr/bin/chromium`

- [ ] **Step 3: Commit**

```bash
git add worker/config.py
git commit -m "refactor: simplify WorkerConfig — remove fetcher/proxy/splits, add DrissionPage config"
```

---

## Task 5: Clean up worker/models.py — remove unused split-related models

**Files:**
- Modify: `worker/models.py`

- [ ] **Step 1: Remove unused dataclasses**

Remove `RaceSplit`, `AttemptData`, and `ResultWithSplits` from `worker/models.py`. These were used by the old pipeline. Keep: `WorkoutResult`, `SyncMode`, `SwimmerEvent`, `SyncProgress`, `SyncResult`, `SyncStatusUpdate`, and the type aliases.

The updated file should contain:

```python
"""
Domain models and types for worker service.
"""

from dataclasses import dataclass
from typing import Optional, Literal
from enum import Enum

# Type definitions
SyncStatus = Literal["pending", "in_progress", "completed", "failed", "cancelled"]
StrokeType = Literal["free", "back", "breast", "fly", "im"]
CourseType = Literal["LCM", "SCM"]


class SyncMode(Enum):
    NO_HISTORY = "no_history"
    PARTIAL_HISTORY = "partial_history"
    FULL_HISTORY = "full_history"


@dataclass
class WorkoutResult:
    """Represents a workout result to be inserted into database."""

    swimmer_id: str
    distance: int
    stroke: StrokeType
    time_result: str
    result_units: CourseType
    performed_on: str
    meet_name: Optional[str] = None
    meet_city: Optional[str] = None
    meet_nation: Optional[str] = None
    source: str = "swimrankings"
    swimrankings_result_id: Optional[str] = None
    reaction_time: Optional[float] = None
    activity: str = "swim"
    equipment: str = "none"
    has_splits_available: Optional[bool] = None


@dataclass
class SwimmerEvent:
    """Represents a swimming event configuration."""

    name: str
    distance: int
    stroke: StrokeType
    style_id: str


@dataclass
class SyncProgress:
    """Represents synchronization progress."""

    events_processed: int = 0
    results_imported: int = 0
    results_skipped: int = 0
    errors: int = 0
    current_event: Optional[str] = None


@dataclass
class SyncResult:
    """Represents the final result of a sync operation."""

    swimmer_id: str
    external_link_id: str
    events_processed: int
    results_imported: int
    results_skipped: int
    errors: int
    success: bool
    error_message: Optional[str] = None


@dataclass
class SyncStatusUpdate:
    """Represents a sync status update for the database."""

    sync_status: SyncStatus
    last_sync_started_at: Optional[str] = None
    last_sync_completed_at: Optional[str] = None
    sync_error: Optional[str] = None
    sync_progress: Optional[int] = None
    sync_total: Optional[int] = None
    results_count: Optional[int] = None
```

- [ ] **Step 2: Verify models still import correctly**

```bash
cd /app && python -c "from worker.models import WorkoutResult, SyncResult, SyncStatusUpdate; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/models.py
git commit -m "refactor: remove unused RaceSplit/AttemptData/ResultWithSplits from worker models"
```

---

## Task 6: Rewrite sync_tasks.py (BEFORE deleting old code)

**Files:**
- Modify: `worker/sync_tasks.py`

This is the core integration task. The three sync tasks keep their Celery signatures but get rewritten to use `SwimRankingsClientManager` + `RaceResultConverter` instead of `SwimRankingsScraper` + `SyncOrchestrator`.

- [ ] **Step 1: Rewrite sync_tasks.py**

Replace the full contents of `worker/sync_tasks.py`:

```python
"""
Celery tasks for SwimRankings data synchronization.

Uses the swim-scraper DrissionPage client (lazy singleton) to fetch data
and the RaceResultConverter to map results for DB insertion.
"""

import time
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from celery import Task
from sqlalchemy import text

from worker.database import get_db
from worker.celery_app import celery_app
from worker.services.database_service import DatabaseService
from worker.services.bulk_sync_service import BulkSyncService
from worker.client import SwimRankingsClientManager
from worker.converter import RaceResultConverter
from worker.models import SyncStatusUpdate, SyncResult
from worker.config import WorkerConfig

logger = logging.getLogger("sync_tasks")


class SyncTask(Task):
    """Custom task class that updates DB on failure."""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        print(f"[SYNC TASK] Task {task_id} failed: {exc}")
        try:
            external_link_id = kwargs.get("external_link_id")
            if external_link_id:
                session = get_db()
                try:
                    db_service = DatabaseService(session)
                    db_service.update_sync_status(
                        external_link_id,
                        SyncStatusUpdate(
                            sync_status="failed",
                            last_sync_completed_at=datetime.now(timezone.utc).isoformat(),
                            sync_error=f"{type(exc).__name__}: {str(exc)}"[:500],
                        ),
                    )
                finally:
                    session.close()
        except Exception as update_error:
            print(f"[SYNC TASK] Failed to update error status: {update_error}")


def _sync_single_swimmer(
    db_service: DatabaseService,
    swimmer_id: str,
    external_link_id: str,
    external_id: str,
    force: bool = False,
) -> SyncResult:
    """Core sync logic for one swimmer.

    1. Freshness check (skip if recently synced, unless force=True)
    2. Fetch full history via swim-scraper client
    3. Convert RaceResults -> WorkoutResults
    4. Deduplicate against DB
    5. Bulk insert new results
    6. Update sync status
    """
    # -- Freshness check --
    if not force:
        last_sync = db_service.get_last_sync_time(external_link_id)
        if last_sync is not None:
            if hasattr(last_sync, "tzinfo") and last_sync.tzinfo is None:
                last_sync = last_sync.replace(tzinfo=timezone.utc)
            cutoff = datetime.now(timezone.utc) - timedelta(hours=WorkerConfig.SYNC_FRESHNESS_HOURS)
            if last_sync > cutoff:
                logger.info(f"Skipping swimmer {swimmer_id} — synced {last_sync.isoformat()}")
                return SyncResult(
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    events_processed=0,
                    results_imported=0,
                    results_skipped=0,
                    errors=0,
                    success=True,
                    error_message="Skipped (recently synced)",
                )

    # -- Mark as in_progress --
    db_service.update_sync_status(
        external_link_id,
        SyncStatusUpdate(
            sync_status="in_progress",
            last_sync_started_at=datetime.now(timezone.utc).isoformat(),
            sync_error=None,
        ),
    )

    # -- Fetch history --
    client = SwimRankingsClientManager.get_client()
    history = client.history(external_id)
    race_results = history.results

    logger.info(
        f"Fetched {len(race_results)} results for athlete {external_id} "
        f"({history.athlete_name})"
    )

    # -- Convert --
    workout_results = RaceResultConverter.convert_batch(race_results, swimmer_id, external_id)
    events_processed = len(set(rr.event for rr in race_results))

    if not workout_results:
        db_service.update_sync_status(
            external_link_id,
            SyncStatusUpdate(
                sync_status="completed",
                last_sync_completed_at=datetime.now(timezone.utc).isoformat(),
                sync_error=None,
                results_count=0,
            ),
        )
        return SyncResult(
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            events_processed=events_processed,
            results_imported=0,
            results_skipped=len(race_results) - len(workout_results),
            errors=0,
            success=True,
        )

    # -- Deduplicate --
    sr_ids = [w.swimrankings_result_id for w in workout_results if w.swimrankings_result_id]
    existing = db_service.check_existing_results(sr_ids, swimmer_id)
    new_results = [w for w in workout_results if w.swimrankings_result_id not in existing]
    skipped = len(workout_results) - len(new_results)

    # -- Insert --
    if new_results:
        db_service.bulk_insert_workout_results(new_results)
        logger.info(f"Inserted {len(new_results)} new results for swimmer {swimmer_id}")

    # -- Update status --
    db_service.update_sync_status(
        external_link_id,
        SyncStatusUpdate(
            sync_status="completed",
            last_sync_completed_at=datetime.now(timezone.utc).isoformat(),
            sync_error=None,
            sync_progress=events_processed,
            sync_total=events_processed,
        ),
    )

    return SyncResult(
        swimmer_id=swimmer_id,
        external_link_id=external_link_id,
        events_processed=events_processed,
        results_imported=len(new_results),
        results_skipped=skipped,
        errors=0,
        success=True,
    )


@celery_app.task(bind=True, base=SyncTask, name="worker.sync_tasks.sync_swimmer_task")
def sync_swimmer_task(
    self,
    swimmer_id: str,
    external_link_id: str,
    external_id: str,
) -> dict:
    """Sync SwimRankings data for a single swimmer.

    Note: limit_events was removed — swim-scraper fetches full history in one call.
    """
    task_start = time.time()
    session = get_db()
    try:
        db_service = DatabaseService(session)
        result = _sync_single_swimmer(db_service, swimmer_id, external_link_id, external_id)
        elapsed = time.time() - task_start
        logger.info(f"sync_swimmer_task completed in {elapsed:.2f}s for swimmer {swimmer_id}")
        return {
            "swimmer_id": result.swimmer_id,
            "external_link_id": result.external_link_id,
            "events_processed": result.events_processed,
            "results_imported": result.results_imported,
            "results_skipped": result.results_skipped,
            "errors": result.errors,
            "success": result.success,
            "error_message": result.error_message,
        }
    finally:
        session.close()


@celery_app.task(bind=True, name="worker.sync_tasks.sync_squad_swimmers_task")
def sync_squad_swimmers_task(
    self,
    squad_id: str,
    triggered_by_user_id: str,
    job_id: Optional[str] = None,
) -> dict:
    """Sync SwimRankings data for all swimmers in a squad."""
    task_start = time.time()
    session = get_db()
    try:
        bulk_sync_service = BulkSyncService(session)
        swimmer_links = bulk_sync_service.get_squad_swimrankings_links(squad_id)
        total_swimmers = len(swimmer_links)

        if total_swimmers == 0:
            if job_id:
                bulk_sync_service.update_job_status(
                    job_id, "failed", error_message="No swimmers with SwimRankings links in this squad"
                )
            return {"success": False, "error": "No swimmers with SwimRankings links in this squad"}

        if not job_id:
            job_id = bulk_sync_service.create_bulk_sync_job(
                triggered_by_user_id=triggered_by_user_id, total_swimmers=total_swimmers
            )
        bulk_sync_service.update_job_status(job_id, "in_progress")

        db_service = DatabaseService(session)

        for link in swimmer_links:
            swimmer_id = link["swimmer_id"]
            external_link_id = link["id"]
            external_id = link["external_id"]
            swimmer_name = f"{link['first_name']} {link['last_name']}"

            try:
                # force=True: squad sync always syncs all swimmers (no freshness check)
                sync_result = _sync_single_swimmer(
                    db_service, swimmer_id, external_link_id, external_id, force=True
                )
                if sync_result.success:
                    logger.info(
                        f"Squad sync success: {swimmer_name} "
                        f"(events={sync_result.events_processed}, results={sync_result.results_imported})"
                    )
                else:
                    error_message = sync_result.error_message or "Unknown error"
                    logger.warning(f"Squad sync failure: {swimmer_name} - {error_message}")
                    bulk_sync_service.record_failure(
                        job_id=job_id,
                        swimmer_id=swimmer_id,
                        external_link_id=external_link_id,
                        swimmer_name=swimmer_name,
                        error_message=error_message,
                    )
                bulk_sync_service.increment_job_progress(job_id, succeeded=sync_result.success)
                time.sleep(random.uniform(1.0, 2.0))

            except Exception as e:
                error_msg = f"Exception during sync: {str(e)}"
                logger.error(f"Squad sync exception: {swimmer_name} - {error_msg}")
                bulk_sync_service.record_failure(
                    job_id=job_id,
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    swimmer_name=swimmer_name,
                    error_message=error_msg,
                )
                bulk_sync_service.increment_job_progress(job_id, succeeded=False)

        bulk_sync_service.update_job_status(job_id, "completed")
        job_status = bulk_sync_service.get_job_status(job_id)
        succeeded_count = job_status["swimmers_succeeded"] if job_status else 0
        failed_count = job_status["swimmers_failed"] if job_status else 0
        elapsed = time.time() - task_start

        logger.info(
            f"sync_squad_swimmers_task completed in {elapsed:.2f}s "
            f"(job_id={job_id}, succeeded={succeeded_count}, failed={failed_count})"
        )

        return {
            "success": True,
            "job_id": job_id,
            "total_swimmers": total_swimmers,
            "message": f"Squad sync completed: {succeeded_count} succeeded, {failed_count} failed",
        }

    except Exception as e:
        return {"success": False, "error": f"Failed to start squad sync: {str(e)}"}
    finally:
        session.close()


@celery_app.task(bind=True, name="worker.sync_tasks.bulk_sync_all_swimmers_task")
def bulk_sync_all_swimmers_task(
    self,
    triggered_by_user_id: str,
    force_update: bool = False,
    job_id: Optional[str] = None,
) -> dict:
    """Sync all SwimRankings swimmers in bulk."""
    bulk_start_time = time.time()
    logger.info(f"Starting bulk sync of all swimmers (force_update={force_update})")

    session = get_db()
    try:
        bulk_sync_service = BulkSyncService(session)
        swimmer_links = bulk_sync_service.get_all_swimrankings_links()
        total_swimmers = len(swimmer_links)

        if total_swimmers == 0:
            if job_id:
                bulk_sync_service.update_job_status(
                    job_id, "failed", error_message="No swimmers with SwimRankings links"
                )
            return {"success": False, "error": "No swimmers found with SwimRankings links"}

        if not job_id:
            job_id = bulk_sync_service.create_bulk_sync_job(
                triggered_by_user_id=triggered_by_user_id, total_swimmers=total_swimmers
            )
        else:
            bulk_sync_service.update_job_total_swimmers(job_id, total_swimmers)

        bulk_sync_service.update_job_status(job_id, "in_progress")
        db_service = DatabaseService(session)

        for link in swimmer_links:
            swimmer_id = link["swimmer_id"]
            external_link_id = link["id"]
            external_id = link["external_id"]
            swimmer_name = f"{link['first_name']} {link['last_name']}"

            try:
                sync_result = _sync_single_swimmer(
                    db_service, swimmer_id, external_link_id, external_id, force=force_update
                )

                if sync_result.success:
                    logger.info(
                        f"BULK SYNC SUCCESS — {swimmer_name}: "
                        f"events={sync_result.events_processed}, imported={sync_result.results_imported}"
                    )
                else:
                    error_message = sync_result.error_message or "Unknown error"
                    logger.warning(f"BULK SYNC FAILURE — {swimmer_name}: {error_message}")
                    bulk_sync_service.record_failure(
                        job_id=job_id,
                        swimmer_id=swimmer_id,
                        external_link_id=external_link_id,
                        swimmer_name=swimmer_name,
                        error_message=error_message,
                    )

                bulk_sync_service.increment_job_progress(job_id, succeeded=sync_result.success)
                time.sleep(random.uniform(1.0, 2.0))

            except Exception as e:
                error_msg = f"Exception during sync: {str(e)}"
                logger.error(f"BULK SYNC FAILURE — {swimmer_name}: {error_msg}")
                bulk_sync_service.record_failure(
                    job_id=job_id,
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    swimmer_name=swimmer_name,
                    error_message=error_msg,
                )
                bulk_sync_service.increment_job_progress(job_id, succeeded=False)

        bulk_sync_service.update_job_status(job_id, "completed")
        job_status = bulk_sync_service.get_job_status(job_id)
        succeeded_count = job_status["swimmers_succeeded"] if job_status else 0
        failed_count = job_status["swimmers_failed"] if job_status else 0
        elapsed = time.time() - bulk_start_time

        logger.info(
            f"bulk_sync_all_swimmers_task completed in {elapsed:.2f}s "
            f"(job_id={job_id}, succeeded={succeeded_count}, failed={failed_count})"
        )

        return {
            "success": True,
            "job_id": job_id,
            "total_swimmers": total_swimmers,
            "message": f"Bulk sync completed: {succeeded_count} succeeded, {failed_count} failed",
        }

    except Exception as e:
        return {"success": False, "error": f"Failed to start bulk sync: {str(e)}"}
    finally:
        session.close()


@celery_app.task(name="worker.sync_tasks.cleanup_expired_tokens")
def cleanup_expired_tokens():
    """Delete revoked and expired refresh tokens."""
    db = get_db()
    try:
        result = db.execute(
            text("DELETE FROM refresh_tokens WHERE revoked = TRUE OR expires_at < NOW()")
        )
        db.commit()
        logger.info(f"Cleaned up {result.rowcount} expired/revoked refresh tokens")
    except Exception as e:
        logger.error(f"Token cleanup failed: {e}")
        db.rollback()
    finally:
        db.close()
```

**Key changes from original:**
- Removed `asyncio.run()` — swim-scraper is synchronous (DrissionPage is not async)
- Removed `SwimRankingsScraper` + `SyncOrchestrator` imports → replaced with `SwimRankingsClientManager` + `RaceResultConverter`
- Extracted `_sync_single_swimmer()` helper to share between all 3 tasks
- Added freshness check with `force` parameter (used by `bulk_sync_all_swimmers_task` via `force_update`)
- Removed `update_bulk_sync_progress` callback task (was only used by old parallel pattern)
- Removed verbose `print("=" * 100)` blocks — replaced with structured `logger` calls

- [ ] **Step 2: Verify the rewritten module imports**

```bash
cd /app && python -c "from worker.sync_tasks import sync_swimmer_task, sync_squad_swimmers_task, bulk_sync_all_swimmers_task, cleanup_expired_tokens; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/sync_tasks.py
git commit -m "feat: rewrite sync tasks to use swim-scraper client + converter"
```

---

## Task 7: Delete old pipeline directories

**Files:**
- Delete: `worker/fetchers/` (entire directory)
- Delete: `worker/scrapers/` (entire directory)
- Delete: `worker/parsers/` (entire directory)
- Delete: `worker/sync/` (entire directory)
- Delete: `worker/utils/` (entire directory — only contains `__init__.py` + `distance_helper.py`)

- [ ] **Step 1: Remove all dead pipeline code**

```bash
rm -rf worker/fetchers/
rm -rf worker/scrapers/
rm -rf worker/parsers/
rm -rf worker/sync/
rm -rf worker/utils/
```

- [ ] **Step 2: Verify no broken imports in remaining files**

```bash
cd /app && python -c "from worker.sync_tasks import sync_swimmer_task; print('OK')"
```

Expected: `OK` (sync_tasks.py no longer imports from deleted directories)

- [ ] **Step 3: Commit**

```bash
git add -A worker/fetchers/ worker/scrapers/ worker/parsers/ worker/sync/ worker/utils/
git commit -m "refactor: remove dead scraping pipeline (fetchers, scrapers, parsers, sync, utils)"
```

---

## Task 8: Update requirements.txt

**Files:**
- Modify: `worker/requirements.txt`

- [ ] **Step 1: Update dependencies**

Replace `worker/requirements.txt`:

```
celery==5.3.4
redis==5.0.1
DrissionPage>=4.0,<5.0
sqlalchemy>=2.0,<3.0
asyncpg>=0.29,<1.0
psycopg2-binary>=2.9,<3.0
python-dotenv==1.0.0
pytz==2024.1
```

**Removed:** `playwright`, `beautifulsoup4`, `lxml`, `requests`, `httpx`
**Added:** `DrissionPage`

- [ ] **Step 2: Commit**

```bash
git add worker/requirements.txt
git commit -m "chore: update worker deps — remove playwright/bs4, add DrissionPage"
```

---

## Task 9: Update Dockerfile

**Files:**
- Modify: `worker/Dockerfile`

- [ ] **Step 1: Rewrite Dockerfile**

Replace `worker/Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Install system dependencies + Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    curl \
    chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install worker requirements
COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend app package (worker imports app.infrastructure.models)
COPY backend/app /app/app

# Copy worker code (includes swim-scraper/)
COPY worker /app/worker

# Add swim-scraper to Python path
ENV PYTHONPATH=/app:/app/worker/swim-scraper

# Run Celery worker
CMD ["celery", "-A", "worker.celery_app", "worker", "--loglevel=info", "--concurrency=1", "-Q", "sync,celery"]
```

**Changes:**
- Removed Playwright apt dependencies (17 individual packages)
- Removed `playwright install chromium` (downloads browser binary)
- Added `chromium` system package
- Changed `PYTHONPATH` to include `worker/swim-scraper`
- Removed `/app/jobs` from PYTHONPATH (legacy)

- [ ] **Step 2: Commit**

```bash
git add worker/Dockerfile
git commit -m "refactor: Dockerfile — replace Playwright with Chromium + DrissionPage"
```

---

## Task 10: Update docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update worker environment variables**

In `docker-compose.yml`, replace the worker service `environment` section. Remove all fetcher/proxy/splits vars, add SwimRankings credentials:

```yaml
    environment:
      - DATABASE_URL=postgresql+asyncpg://aquilus:${POSTGRES_PASSWORD:-aquilus}@postgres:5432/aquilus
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/0
      - SWIMRANKINGS_EMAIL=${SWIMRANKINGS_EMAIL}
      - SWIMRANKINGS_PASSWORD=${SWIMRANKINGS_PASSWORD}
      - CHROMIUM_PATH=/usr/bin/chromium
      - BROWSER_PROFILE_DIR=/tmp/swimrankings_profile
      - AUTO_GEN_DAYS_AHEAD=${AUTO_GEN_DAYS_AHEAD}
      - AUTO_GEN_SCHEDULE_HOUR=${AUTO_GEN_SCHEDULE_HOUR}
      - AUTO_GEN_SCHEDULE_MINUTE=${AUTO_GEN_SCHEDULE_MINUTE}
```

**Removed from worker:** `USE_OXYLABS_PROXY`, `OXYLABS_USERNAME`, `OXYLABS_PASSWORD`, `OXYLABS_COUNTRY`, `FETCH_MODE`, `SCRAPERAPI_KEY`, `SCRAPER_MAX_WORKERS`, `SCRAPER_MIN_DELAY`, `SCRAPER_MAX_DELAY`, `SPLITS_MAX_WORKERS`, `GLOBAL_SPLITS_SEMAPHORE_SIZE`, `EVENT_BATCH_SIZE`, `MAX_CONCURRENT_REQUESTS`

- [ ] **Step 2: Remove Oxylabs vars from backend service**

In the backend service environment section, remove these 4 lines:

```yaml
      - USE_OXYLABS_PROXY=${USE_OXYLABS_PROXY}
      - OXYLABS_USERNAME=${OXYLABS_USERNAME}
      - OXYLABS_PASSWORD=${OXYLABS_PASSWORD}
      - OXYLABS_COUNTRY=${OXYLABS_COUNTRY}
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: update docker-compose — add SwimRankings creds, remove obsolete env vars"
```

---

## Task 11: Clean up database_service.py — remove split-heavy methods, add get_last_sync_time

**Files:**
- Modify: `worker/services/database_service.py`

- [ ] **Step 1: Remove methods that are no longer called**

The following methods in `DatabaseService` are only used by the old pipeline and can be removed:

- `bulk_insert_workout_results_with_splits` (splits pipeline)
- `bulk_insert_race_splits` (splits pipeline)
- `bulk_insert_splits_for_multiple_results` (splits pipeline)
- `update_stale_results_timestamp` (orchestrator freshness)
- `mark_results_without_splits` (splits pipeline)
- `get_swimmer_recent_results` (orchestrator 3-mode logic)
- `get_swimmer_most_recent_result_per_event` (orchestrator smart comparison)
- `get_events_checked` / `update_events_checked` (orchestrator event tracking)

Also remove the `RaceSplit` import from `worker.models` since we deleted it.

**Keep:** `update_sync_status`, `check_sync_status`, `swimmer_has_any_results`, `check_existing_results`, `get_swimmer_all_event_keys`, `get_existing_result_count`, `bulk_insert_workout_results`, `deduplicate_swimmer_results`, `_seconds_to_interval`

Update the imports at the top:

```python
from worker.models import (
    SyncStatusUpdate,
    WorkoutResult,
    SyncStatus,
)
```

(Remove `RaceSplit` from the import.)

Also remove the `RaceSplitModel` import from `app.infrastructure.models` if it's no longer referenced.

- [ ] **Step 2: Add `get_last_sync_time` method**

Add this method to `DatabaseService` (used by `_sync_single_swimmer` for freshness check):

```python
    def get_last_sync_time(self, external_link_id: str) -> Optional[datetime]:
        """Get the last completed sync time for an external link.

        Returns None if never synced.
        """
        stmt = (
            select(SwimmerExternalLink.last_sync_completed_at)
            .where(SwimmerExternalLink.id == external_link_id)
        )
        row = self.session.execute(stmt).first()
        if row is None or row[0] is None:
            return None
        return row[0]
```

Add `from datetime import datetime` to the imports if not already present.

- [ ] **Step 3: Verify the module still works**

```bash
cd /app && python -c "from worker.services.database_service import DatabaseService; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add worker/services/database_service.py
git commit -m "refactor: remove split-related methods from DatabaseService, add get_last_sync_time"
```

---

## Task 12: Verify full import chain and smoke test

**Files:** None (verification only)

- [ ] **Step 1: Verify all worker modules import cleanly**

```bash
cd /app && python -c "
from worker.celery_app import celery_app
from worker.config import WorkerConfig
from worker.database import get_db
from worker.models import WorkoutResult, SyncResult, SyncStatusUpdate
from worker.converter import RaceResultConverter
from worker.client import SwimRankingsClientManager
from worker.services.database_service import DatabaseService
from worker.services.bulk_sync_service import BulkSyncService
from worker.sync_tasks import sync_swimmer_task, sync_squad_swimmers_task, bulk_sync_all_swimmers_task, cleanup_expired_tokens
print('All imports OK')
"
```

Expected: `All imports OK`

- [ ] **Step 2: Run converter tests**

```bash
cd /app && python -m pytest worker/tests/test_converter.py worker/tests/test_client.py -v
```

Expected: All tests PASS

- [ ] **Step 3: Final commit with all verification**

```bash
git add -A
git commit -m "feat: complete swim-scraper integration — replace CloudFlare-blocked pipeline"
```
