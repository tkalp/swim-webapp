# Workout Analysis & Create Workout Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brittle regex workout parser with an LLM-powered parser, redesign the create workout page to on-demand analysis, and fix the save-as-workout flow with an inline modal.

**Architecture:** Claude Haiku (via tool_use API) extracts structured set data from any workout text format. Server-side arithmetic computes totals/breakdowns from the extracted sets. Duration estimation stays rule-based via pace tables. Regex parser is improved as fallback. Frontend switches from real-time to on-demand analysis with a new metrics card component.

**Tech Stack:** Python/FastAPI, Anthropic SDK (tool_use), Pydantic v2, React/TypeScript, TanStack React Query, Tailwind CSS, Vitest, pytest

**Spec:** `docs/superpowers/specs/2026-03-20-workout-analysis-redesign.md`

---

## File Map

### New Files (Backend)
| File | Responsibility |
|------|---------------|
| `backend/app/services/workout_llm_parser.py` | LLM-powered workout text → structured JSON via Claude Haiku tool_use |
| `backend/app/services/workout_totals.py` | Arithmetic: sum sets into totals, breakdowns, percentages |
| `backend/tests/test_workout_llm_parser.py` | Golden set (50), edge cases, determinism tests |
| `backend/tests/test_workout_totals.py` | Unit tests for arithmetic/breakdown computation |
| `backend/tests/test_workout_regression.py` | 1901-workout ChromaDB corpus sanity suite |
| `backend/tests/fixtures/golden_workouts.json` | 50 hand-verified workout fixtures |
| `backend/alembic/versions/xxxx_add_classification_to_workout_template.py` | Alembic migration for `classification` column |

### New Files (Frontend)
| File | Responsibility |
|------|---------------|
| `frontend/src/components/workout/WorkoutMetricsCard.tsx` | Displays analysis results with stroke icons, breakdowns, stale badge |
| `frontend/src/hooks/useWorkoutAnalysis.ts` | Manages analyze trigger, loading state, stale detection |
| `frontend/src/components/ai-coach/SaveWorkoutModal.tsx` | Inline modal for saving AI-generated workouts |
| `frontend/src/components/workout/__tests__/WorkoutMetricsCard.test.tsx` | Tests for metrics card |
| `frontend/src/components/ai-coach/__tests__/SaveWorkoutModal.test.tsx` | Tests for save modal |
| `frontend/src/hooks/__tests__/useWorkoutAnalysis.test.ts` | Tests for analysis hook |

### Modified Files
| File | Changes |
|------|---------|
| `backend/app/services/workout_parser.py` | Markdown stripping, prose-style distances, round notation, inline breakdowns |
| `backend/app/services/workout_analyzer.py` | Orchestrate LLM parser + fallback + totals + duration |
| `backend/app/routes/workout_analysis.py` | Updated endpoints with `parser_used` field, caching, rate limiting |
| `backend/app/routes/ai_coach_conversations.py` | New PATCH endpoint for message metadata |
| `backend/app/services/conversation_service.py` | New `update_message_metadata()` function |
| `backend/app/infrastructure/models.py` | Add `classification` column to WorkoutTemplate |
| `frontend/src/services/workoutAnalysisService.ts` | Updated types and response handling |
| `frontend/src/pages/WorkoutForm.tsx` | Full redesign — editor-first layout |
| `frontend/src/pages/WorkoutForm/hooks/useWorkoutForm.ts` | Remove real-time, add on-demand analysis |
| `frontend/src/components/ai-coach/WorkoutCard.tsx` | Save button opens modal instead of navigating |
| `frontend/src/pages/AICoachPage.tsx` | Remove navigation-based save, add modal state |

### Removed Files
| File | Reason |
|------|--------|
| `frontend/src/components/workout/RealtimeWorkoutAnalyzer.tsx` | Replaced by on-demand WorkoutMetricsCard |
| `frontend/src/pages/WorkoutForm/components/EditMetricModal.tsx` | Metrics come from analysis, not manual override |

---

## Task 1: Workout Totals Service (Pure Arithmetic)

**Files:**
- Create: `backend/app/services/workout_totals.py`
- Test: `backend/tests/test_workout_totals.py`

This is a pure-function module with no external dependencies. Takes a list of parsed sections/sets and computes totals, breakdowns, percentages.

- [ ] **Step 1: Write failing tests for `compute_totals`**

```python
# backend/tests/test_workout_totals.py
import pytest
from app.services.workout_totals import compute_totals


def test_compute_totals_basic():
    """Single section with two sets."""
    sections = [
        {
            "name": "Warm-up",
            "sets": [
                {"reps": 1, "distance": 400, "stroke": "freestyle", "activity": "swim", "energy_zone": "en1"},
                {"reps": 4, "distance": 50, "stroke": "choice", "activity": "kick", "energy_zone": "en1"},
            ],
        }
    ]
    result = compute_totals(sections)
    assert result["total_meters"] == 600  # 400 + 4*50
    assert result["total_sets"] == 2
    assert result["stroke_breakdown"]["freestyle"]["meters"] == 400
    assert result["stroke_breakdown"]["choice"]["meters"] == 200
    assert result["activity_breakdown"]["swim"]["meters"] == 400
    assert result["activity_breakdown"]["kick"]["meters"] == 200


def test_compute_totals_percentages():
    """Percentages should sum to 100."""
    sections = [
        {
            "name": "Main",
            "sets": [
                {"reps": 4, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en2"},
                {"reps": 4, "distance": 100, "stroke": "backstroke", "activity": "swim", "energy_zone": "en2"},
            ],
        }
    ]
    result = compute_totals(sections)
    assert result["stroke_breakdown"]["freestyle"]["percentage"] == 50.0
    assert result["stroke_breakdown"]["backstroke"]["percentage"] == 50.0


def test_compute_totals_multi_section():
    """Totals span all sections."""
    sections = [
        {"name": "Warm-up", "sets": [{"reps": 1, "distance": 400, "stroke": "freestyle", "activity": "swim", "energy_zone": "en1"}]},
        {"name": "Main", "sets": [{"reps": 8, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en3"}]},
        {"name": "Cool-down", "sets": [{"reps": 1, "distance": 200, "stroke": "choice", "activity": "swim", "energy_zone": "en1"}]},
    ]
    result = compute_totals(sections)
    assert result["total_meters"] == 1400  # 400 + 800 + 200
    assert result["total_sets"] == 3


def test_compute_totals_empty():
    """Empty sections returns zeros."""
    result = compute_totals([])
    assert result["total_meters"] == 0
    assert result["total_sets"] == 0
    assert result["stroke_breakdown"] == {}
    assert result["activity_breakdown"] == {}
    assert result["energy_zone_breakdown"] == {}


def test_compute_totals_all_strokes():
    """Each stroke type tracked separately."""
    sections = [
        {
            "name": "Main",
            "sets": [
                {"reps": 1, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en2"},
                {"reps": 1, "distance": 100, "stroke": "backstroke", "activity": "swim", "energy_zone": "en2"},
                {"reps": 1, "distance": 100, "stroke": "breaststroke", "activity": "swim", "energy_zone": "en2"},
                {"reps": 1, "distance": 100, "stroke": "butterfly", "activity": "swim", "energy_zone": "en2"},
                {"reps": 1, "distance": 100, "stroke": "im", "activity": "swim", "energy_zone": "en2"},
                {"reps": 1, "distance": 100, "stroke": "choice", "activity": "swim", "energy_zone": "en2"},
            ],
        }
    ]
    result = compute_totals(sections)
    assert result["total_meters"] == 600
    for stroke in ["freestyle", "backstroke", "breaststroke", "butterfly", "im", "choice"]:
        assert result["stroke_breakdown"][stroke]["meters"] == 100


def test_compute_totals_all_activities():
    """Each activity type tracked separately."""
    sections = [
        {
            "name": "Main",
            "sets": [
                {"reps": 1, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en2"},
                {"reps": 1, "distance": 100, "stroke": "freestyle", "activity": "kick", "energy_zone": "en2"},
                {"reps": 1, "distance": 100, "stroke": "freestyle", "activity": "pull", "energy_zone": "en2"},
                {"reps": 1, "distance": 100, "stroke": "freestyle", "activity": "drill", "energy_zone": "en2"},
            ],
        }
    ]
    result = compute_totals(sections)
    assert result["total_meters"] == 400
    for activity in ["swim", "kick", "pull", "drill"]:
        assert result["activity_breakdown"][activity]["meters"] == 100


def test_compute_totals_energy_zones():
    """Energy zones tracked correctly."""
    sections = [
        {
            "name": "Main",
            "sets": [
                {"reps": 4, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en1"},
                {"reps": 4, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en3"},
                {"reps": 4, "distance": 50, "stroke": "freestyle", "activity": "swim", "energy_zone": "sprint"},
            ],
        }
    ]
    result = compute_totals(sections)
    assert result["energy_zone_breakdown"]["en1"]["meters"] == 400
    assert result["energy_zone_breakdown"]["en3"]["meters"] == 400
    assert result["energy_zone_breakdown"]["sprint"]["meters"] == 200
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_workout_totals.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.workout_totals'`

- [ ] **Step 3: Implement `compute_totals`**

```python
# backend/app/services/workout_totals.py
"""Server-side arithmetic for workout analysis.

Takes parsed sections/sets from any parser (LLM or regex) and computes
totals, breakdowns, and percentages. No external dependencies.
"""

from typing import Any

# Valid enum values
VALID_STROKES = {"freestyle", "backstroke", "breaststroke", "butterfly", "im", "choice"}
VALID_ACTIVITIES = {"swim", "kick", "pull", "drill"}
VALID_ENERGY_ZONES = {"en1", "en2", "en3", "en4", "sprint"}


def _normalize_stroke(stroke: str) -> str:
    """Map stroke to valid enum, defaulting to 'choice'."""
    s = stroke.lower().strip()
    if s in VALID_STROKES:
        return s
    # Common aliases
    aliases = {"free": "freestyle", "back": "backstroke", "breast": "breaststroke",
               "fly": "butterfly", "fr": "freestyle", "bk": "backstroke",
               "br": "breaststroke", "fl": "butterfly"}
    return aliases.get(s, "choice")


def _normalize_activity(activity: str) -> str:
    """Map activity to valid enum, defaulting to 'swim'."""
    a = activity.lower().strip()
    if a in VALID_ACTIVITIES:
        return a
    aliases = {"kicking": "kick", "pulling": "pull", "drilling": "drill",
               "swimming": "swim", "sprint": "swim"}
    return aliases.get(a, "swim")


def _normalize_energy_zone(zone: str) -> str:
    """Map energy zone to valid enum, defaulting to 'en2'."""
    z = zone.lower().strip()
    if z in VALID_ENERGY_ZONES:
        return z
    return "en2"


def _build_breakdown(tallies: dict[str, int], total_meters: int) -> dict[str, dict[str, Any]]:
    """Convert {key: meters} to {key: {meters, percentage}}."""
    if total_meters == 0:
        return {}
    return {
        k: {"meters": v, "percentage": round((v / total_meters) * 100, 1)}
        for k, v in tallies.items()
        if v > 0
    }


def compute_totals(sections: list[dict]) -> dict[str, Any]:
    """Compute totals, breakdowns, and percentages from parsed sections.

    Args:
        sections: List of {"name": str, "sets": [{"reps", "distance", "stroke", "activity", "energy_zone", ...}]}

    Returns:
        Dict with total_meters, total_sets, stroke_breakdown, activity_breakdown, energy_zone_breakdown.
    """
    stroke_tallies: dict[str, int] = {}
    activity_tallies: dict[str, int] = {}
    zone_tallies: dict[str, int] = {}
    total_meters = 0
    total_sets = 0

    for section in sections:
        for s in section.get("sets", []):
            reps = s.get("reps", 1)
            distance = s.get("distance", 0)
            set_meters = reps * distance
            total_meters += set_meters
            total_sets += 1

            stroke = _normalize_stroke(s.get("stroke", "choice"))
            activity = _normalize_activity(s.get("activity", "swim"))
            zone = _normalize_energy_zone(s.get("energy_zone", "en2"))

            stroke_tallies[stroke] = stroke_tallies.get(stroke, 0) + set_meters
            activity_tallies[activity] = activity_tallies.get(activity, 0) + set_meters
            zone_tallies[zone] = zone_tallies.get(zone, 0) + set_meters

    return {
        "total_meters": total_meters,
        "total_sets": total_sets,
        "stroke_breakdown": _build_breakdown(stroke_tallies, total_meters),
        "activity_breakdown": _build_breakdown(activity_tallies, total_meters),
        "energy_zone_breakdown": _build_breakdown(zone_tallies, total_meters),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_workout_totals.py -v`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/workout_totals.py backend/tests/test_workout_totals.py
git commit -m "feat: add workout totals arithmetic service with tests"
```

---

## Task 2: LLM Workout Parser Service

**Files:**
- Create: `backend/app/services/workout_llm_parser.py`
- Test: `backend/tests/test_workout_llm_parser.py`
- Reference: `backend/app/services/ai_coach/client.py` (Anthropic client pattern)

This service calls Claude Haiku via tool_use to extract structured workout data.

- [ ] **Step 1: Write failing tests for the LLM parser**

```python
# backend/tests/test_workout_llm_parser.py
"""Tests for the LLM workout parser.

These tests require ANTHROPIC_API_KEY in the environment.
Mark with @pytest.mark.llm to allow skipping in CI without API keys.
"""
import pytest
import os
from app.services.workout_llm_parser import parse_workout_with_llm, WORKOUT_TOOL_SCHEMA

# Skip all tests in this module if no API key
pytestmark = pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set"
)


class TestLLMParserBasic:
    """Basic parsing of standard workout formats."""

    @pytest.mark.asyncio
    async def test_simple_workout(self):
        text = """Warm-up:
400 Free easy

Main Set:
8x100 Free @1:30
4x50 Kick @1:00

Cool-down:
200 choice easy"""
        result = await parse_workout_with_llm(text)
        assert "sections" in result
        assert len(result["sections"]) >= 3

        # Flatten all sets
        all_sets = [s for sec in result["sections"] for s in sec["sets"]]
        total = sum(s["reps"] * s["distance"] for s in all_sets)
        assert total == 1600  # 400 + 800 + 200 + 200

    @pytest.mark.asyncio
    async def test_markdown_formatted_workout(self):
        """AI-generated workouts use markdown bold headers."""
        text = """**WARM-UP: 600 meters**

4x100 Free @1:35
2x50 Kick @1:10

**MAIN SET: 1600 meters**

8x100 Free @1:30 descend 1-4
4x200 IM @3:15

**COOL-DOWN: 200 meters**

200 Easy Free"""
        result = await parse_workout_with_llm(text)
        all_sets = [s for sec in result["sections"] for s in sec["sets"]]
        total = sum(s["reps"] * s["distance"] for s in all_sets)
        assert total == 2400  # 400 + 100 + 800 + 800 + 200

    @pytest.mark.asyncio
    async def test_prose_style_workout(self):
        """No NxM notation, just distances."""
        text = """Warm-up:
300 choice swim
200 pull
100 kick

Main Set:
250 Free with fins moderate
200 pull moderate

Cool-down:
100 easy choice"""
        result = await parse_workout_with_llm(text)
        all_sets = [s for sec in result["sections"] for s in sec["sets"]]
        total = sum(s["reps"] * s["distance"] for s in all_sets)
        assert total == 1150

    @pytest.mark.asyncio
    async def test_round_notation(self):
        """Rounds of: with nested sets."""
        text = """Warm-up:
400 Free

Main Set:
3 rounds of:
  4x25 Free @1:00
  50 easy

Cool-down:
200 easy"""
        result = await parse_workout_with_llm(text)
        all_sets = [s for sec in result["sections"] for s in sec["sets"]]
        total = sum(s["reps"] * s["distance"] for s in all_sets)
        # 400 + 3*(100+50) + 200 = 400 + 450 + 200 = 1050
        assert total == 1050


class TestLLMParserEnums:
    """Validate that all returned values use valid enums."""

    @pytest.mark.asyncio
    async def test_valid_stroke_enums(self):
        text = "4x100 Free @1:30\n4x100 Back @1:40\n4x100 Breast @1:50\n4x100 Fly @1:30"
        result = await parse_workout_with_llm(text)
        valid = {"freestyle", "backstroke", "breaststroke", "butterfly", "im", "choice"}
        for section in result["sections"]:
            for s in section["sets"]:
                assert s["stroke"] in valid, f"Invalid stroke: {s['stroke']}"

    @pytest.mark.asyncio
    async def test_valid_activity_enums(self):
        text = "200 kick\n200 pull\n200 drill\n200 swim"
        result = await parse_workout_with_llm(text)
        valid = {"swim", "kick", "pull", "drill"}
        for section in result["sections"]:
            for s in section["sets"]:
                assert s["activity"] in valid, f"Invalid activity: {s['activity']}"

    @pytest.mark.asyncio
    async def test_valid_energy_zone_enums(self):
        text = "4x100 Free easy @2:00\n4x100 Free fast @1:20"
        result = await parse_workout_with_llm(text)
        valid = {"en1", "en2", "en3", "en4", "sprint"}
        for section in result["sections"]:
            for s in section["sets"]:
                assert s["energy_zone"] in valid, f"Invalid zone: {s['energy_zone']}"


class TestLLMParserEdgeCases:
    """Edge cases and error handling."""

    @pytest.mark.asyncio
    async def test_empty_string(self):
        result = await parse_workout_with_llm("")
        assert result["sections"] == []

    @pytest.mark.asyncio
    async def test_garbage_text(self):
        result = await parse_workout_with_llm("This is not a workout at all, just random text about pizza.")
        all_sets = [s for sec in result["sections"] for s in sec["sets"]]
        assert len(all_sets) == 0

    @pytest.mark.asyncio
    async def test_single_line(self):
        result = await parse_workout_with_llm("400 Free")
        all_sets = [s for sec in result["sections"] for s in sec["sets"]]
        total = sum(s["reps"] * s["distance"] for s in all_sets)
        assert total == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_workout_llm_parser.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement `workout_llm_parser.py`**

```python
# backend/app/services/workout_llm_parser.py
"""LLM-powered workout parser using Claude Haiku tool_use.

Sends raw workout text to Claude with a structured tool schema.
Returns parsed sections with sets — all arithmetic done by workout_totals.py.
"""

import hashlib
import os
import time
from typing import Any, Optional

from app.utils import logger

# ---------------------------------------------------------------------------
# In-memory response cache (text hash -> parsed result, 5-min TTL)
# ---------------------------------------------------------------------------
_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 300  # 5 minutes

# ---------------------------------------------------------------------------
# Tool schema for structured output
# ---------------------------------------------------------------------------
WORKOUT_TOOL_SCHEMA = {
    "name": "parse_workout",
    "description": "Parse swimming workout text into structured sections and sets.",
    "input_schema": {
        "type": "object",
        "properties": {
            "sections": {
                "type": "array",
                "description": "Workout sections (warm-up, pre-set, main set, cool-down, etc.)",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Section name (e.g. Warm-up, Main Set, Cool-down)"},
                        "sets": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "reps": {"type": "integer", "description": "Number of repetitions (1 for single swims)"},
                                    "distance": {"type": "integer", "description": "Distance per rep in meters/yards"},
                                    "stroke": {
                                        "type": "string",
                                        "enum": ["freestyle", "backstroke", "breaststroke", "butterfly", "im", "choice"],
                                    },
                                    "activity": {
                                        "type": "string",
                                        "enum": ["swim", "kick", "pull", "drill"],
                                    },
                                    "interval": {
                                        "type": "string",
                                        "description": "Send-off interval (e.g. '1:30', ':45'). Empty string if none.",
                                    },
                                    "energy_zone": {
                                        "type": "string",
                                        "enum": ["en1", "en2", "en3", "en4", "sprint"],
                                    },
                                    "equipment": {
                                        "type": "array",
                                        "items": {
                                            "type": "string",
                                            "enum": ["fins", "paddles", "buoy", "snorkel", "band", "board", "parachute", "tempo_trainer"],
                                        },
                                    },
                                    "notes": {"type": "string", "description": "Brief note (e.g. 'descend 1-4', 'build')"},
                                },
                                "required": ["reps", "distance", "stroke", "activity", "energy_zone"],
                            },
                        },
                    },
                    "required": ["name", "sets"],
                },
            },
        },
        "required": ["sections"],
    },
}

PARSER_SYSTEM_PROMPT = """You are a swimming workout parser. Your ONLY job is to extract structured data from workout text.

RULES:
1. Parse EVERY set in the workout. Do not skip any.
2. For "NxM" notation (e.g. "4x100"), reps=N, distance=M.
3. For single distances (e.g. "400 Free"), reps=1, distance=400.
4. For rounds (e.g. "3 rounds of: 4x25 + 50 easy"), expand: each sub-set gets reps multiplied by rounds.
5. Infer stroke from context. Default to "choice" if ambiguous.
6. Infer activity: "kick" if kicking mentioned, "pull" if pull/buoy mentioned, "drill" if drill mentioned. Default to "swim".
7. Infer energy_zone from intensity cues: easy/recovery/warm-up -> en1, moderate/steady -> en2, build/descend/threshold -> en3, fast/hard -> en4, sprint/max/all-out/race-pace -> sprint. Default to en2.
8. Strip markdown formatting (**, #, *, etc.) — focus on the workout content.
9. Ignore non-set lines (section headers, coaching notes, purposes, focus descriptions).
10. If the text is empty or contains no recognizable sets, return {"sections": []}.
11. Equipment: detect fins, paddles, buoy/pull buoy, snorkel, band, board/kickboard, parachute, tempo trainer.
12. For IM (Individual Medley) sets, stroke="im" — do NOT split into individual strokes.
13. Rest-only lines (e.g. "1:00 rest") are NOT sets — skip them.

ACCURACY IS CRITICAL. Every rep and distance must be exact."""

# Max input length
MAX_TEXT_LENGTH = 5000


def _get_cache_key(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _get_cached(text: str) -> Optional[dict]:
    key = _get_cache_key(text)
    if key in _cache:
        ts, result = _cache[key]
        if time.time() - ts < _CACHE_TTL:
            return result
        del _cache[key]
    return None


def _set_cache(text: str, result: dict) -> None:
    key = _get_cache_key(text)
    _cache[key] = (time.time(), result)


async def parse_workout_with_llm(workout_text: str) -> dict[str, Any]:
    """Parse workout text into structured sections using Claude Haiku.

    Args:
        workout_text: Raw workout text (any format — standard, markdown, prose, etc.)

    Returns:
        {"sections": [{"name": str, "sets": [{reps, distance, stroke, activity, ...}]}]}
    """
    text = workout_text.strip()

    # Empty input
    if not text:
        return {"sections": []}

    # Length cap
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH]

    # Check cache
    cached = _get_cached(text)
    if cached is not None:
        logger.debug("Workout LLM parser: cache hit")
        return cached

    # Lazy import to avoid import-time side effects
    from anthropic import AsyncAnthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = AsyncAnthropic(api_key=api_key, timeout=10.0)

    try:
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            temperature=0,
            system=PARSER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Parse this swimming workout:\n\n{text}"}],
            tools=[WORKOUT_TOOL_SCHEMA],
            tool_choice={"type": "tool", "name": "parse_workout"},
        )

        # Extract tool use result
        for block in response.content:
            if block.type == "tool_use" and block.name == "parse_workout":
                result = block.input
                _set_cache(text, result)
                logger.info(f"LLM parser: {len(result.get('sections', []))} sections parsed")
                return result

        # No tool use in response — unexpected
        logger.warning("LLM parser: no tool_use block in response")
        return {"sections": []}

    except Exception as e:
        logger.error(f"LLM parser failed: {e}")
        raise
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_workout_llm_parser.py -v`
Expected: All tests PASS (requires `ANTHROPIC_API_KEY` in env)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/workout_llm_parser.py backend/tests/test_workout_llm_parser.py
git commit -m "feat: add LLM-powered workout parser with Claude Haiku tool_use"
```

---

## Task 3: Golden Set Fixtures

**Files:**
- Create: `backend/tests/fixtures/golden_workouts.json`

Build the 50-workout golden set by extracting workouts from ChromaDB and hand-verifying expected values.

- [ ] **Step 1: Write a helper script to extract candidate workouts from ChromaDB**

```python
# Run interactively — not committed. Extracts diverse workouts for manual review.
import chromadb
import json

client = chromadb.PersistentClient(path="chroma_db")
col = client.get_collection("swimming_workouts")

# Sample from different offsets for variety
candidates = []
for offset in range(0, 1901, 38):  # ~50 samples
    results = col.get(limit=1, offset=offset, include=["documents", "metadatas"])
    if results["documents"]:
        doc = results["documents"][0]
        meta = results["metadatas"][0]
        # Skip glossary/non-workout entries
        if "Glossary" in meta.get("title", "") or len(doc) < 50:
            continue
        candidates.append({
            "title": meta.get("title", "Untitled"),
            "source": meta.get("source_name", "Unknown"),
            "text": doc,
        })

with open("tests/fixtures/golden_candidates.json", "w") as f:
    json.dump(candidates, f, indent=2)
print(f"Extracted {len(candidates)} candidates")
```

- [ ] **Step 2: Manually verify each candidate and create `golden_workouts.json`**

For each workout: count the total meters by hand, count sets, identify strokes and activities. The fixture format is:

```json
[
  {
    "id": "golden_001",
    "title": "Classic Descend Freestyle",
    "source": "USMS",
    "text": "Warm-up:\n400 choice swim\n4x75 choice @1:30 ...",
    "expected": {
      "total_meters": 3300,
      "total_sets": 9,
      "stroke_breakdown": {"freestyle": 2800, "choice": 500},
      "activity_breakdown": {"swim": 2800, "kick": 200, "drill": 100, "pull": 200}
    }
  }
]
```

This step is manual and time-intensive. Start with 10-15 workouts covering the most distinct formats, expand to 50 iteratively.

- [ ] **Step 3: Write golden set test that loads fixtures**

```python
# Add to backend/tests/test_workout_llm_parser.py

import json
from pathlib import Path

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "golden_workouts.json"


class TestGoldenSet:
    """Golden set: hand-verified workouts with exact expected values."""

    @pytest.fixture
    def golden_workouts(self):
        if not FIXTURES_PATH.exists():
            pytest.skip("Golden set fixtures not yet created")
        with open(FIXTURES_PATH) as f:
            return json.load(f)

    @pytest.mark.asyncio
    async def test_golden_set_total_meters(self, golden_workouts):
        from app.services.workout_totals import compute_totals

        failures = []
        for workout in golden_workouts:
            result = await parse_workout_with_llm(workout["text"])
            totals = compute_totals(result["sections"])
            expected = workout["expected"]["total_meters"]
            actual = totals["total_meters"]
            if actual != expected:
                failures.append(f"{workout['id']}: expected {expected}m, got {actual}m")

        assert not failures, f"Golden set failures:\n" + "\n".join(failures)

    @pytest.mark.asyncio
    async def test_golden_set_total_sets(self, golden_workouts):
        from app.services.workout_totals import compute_totals

        failures = []
        for workout in golden_workouts:
            result = await parse_workout_with_llm(workout["text"])
            totals = compute_totals(result["sections"])
            expected = workout["expected"]["total_sets"]
            actual = totals["total_sets"]
            if actual != expected:
                failures.append(f"{workout['id']}: expected {expected} sets, got {actual}")

        assert not failures, f"Golden set failures:\n" + "\n".join(failures)
```

- [ ] **Step 4: Commit fixtures and golden set tests**

```bash
git add backend/tests/fixtures/golden_workouts.json backend/tests/test_workout_llm_parser.py
git commit -m "feat: add golden set fixtures and exact-match tests for LLM parser"
```

---

## Task 4: Improve Regex Parser (Fallback)

**Files:**
- Modify: `backend/app/services/workout_parser.py`
- Modify/Create: `backend/tests/test_workout_parser.py`

Add markdown stripping, prose-style distances, and round notation to the existing regex parser.

- [ ] **Step 1: Write failing tests for new regex patterns**

```python
# backend/tests/test_workout_parser.py
import pytest
from app.services.workout_parser import WorkoutParser


@pytest.fixture
def parser():
    return WorkoutParser()


class TestMarkdownStripping:
    def test_bold_headers(self, parser):
        text = "**WARM-UP: 600 meters**\n4x100 Free @1:35"
        sets = parser.extract_sets(text)
        assert len(sets) >= 1
        total = sum(s["total_distance"] for s in sets)
        assert total >= 400  # At least the 4x100

    def test_hash_headers(self, parser):
        text = "# MAIN SET\n8x100 Free @1:30"
        sets = parser.extract_sets(text)
        assert len(sets) >= 1

    def test_italic_labels(self, parser):
        text = "*Sprint Set:*\n6x50 Free @:45"
        sets = parser.extract_sets(text)
        assert len(sets) >= 1


class TestProseStyleDistances:
    def test_simple_prose(self, parser):
        text = "200 Free easy"
        sets = parser.extract_sets(text)
        assert len(sets) >= 1
        assert sets[0]["total_distance"] == 200

    def test_multiple_prose_lines(self, parser):
        text = "300 choice\n200 pull\n100 kick"
        sets = parser.extract_sets(text)
        total = sum(s["total_distance"] for s in sets)
        assert total == 600


class TestRoundNotation:
    def test_rounds_of(self, parser):
        text = "3 rounds of:\n  4x25 Free @1:00\n  50 easy"
        sets = parser.extract_sets(text)
        total = sum(s["total_distance"] for s in sets)
        # 3 * (100 + 50) = 450
        assert total == 450

    def test_rounds_without_of(self, parser):
        text = "2 rounds:\n  4x50 Kick @1:00"
        sets = parser.extract_sets(text)
        total = sum(s["total_distance"] for s in sets)
        assert total == 400  # 2 * 200
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_workout_parser.py -v`
Expected: Several FAIL (the new format tests)

- [ ] **Step 3: Add markdown pre-processing to `WorkoutParser`**

In `backend/app/services/workout_parser.py`, add a `_preprocess_text` method that strips markdown before parsing. Call it at the start of `extract_sets`.

```python
import re

def _preprocess_text(self, text: str) -> str:
    """Strip markdown formatting before parsing."""
    # Remove bold markers
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    # Remove italic markers
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    # Remove heading markers
    text = re.sub(r'^#{1,3}\s+', '', text, flags=re.MULTILINE)
    return text
```

- [ ] **Step 4: Add prose-style distance matching**

In the `extract_sets` method, after checking for `NxM` patterns, add a check for standalone distances:

```python
# After NxM check fails, try prose-style: "200 Free easy"
prose_match = re.match(r'^\s*(\d{2,5})\s+([A-Za-z].*)', line)
if prose_match and not nxm_match:
    distance = int(prose_match.group(1))
    if 25 <= distance <= 10000:
        description = prose_match.group(2)
        # ... build set_info with reps=1
```

- [ ] **Step 5: Add round notation expansion**

In `extract_sets`, detect round notation lines and multiply subsequent sets:

```python
# Detect "N rounds of:" or "N rounds:"
round_match = re.match(r'^\s*(\d+)\s+rounds?\s*(?:of\s*)?:?\s*$', line, re.IGNORECASE)
if round_match:
    current_round_multiplier = int(round_match.group(1))
    continue
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_workout_parser.py -v`
Expected: All tests PASS

- [ ] **Step 7: (Optional) Add remaining regex improvements**

The spec lists 7 improvements. This task covers the top 3 (markdown, prose, rounds). The remaining 4 are lower priority since the LLM parser handles them:
- Inline breakdowns: `500 (25 Free/25 stroke, 50 Free/50 stroke...)`
- Rest notation variety: `@:20 rest`, `1:00 rest`, `:30 rest`
- Sub-section labels: `*Sprint Set:*`, `Part A:`, `TECHNIQUE BLOCK 1:`
- Pace notation: `@1:20/100 pace`

Add these if time permits. Each one is a separate regex pattern addition with tests. Target: 70% of golden set parsed correctly.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/workout_parser.py backend/tests/test_workout_parser.py
git commit -m "feat: improve regex parser with markdown stripping, prose distances, round notation"
```

---

## Task 5: Updated Workout Analyzer (Orchestrator)

**Files:**
- Modify: `backend/app/services/workout_analyzer.py`
- Modify: `backend/app/routes/workout_analysis.py`

Wire the LLM parser as primary, regex as fallback, compute totals server-side.

- [ ] **Step 1: Write failing test for the new analyze flow**

```python
# backend/tests/test_workout_analyzer.py
import pytest
import os
from app.services.workout_analyzer import WorkoutAnalyzer


pytestmark = pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set"
)


class TestAnalyzerOrchestration:
    @pytest.mark.asyncio
    async def test_analyze_returns_parser_used_field(self):
        analyzer = WorkoutAnalyzer()
        result = await analyzer.analyze_workout_v2("4x100 Free @1:30\n200 choice easy")
        assert "parser_used" in result
        assert result["parser_used"] in ("llm", "regex")

    @pytest.mark.asyncio
    async def test_analyze_returns_totals(self):
        analyzer = WorkoutAnalyzer()
        result = await analyzer.analyze_workout_v2("4x100 Free @1:30\n200 choice easy")
        assert result["total_meters"] == 600
        assert "stroke_breakdown" in result
        assert "activity_breakdown" in result
        assert "energy_zone_breakdown" in result
        assert "estimated_duration_minutes" in result

    @pytest.mark.asyncio
    async def test_analyze_returns_sections(self):
        analyzer = WorkoutAnalyzer()
        result = await analyzer.analyze_workout_v2("Warm-up:\n400 Free\n\nMain:\n8x100 Back @1:40")
        assert "sections" in result
        assert len(result["sections"]) >= 1
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && python -m pytest tests/test_workout_analyzer.py -v`
Expected: FAIL — `AttributeError: 'WorkoutAnalyzer' object has no attribute 'analyze_workout_v2'`

- [ ] **Step 3: Add `analyze_workout_v2` method to `WorkoutAnalyzer`**

In `backend/app/services/workout_analyzer.py`, add the new orchestration method that tries LLM first, falls back to regex:

```python
async def analyze_workout_v2(self, workout_text: str) -> dict:
    """Analyze workout: LLM parser (primary) → regex (fallback) → totals → duration."""
    from .workout_llm_parser import parse_workout_with_llm
    from .workout_totals import compute_totals

    parser_used = "llm"
    try:
        parsed = await parse_workout_with_llm(workout_text)
    except Exception as e:
        logger.warning(f"LLM parser failed, falling back to regex: {e}")
        parsed = self._regex_fallback(workout_text)
        parser_used = "regex"

    totals = compute_totals(parsed.get("sections", []))
    duration = self._estimate_duration(parsed.get("sections", []))

    return {
        "parser_used": parser_used,
        "sections": parsed.get("sections", []),
        **totals,
        "estimated_duration_minutes": duration,
    }
```

Also add these helper methods:

```python
def _regex_fallback(self, workout_text: str) -> dict:
    """Parse with regex and convert to the sections format expected by compute_totals."""
    sets = self.parser.extract_sets(workout_text)
    # Wrap flat set list into a single section (regex parser doesn't detect sections)
    converted_sets = []
    for s in sets:
        converted_sets.append({
            "reps": s.get("reps", 1),
            "distance": s.get("unit_distance", s.get("distance", 0)),
            "stroke": s.get("stroke", "choice"),
            "activity": s.get("activity", "swim"),
            "energy_zone": s.get("energy_zone", "en2"),
            "interval": "",
            "equipment": s.get("equipment", []),
            "notes": "",
        })
    return {"sections": [{"name": "Full Workout", "sets": converted_sets}]} if converted_sets else {"sections": []}

def _estimate_duration(self, sections: list[dict]) -> float:
    """Estimate duration in minutes from parsed sections using pace tables."""
    total_seconds = 0
    for section in sections:
        for s in section.get("sets", []):
            reps = s.get("reps", 1)
            distance = s.get("distance", 0)
            stroke = s.get("stroke", "freestyle")
            activity = s.get("activity", "swim")
            interval_str = s.get("interval", "")

            if interval_str:
                # If interval provided, total time = interval * reps
                try:
                    parts = interval_str.replace("@", "").strip().split(":")
                    if len(parts) == 2:
                        interval_secs = int(parts[0]) * 60 + int(parts[1])
                    else:
                        interval_secs = int(parts[0])
                    total_seconds += interval_secs * reps
                except (ValueError, IndexError):
                    total_seconds += self.time_estimator.estimate_swim_time(distance * reps, stroke, activity)
                    total_seconds += 90  # default rest between sets
            else:
                total_seconds += self.time_estimator.estimate_swim_time(distance * reps, stroke, activity)
                total_seconds += 90  # default rest between sets
    return round(total_seconds / 60, 1)
```

- [ ] **Step 4: Update `/workout-analysis/analyze` endpoint with rate limiting**

In `backend/app/routes/workout_analysis.py`, add a simple per-user rate limiter and update the handler:

```python
import time
from collections import defaultdict

# Simple in-memory rate limiter: {user_id: [timestamps]}
_rate_limits: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 10  # max calls per minute
_RATE_WINDOW = 60  # seconds

def _check_rate_limit(user_id: str) -> bool:
    now = time.time()
    # Clean old entries
    _rate_limits[user_id] = [t for t in _rate_limits[user_id] if now - t < _RATE_WINDOW]
    if len(_rate_limits[user_id]) >= _RATE_LIMIT:
        return False
    _rate_limits[user_id].append(now)
    return True

@router.post("/analyze")
async def analyze_workout_text(
    request: WorkoutAnalysisRequest,
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    if not _check_rate_limit(user_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Max 10 analyses per minute.")

    analyzer = get_analyzer()
    analysis = await analyzer.analyze_workout_v2(request.workout_text)
    return {"success": True, "data": analysis}
```

- [ ] **Step 5: Update quick-stats endpoint to return only `total_meters` and `total_sets`**

```python
@router.post("/quick-stats")
async def get_quick_workout_stats(
    request: WorkoutAnalysisRequest,
    user_id: str = Depends(get_current_user_id),
) -> Dict[str, Any]:
    analyzer = get_analyzer()
    # Regex only — fast path
    analysis = analyzer.analyze_workout(request.workout_text, request.workout_id)
    return {
        "success": True,
        "data": {
            "total_meters": analysis.get("total_meters", 0),
            "total_sets": analysis.get("total_sets", 0),
        },
    }
```

- [ ] **Step 6: Run tests**

Run: `cd backend && python -m pytest tests/test_workout_analyzer.py tests/test_workout_totals.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/workout_analyzer.py backend/app/routes/workout_analysis.py backend/tests/test_workout_analyzer.py
git commit -m "feat: wire LLM parser as primary analyzer with regex fallback"
```

---

## Task 6: Alembic Migration + PATCH Endpoint

**Files:**
- Create: `backend/alembic/versions/xxxx_add_classification_to_workout_template.py`
- Modify: `backend/app/routes/ai_coach_conversations.py`
- Modify: `backend/app/services/conversation_service.py`
- Modify: `backend/app/infrastructure/models.py`

- [ ] **Step 1: Add `classification` to the SQLAlchemy model**

In `backend/app/infrastructure/models.py`, add to `WorkoutTemplate`:

```python
classification = Column(String(50), nullable=True)
```

- [ ] **Step 2: Generate the Alembic migration**

Run: `cd backend && alembic revision --autogenerate -m "add classification to workout_template"`

Verify the generated migration adds the column correctly.

- [ ] **Step 3: Add `update_message_metadata` to conversation_service.py**

```python
# In backend/app/services/conversation_service.py

async def update_message_metadata(
    db: AsyncSession, conversation_id: str, message_id: str, metadata_update: dict
) -> dict:
    """Merge metadata_update into an existing message's metadata."""
    msg_id = uuid.UUID(message_id)
    conv_id = uuid.UUID(conversation_id)

    stmt = select(AICoachMessage).where(
        AICoachMessage.id == msg_id,
        AICoachMessage.conversation_id == conv_id,
    )
    result = await db.execute(stmt)
    message = result.scalar_one_or_none()
    if not message:
        raise NotFoundError(f"Message {message_id} not found")

    existing = message.message_metadata or {}
    existing.update(metadata_update)
    message.message_metadata = existing
    await db.commit()
    await db.refresh(message)

    return {
        "id": str(message.id),
        "message_metadata": message.message_metadata,
    }
```

- [ ] **Step 4: Add PATCH endpoint to ai_coach_conversations.py**

```python
class UpdateMessageMetadataRequest(BaseModel):
    metadata: dict

@router.patch("/conversations/{conversation_id}/messages/{message_id}")
async def patch_message_metadata(
    conversation_id: str,
    message_id: str,
    request: UpdateMessageMetadataRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Verify coach owns this conversation
    coach = await get_coach_by_user_id(db, user_id)
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    conversation = await get_conversation_with_messages(db, str(coach.id), conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await update_message_metadata(db, conversation_id, message_id, request.metadata)
    return result
```

- [ ] **Step 5: Write tests for PATCH endpoint and `update_message_metadata`**

```python
# Add to backend/tests/test_ai_coach_conversations.py (or create if needed)
import pytest
from httpx import AsyncClient


class TestPatchMessageMetadata:
    @pytest.mark.asyncio
    async def test_update_metadata_success(self, authenticated_client: AsyncClient, conversation_with_messages):
        """Coach can update metadata on their own conversation's message."""
        conv_id, msg_id = conversation_with_messages
        response = await authenticated_client.patch(
            f"/api/ai-coach/conversations/{conv_id}/messages/{msg_id}",
            json={"metadata": {"saved_workout_id": "some-uuid", "saved_workout_title": "Test Workout"}}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message_metadata"]["saved_workout_id"] == "some-uuid"

    @pytest.mark.asyncio
    async def test_update_metadata_not_found(self, authenticated_client: AsyncClient):
        """Returns 404 for non-existent message."""
        response = await authenticated_client.patch(
            "/api/ai-coach/conversations/00000000-0000-0000-0000-000000000000/messages/00000000-0000-0000-0000-000000000000",
            json={"metadata": {"key": "value"}}
        )
        assert response.status_code == 404
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/infrastructure/models.py backend/alembic/versions/ backend/app/routes/ai_coach_conversations.py backend/app/services/conversation_service.py backend/tests/test_ai_coach_conversations.py
git commit -m "feat: add classification column + PATCH message metadata endpoint"
```

---

## Task 7: Frontend — `useWorkoutAnalysis` Hook

**Files:**
- Create: `frontend/src/hooks/useWorkoutAnalysis.ts`
- Create: `frontend/src/hooks/__tests__/useWorkoutAnalysis.test.ts`
- Modify: `frontend/src/services/workoutAnalysisService.ts`

- [ ] **Step 1: Update `workoutAnalysisService.ts` types**

Update the `WorkoutAnalysis` interface to match the new response shape:

```typescript
// frontend/src/services/workoutAnalysisService.ts

export interface BreakdownEntry {
  meters: number;
  percentage: number;
}

export interface WorkoutAnalysis {
  parser_used: 'llm' | 'regex';
  total_meters: number;
  total_sets: number;
  estimated_duration_minutes: number;
  stroke_breakdown: Record<string, BreakdownEntry>;
  activity_breakdown: Record<string, BreakdownEntry>;
  energy_zone_breakdown: Record<string, BreakdownEntry>;
  sections: Array<{
    name: string;
    sets: Array<{
      reps: number;
      distance: number;
      stroke: string;
      activity: string;
      interval?: string;
      energy_zone: string;
      equipment?: string[];
      notes?: string;
    }>;
  }>;
}

export interface QuickStats {
  total_meters: number;
  total_sets: number;
}
```

- [ ] **Step 2: Write failing tests for `useWorkoutAnalysis`**

```typescript
// frontend/src/hooks/__tests__/useWorkoutAnalysis.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkoutAnalysis } from '../useWorkoutAnalysis';

vi.mock('@/services/workoutAnalysisService', () => ({
  analyzeWorkout: vi.fn(),
  getQuickWorkoutStats: vi.fn(),
}));

import { analyzeWorkout, getQuickWorkoutStats } from '@/services/workoutAnalysisService';

describe('useWorkoutAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with no analysis and not stale', () => {
    const { result } = renderHook(() => useWorkoutAnalysis());
    expect(result.current.analysis).toBeNull();
    expect(result.current.isStale).toBe(false);
    expect(result.current.isAnalyzing).toBe(false);
  });

  it('analyze() calls the API and sets analysis', async () => {
    const mockAnalysis = {
      parser_used: 'llm',
      total_meters: 1400,
      total_sets: 4,
      estimated_duration_minutes: 35,
      stroke_breakdown: {},
      activity_breakdown: {},
      energy_zone_breakdown: {},
      sections: [],
    };
    (analyzeWorkout as any).mockResolvedValue(mockAnalysis);

    const { result } = renderHook(() => useWorkoutAnalysis());

    await act(async () => {
      await result.current.analyze('4x100 Free @1:30');
    });

    expect(result.current.analysis).toEqual(mockAnalysis);
    expect(result.current.isStale).toBe(false);
  });

  it('marks analysis as stale when text changes', async () => {
    const mockAnalysis = { parser_used: 'llm', total_meters: 400, total_sets: 1, estimated_duration_minutes: 10, stroke_breakdown: {}, activity_breakdown: {}, energy_zone_breakdown: {}, sections: [] };
    (analyzeWorkout as any).mockResolvedValue(mockAnalysis);

    const { result } = renderHook(() => useWorkoutAnalysis());

    await act(async () => {
      await result.current.analyze('400 Free');
    });

    act(() => {
      result.current.markStale();
    });

    expect(result.current.isStale).toBe(true);
  });
});
```

- [ ] **Step 3: Implement `useWorkoutAnalysis` hook**

```typescript
// frontend/src/hooks/useWorkoutAnalysis.ts
import { useState, useCallback } from 'react';
import { analyzeWorkout, type WorkoutAnalysis } from '@/services/workoutAnalysisService';

interface UseWorkoutAnalysisReturn {
  analysis: WorkoutAnalysis | null;
  isAnalyzing: boolean;
  isStale: boolean;
  error: string | null;
  analyze: (text: string) => Promise<void>;
  markStale: () => void;
  clear: () => void;
}

export function useWorkoutAnalysis(): UseWorkoutAnalysisReturn {
  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (text: string) => {
    if (!text.trim()) {
      setAnalysis(null);
      setError(null);
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeWorkout(text);
      setAnalysis(result);
      setIsStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const markStale = useCallback(() => {
    if (analysis) setIsStale(true);
  }, [analysis]);

  const clear = useCallback(() => {
    setAnalysis(null);
    setIsStale(false);
    setError(null);
  }, []);

  return { analysis, isAnalyzing, isStale, error, analyze, markStale, clear };
}
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useWorkoutAnalysis.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useWorkoutAnalysis.ts frontend/src/hooks/__tests__/useWorkoutAnalysis.test.ts frontend/src/services/workoutAnalysisService.ts
git commit -m "feat: add useWorkoutAnalysis hook with stale detection"
```

---

## Task 8: Frontend — `WorkoutMetricsCard` Component

**Files:**
- Create: `frontend/src/components/workout/WorkoutMetricsCard.tsx`
- Create: `frontend/src/components/workout/__tests__/WorkoutMetricsCard.test.tsx`

Displays analysis results with stroke icons, activity/energy chips, and stale badge.

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/components/workout/__tests__/WorkoutMetricsCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WorkoutMetricsCard } from '../WorkoutMetricsCard';

const mockAnalysis = {
  parser_used: 'llm' as const,
  total_meters: 3200,
  total_sets: 14,
  estimated_duration_minutes: 55,
  stroke_breakdown: {
    freestyle: { meters: 2400, percentage: 75.0 },
    backstroke: { meters: 800, percentage: 25.0 },
  },
  activity_breakdown: {
    swim: { meters: 2600, percentage: 81.3 },
    kick: { meters: 600, percentage: 18.8 },
  },
  energy_zone_breakdown: {
    en1: { meters: 800, percentage: 25.0 },
    en2: { meters: 2400, percentage: 75.0 },
  },
  sections: [],
};

describe('WorkoutMetricsCard', () => {
  it('renders summary metrics', () => {
    render(<WorkoutMetricsCard analysis={mockAnalysis} />);
    expect(screen.getByText(/3200m/)).toBeInTheDocument();
    expect(screen.getByText(/14 sets/)).toBeInTheDocument();
    expect(screen.getByText(/55 min/)).toBeInTheDocument();
  });

  it('renders stroke breakdown with icons', () => {
    render(<WorkoutMetricsCard analysis={mockAnalysis} />);
    expect(screen.getByText(/freestyle/i)).toBeInTheDocument();
    expect(screen.getByText(/75/)).toBeInTheDocument();
    // Stroke icons are <img> tags from /images/
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders activity breakdown', () => {
    render(<WorkoutMetricsCard analysis={mockAnalysis} />);
    expect(screen.getByText(/swim/i)).toBeInTheDocument();
    expect(screen.getByText(/kick/i)).toBeInTheDocument();
  });

  it('shows stale badge when isStale', () => {
    render(<WorkoutMetricsCard analysis={mockAnalysis} isStale={true} />);
    expect(screen.getByText(/stale/i)).toBeInTheDocument();
  });

  it('shows regex fallback notice', () => {
    const regexAnalysis = { ...mockAnalysis, parser_used: 'regex' as const };
    render(<WorkoutMetricsCard analysis={regexAnalysis} />);
    expect(screen.getByText(/approximate/i)).toBeInTheDocument();
  });

  it('renders nothing when analysis is null', () => {
    const { container } = render(<WorkoutMetricsCard analysis={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `WorkoutMetricsCard`**

```tsx
// frontend/src/components/workout/WorkoutMetricsCard.tsx
import type { WorkoutAnalysis } from '@/services/workoutAnalysisService';
import { Waves } from 'lucide-react';

// Stroke icon mapping
const STROKE_ICONS: Record<string, string> = {
  freestyle: '/images/freestyle.png',
  backstroke: '/images/backstroke.png',
  breaststroke: '/images/breastroke.png', // Note: filename typo in assets
  butterfly: '/images/butterfly.png',
  im: '/images/im.png',
};

// Display-friendly labels
const STROKE_LABELS: Record<string, string> = {
  freestyle: 'Freestyle',
  backstroke: 'Backstroke',
  breaststroke: 'Breaststroke',
  butterfly: 'Butterfly',
  im: 'IM',
  choice: 'Choice',
};

const ZONE_LABELS: Record<string, string> = {
  en1: 'EN1', en2: 'EN2', en3: 'EN3', en4: 'EN4', sprint: 'Sprint',
};

interface Props {
  analysis: WorkoutAnalysis | null;
  isStale?: boolean;
}

export function WorkoutMetricsCard({ analysis, isStale }: Props) {
  if (!analysis) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 space-y-4">
      {/* Notices */}
      {isStale && (
        <div className="text-xs text-amber-500 font-medium">Stale — re-analyze to update</div>
      )}
      {analysis.parser_used === 'regex' && (
        <div className="text-xs text-muted-foreground">Analysis is approximate — AI parser unavailable</div>
      )}

      {/* Summary row */}
      <div className="flex gap-6 text-sm font-medium">
        <span>{analysis.total_meters}m</span>
        <span>{analysis.total_sets} sets</span>
        <span>~{analysis.estimated_duration_minutes} min</span>
      </div>

      {/* Stroke breakdown */}
      {Object.keys(analysis.stroke_breakdown).length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">Stroke Breakdown</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(analysis.stroke_breakdown).map(([stroke, { meters, percentage }]) => (
              <div key={stroke} className="flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1 text-xs">
                {STROKE_ICONS[stroke] ? (
                  <img src={STROKE_ICONS[stroke]} alt={stroke} className="w-4 h-4" />
                ) : (
                  <Waves className="w-4 h-4 text-muted-foreground" />
                )}
                <span>{STROKE_LABELS[stroke] || stroke}</span>
                <span className="text-muted-foreground">{percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity breakdown */}
      {Object.keys(analysis.activity_breakdown).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground mr-1">Activity:</span>
          {Object.entries(analysis.activity_breakdown).map(([activity, { percentage }]) => (
            <span key={activity} className="text-xs bg-muted/50 rounded px-2 py-0.5 capitalize">
              {activity} {percentage}%
            </span>
          ))}
        </div>
      )}

      {/* Energy zone breakdown */}
      {Object.keys(analysis.energy_zone_breakdown).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground mr-1">Energy:</span>
          {Object.entries(analysis.energy_zone_breakdown).map(([zone, { percentage }]) => (
            <span key={zone} className="text-xs bg-muted/50 rounded px-2 py-0.5">
              {ZONE_LABELS[zone] || zone} {percentage}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/workout/__tests__/WorkoutMetricsCard.test.tsx`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/workout/WorkoutMetricsCard.tsx frontend/src/components/workout/__tests__/WorkoutMetricsCard.test.tsx
git commit -m "feat: add WorkoutMetricsCard with stroke icons and breakdowns"
```

---

## Task 9: Redesign Create/Edit Workout Page

**Files:**
- Modify: `frontend/src/pages/WorkoutForm/index.tsx` (modular entry point — this is the canonical file used by routing)
- Modify: `frontend/src/pages/WorkoutForm/hooks/useWorkoutForm.ts`
- Remove: `frontend/src/pages/WorkoutForm.tsx` (legacy standalone duplicate — delete)
- Remove: `frontend/src/components/workout/RealtimeWorkoutAnalyzer.tsx`
- Remove: `frontend/src/pages/WorkoutForm/components/EditMetricModal.tsx`

- [ ] **Step 1: Delete the legacy standalone `WorkoutForm.tsx`**

```bash
git rm frontend/src/pages/WorkoutForm.tsx
```

The modular `frontend/src/pages/WorkoutForm/index.tsx` is the canonical entry point. Verify routing imports from the index, not the standalone file.

- [ ] **Step 2: Rewrite `WorkoutForm/index.tsx` with new layout**

Replace the split-panel design with the editor-first layout from the spec:
- Top bar: Name + Classification dropdown + Save/Cancel
- Full-width monospace text editor
- Toolbar: Effort slider + Tags + Visibility + Analyze button
- `WorkoutMetricsCard` below (appears after analysis)

Key changes:
- Remove `RealtimeWorkoutAnalyzer` import and usage
- Remove `EditMetricModal` import and usage
- Add `WorkoutMetricsCard` with analysis from `useWorkoutAnalysis`
- Add classification dropdown (Sprint, Endurance, Technique, IM, Recovery, Race Prep)
- Analyze button calls `analyze(formData.rawDescription)`

- [ ] **Step 2: Update `useWorkoutForm.ts`**

- Remove `handleAnalysisUpdate` callback (no more real-time)
- Remove `searchParams.get("aiWorkout")` handling (save-as-workout now uses modal)
- Add `classification` to `formData`
- On submit, include `classification` in the POST body
- Stop writing `estimated_calories`
- Write `description` field as empty string (backwards compat — `raw_description` is source of truth)

- [ ] **Step 3: Delete `RealtimeWorkoutAnalyzer.tsx`**

```bash
git rm frontend/src/components/workout/RealtimeWorkoutAnalyzer.tsx
```

- [ ] **Step 4: Delete `EditMetricModal.tsx`**

```bash
git rm frontend/src/pages/WorkoutForm/components/EditMetricModal.tsx
```

Update `frontend/src/pages/WorkoutForm/components/index.ts` to remove the `EditMetricModal` export.

- [ ] **Step 5: Update `frontend/src/components/workout/index.ts`**

Remove `RealtimeWorkoutAnalyzer` export, add `WorkoutMetricsCard` export.

- [ ] **Step 6: Manual test**

Run: `cd frontend && npm run dev`
- Navigate to `/workouts/create`
- Verify: clean editor layout, classification dropdown, analyze button works
- Verify: metrics card appears after clicking Analyze
- Verify: editing text shows "Stale" badge

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src/pages/WorkoutForm/ frontend/src/components/workout/
git commit -m "feat: redesign create workout page with on-demand analysis"
```

---

## Task 10: Save-as-Workout Modal (AI Coach)

**Files:**
- Create: `frontend/src/components/ai-coach/SaveWorkoutModal.tsx`
- Create: `frontend/src/components/ai-coach/__tests__/SaveWorkoutModal.test.tsx`
- Modify: `frontend/src/components/ai-coach/WorkoutCard.tsx`
- Modify: `frontend/src/pages/AICoachPage.tsx`

- [ ] **Step 1: Write failing tests for `SaveWorkoutModal`**

```typescript
// frontend/src/components/ai-coach/__tests__/SaveWorkoutModal.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SaveWorkoutModal } from '../SaveWorkoutModal';

vi.mock('@/services/workoutAnalysisService');
vi.mock('@/hooks/useWorkoutAnalysis', () => ({
  useWorkoutAnalysis: () => ({
    analysis: { parser_used: 'llm', total_meters: 1400, total_sets: 4, estimated_duration_minutes: 35, stroke_breakdown: {}, activity_breakdown: {}, energy_zone_breakdown: {}, sections: [] },
    isAnalyzing: false,
    isStale: false,
    error: null,
    analyze: vi.fn(),
    markStale: vi.fn(),
    clear: vi.fn(),
  }),
}));

describe('SaveWorkoutModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    workoutText: '4x100 Free @1:30\n200 choice easy',
  };

  it('renders when open', () => {
    render(<SaveWorkoutModal {...defaultProps} />);
    expect(screen.getByText(/save workout/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<SaveWorkoutModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/save workout/i)).not.toBeInTheDocument();
  });

  it('has name input, classification dropdown, effort slider, save button', () => {
    render(<SaveWorkoutModal {...defaultProps} />);
    expect(screen.getByPlaceholderText(/workout name/i)).toBeInTheDocument();
    expect(screen.getByText(/classification/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement `SaveWorkoutModal`**

Build the inline modal with:
- Name input (auto-filled via `POST /ai-coach/generate-title` on open)
- Read-only workout text display (markdown stripped)
- `WorkoutMetricsCard` (auto-analyzes on open)
- Classification dropdown
- Effort level slider
- Tags selector
- Visibility toggle
- Save button → `POST /workouts` then `PATCH /ai-coach/conversations/{id}/messages/{msg_id}` to store `saved_workout_id`

- [ ] **Step 3: Update `WorkoutCard.tsx`**

Change the save button to open `SaveWorkoutModal` instead of calling `onSave` navigation:

```tsx
// Replace the save button handler
const [showSaveModal, setShowSaveModal] = useState(false);
// ... in render:
<button onClick={() => setShowSaveModal(true)}>Save as Workout</button>
<SaveWorkoutModal
  isOpen={showSaveModal}
  onClose={() => setShowSaveModal(false)}
  onSave={handleWorkoutSaved}
  workoutText={message.content}
  conversationId={conversationId}
  messageId={message.id}
/>
```

- [ ] **Step 4: Update `AICoachPage.tsx`**

- Remove `handleSaveWorkout` function (the navigate-based one)
- Remove `useNavigate` import if no longer needed
- Remove `aiWorkout` query param handling
- The save flow is now entirely within `WorkoutCard` + `SaveWorkoutModal`

- [ ] **Step 5: Run tests**

Run: `cd frontend && npx vitest run src/components/ai-coach/__tests__/SaveWorkoutModal.test.tsx`
Expected: All PASS

- [ ] **Step 6: Manual test**

Run: `cd frontend && npm run dev`
- Go to AI Coach, generate a workout
- Click "Save as Workout" on the workout message
- Verify: modal opens inline, metrics load, can edit name/classification/effort
- Click Save → verify workout created, modal closes, message shows "Saved" indicator

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ai-coach/SaveWorkoutModal.tsx frontend/src/components/ai-coach/__tests__/SaveWorkoutModal.test.tsx frontend/src/components/ai-coach/WorkoutCard.tsx frontend/src/pages/AICoachPage.tsx
git commit -m "feat: add inline SaveWorkoutModal to AI Coach"
```

---

## Task 11: Regression Test Suite

**Files:**
- Create: `backend/tests/test_workout_regression.py`

Run the full 1901-workout ChromaDB corpus through both parsers.

- [ ] **Step 1: Write regression test**

```python
# backend/tests/test_workout_regression.py
"""Regression suite: run 1901 ChromaDB workouts through both parsers.

Requires: ANTHROPIC_API_KEY, chroma_db/ directory in project root.
Run separately from unit tests due to API cost and time.
Mark with @pytest.mark.regression.
"""
import pytest
import os
import chromadb
from app.services.workout_llm_parser import parse_workout_with_llm
from app.services.workout_totals import compute_totals
from app.services.workout_parser import WorkoutParser
from app.services.workout_analyzer import WorkoutAnalyzer

pytestmark = [
    pytest.mark.skipif(not os.getenv("ANTHROPIC_API_KEY"), reason="No API key"),
    pytest.mark.regression,
]

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "chroma_db")


@pytest.fixture(scope="module")
def all_workouts():
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    col = client.get_collection("swimming_workouts")
    results = col.get(limit=1901, include=["documents", "metadatas"])
    workouts = []
    for doc, meta in zip(results["documents"], results["metadatas"]):
        if doc and len(doc.strip()) > 50 and "Glossary" not in meta.get("title", ""):
            workouts.append({"text": doc, "title": meta.get("title", "Untitled")})
    return workouts


@pytest.fixture(scope="module")
def regex_analyzer():
    return WorkoutAnalyzer()


class TestRegressionSanity:
    @pytest.mark.asyncio
    async def test_llm_no_crashes(self, all_workouts):
        """LLM parser should not crash on any real workout."""
        failures = []
        for i, w in enumerate(all_workouts[:50]):  # Sample 50 for speed
            try:
                result = await parse_workout_with_llm(w["text"])
                assert "sections" in result
            except Exception as e:
                failures.append(f"{w['title']}: {e}")
        assert not failures, f"Crashes:\n" + "\n".join(failures)

    def test_regex_no_crashes(self, all_workouts, regex_analyzer):
        """Regex parser should not crash on any real workout."""
        failures = []
        for w in all_workouts:
            try:
                regex_analyzer.analyze_workout(w["text"])
            except Exception as e:
                failures.append(f"{w['title']}: {e}")
        assert not failures, f"Crashes:\n" + "\n".join(failures)

    @pytest.mark.asyncio
    async def test_llm_positive_meters(self, all_workouts):
        """LLM parser should return > 0 meters for real workouts."""
        zero_count = 0
        for w in all_workouts[:50]:
            result = await parse_workout_with_llm(w["text"])
            totals = compute_totals(result["sections"])
            if totals["total_meters"] == 0:
                zero_count += 1
        # Allow up to 5% zeros (some entries might be glossaries/metadata)
        assert zero_count / len(all_workouts[:50]) < 0.05
```

- [ ] **Step 2: Run regression suite (separately from unit tests)**

Run: `cd backend && python -m pytest tests/test_workout_regression.py -v -m regression --timeout=300`
Expected: All sanity checks PASS

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_workout_regression.py
git commit -m "test: add regression suite for 1901-workout ChromaDB corpus"
```

---

## Task 12: Final Integration Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && python -m pytest tests/ -v --ignore=tests/test_workout_regression.py`
Expected: All existing + new tests PASS

- [ ] **Step 2: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All existing + new tests PASS (ignoring pre-existing 19 failures)

- [ ] **Step 3: Run the full app and test end-to-end**

Run: `./run.sh`

Manual verification checklist:
- [ ] Create Workout page: clean editor layout, Analyze button works, metrics card shows
- [ ] Create Workout page: classification dropdown saves correctly
- [ ] AI Coach: generate workout, click Save as Workout, modal opens
- [ ] AI Coach: modal shows analysis, can edit name/classification, save works
- [ ] AI Coach: saved indicator appears on message after save
- [ ] Edit Workout: existing workouts load and display correctly (backwards compat)
- [ ] Quick-stats: still returns fast lightweight data

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: integration fixes from end-to-end testing"
```
