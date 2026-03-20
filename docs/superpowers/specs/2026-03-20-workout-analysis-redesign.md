# Workout Analysis & Create Workout Redesign

**Date:** 2026-03-20
**Status:** Draft
**Branch:** `feature/add-search-swimmer-feature` (current working branch)

## Problem Statement

The workout analysis system has three intertwined problems:

1. **Brittle parser**: The regex-based `WorkoutParser` (1320 lines) requires very specific `NxM` notation. Real workouts from 20+ sources across 1901 examples in ChromaDB use at least 5 distinct formatting styles that the parser fails on.
2. **Broken save flow**: "Save as Workout" from AI Coach dumps raw markdown into a URL query param and navigates to a separate page. The markdown renders poorly in the form.
3. **Cluttered create page**: The current split-panel layout with real-time updating metrics is over-engineered and noisy. Coaches care about text first, metrics second.

## Solution Overview

- Replace the primary parser with an **LLM-powered workout parser** (Claude Haiku) that handles any formatting style
- Improve the **regex parser** as a robust fallback for when the API is unavailable
- Switch from **real-time analysis** to **on-demand analysis** (Analyze button + auto-trigger after inactivity)
- Redesign the **Save-as-Workout flow** as an inline modal in the AI Chat (no page navigation)
- Redesign the **Create Workout page** with an editor-first layout

## Scope

### In Scope
- New LLM-powered workout parser service
- Improved regex parser (fallback)
- On-demand analysis flow (frontend + backend)
- Save-as-Workout inline modal in AI Coach
- Create/Edit Workout page redesign
- Stroke icons in breakdown display
- Manual workout classification (dropdown)
- Comprehensive test suite (golden set, regression, edge cases)

### Out of Scope
- Calorie estimation (removed per requirements)
- Auto-classification (replaced by manual dropdown)
- Changes to AI Coach workout generation (prompt_builder.py stays as-is)
- Changes to ChromaDB ingestion pipeline
- Mobile/React Native considerations

---

## Section 1: LLM-Powered Workout Parser

### Architecture

A new backend service `WorkoutLLMParser` sends raw workout text to Claude Haiku with a strict JSON schema using the **Anthropic tool_use API** for guaranteed schema conformance. The LLM extracts structured set data; the backend independently computes arithmetic totals from the extracted sets.

**Data flow:**
```
Raw workout text
  |
  v
Claude Haiku (temperature=0, tool_use for structured output)
  |
  v
Parsed sets array (reps, distance, stroke, activity, interval, etc.)
  |
  v
Server-side arithmetic (sum reps x distance, compute breakdowns)
  |
  v
Duration estimation (rule-based pace tables)
  |
  v
Final analysis response
```

### Cost & Rate Controls

- **Per-user rate limit**: Max 10 LLM analysis calls per minute per coach (enforced server-side)
- **Text length cap**: Max 5000 characters input (covers even 6000m+ workouts)
- **Response cache**: In-memory cache keyed on SHA-256 hash of workout text, 5-minute TTL. Identical text within the same session returns cached results instantly.
- **Timeout**: 10 second timeout on LLM call; falls back to regex on timeout

### LLM Output Schema

The LLM returns only the structured sets. The backend computes all totals.

```json
{
  "sections": [
    {
      "name": "Warm-up",
      "sets": [
        {
          "reps": 4,
          "distance": 100,
          "stroke": "freestyle",
          "activity": "swim",
          "interval": "1:35",
          "energy_zone": "en1",
          "equipment": [],
          "notes": "descend 1-4"
        }
      ]
    }
  ]
}
```

### Server-Side Computed Totals

After receiving the LLM output, the backend computes:

```json
{
  "sections": [ ... ],
  "totals": {
    "total_meters": 3200,
    "total_sets": 14,
    "estimated_duration_minutes": 55,
    "stroke_breakdown": {
      "freestyle": { "meters": 2400, "percentage": 75.0 },
      "backstroke": { "meters": 400, "percentage": 12.5 },
      "im": { "meters": 400, "percentage": 12.5 }
    },
    "activity_breakdown": {
      "swim": { "meters": 2600, "percentage": 81.3 },
      "kick": { "meters": 300, "percentage": 9.4 },
      "drill": { "meters": 300, "percentage": 9.4 }
    },
    "energy_zone_breakdown": {
      "en1": { "meters": 800, "percentage": 25.0 },
      "en2": { "meters": 1200, "percentage": 37.5 },
      "en3": { "meters": 800, "percentage": 25.0 },
      "sprint": { "meters": 400, "percentage": 12.5 }
    }
  }
}
```

### Validation Rules

- **Strict enums** for all categorical fields:
  - `stroke`: freestyle, backstroke, breaststroke, butterfly, im, choice
  - `activity`: swim, kick, pull, drill
  - `energy_zone`: en1, en2, en3, en4, sprint
  - `equipment`: fins, paddles, buoy, snorkel, band, board, parachute, tempo_trainer
- **Arithmetic verification**: `total_meters` must equal `sum(reps * distance)` across all sets. If the LLM returns a `totals` block, it is cross-checked against the server-computed value. Server arithmetic always wins.
- **Determinism**: `temperature=0` to ensure identical input produces identical output.
- Invalid enum values are mapped to the nearest valid value. For ambiguous strokes, default to `choice`. For ambiguous activities, default to `swim`.

### Error Handling & Fallback

When the LLM parser fails, the system falls back to the improved regex parser. Fallback triggers:
- LLM API timeout (>10s)
- HTTP 429 (rate limited) or 529 (overloaded) from Anthropic
- Malformed JSON response (even with tool_use, edge cases exist)
- Any unhandled exception in the LLM parsing pipeline

The response always includes a `parser_used: "llm" | "regex"` field so the frontend can display a notice when regex was used (e.g., "Analysis is approximate — AI parser unavailable").

### Duration Estimation

Duration estimation stays **rule-based** (not LLM) using pace tables from the existing `WorkoutTimeEstimator`. The LLM extracts the structure; pace math uses known constants:

- Base pace per 100m by stroke and activity type
- Energy zones affect pacing: sprint sets use faster base pace, EN1 uses slower recovery pace
- `choice` stroke uses the average of all stroke paces
- Interval-based timing when `@` notation is present (total time = interval × reps, rest is embedded)
- Default rest between sets (90s) when no interval specified

### Files

- **New:** `backend/app/services/workout_llm_parser.py` — LLM parsing service
- **New:** `backend/app/services/workout_totals.py` — server-side arithmetic for totals/breakdowns
- **Modified:** `backend/app/services/workout_analyzer.py` — orchestrates LLM parser + totals + duration estimation
- **Modified:** `backend/app/routes/workout_analysis.py` — updated endpoint to use new analyzer
- **Kept:** `backend/app/services/workout_parser.py` — improved regex fallback

---

## Section 2: Improved Regex Parser (Fallback)

The existing regex parser is improved to handle the most common format variations seen in the 1901-workout ChromaDB corpus. Target: **parse 70%+ of golden set workouts** correctly (compute `total_meters` within 10% of expected). This is a usable fallback, not a replacement for the LLM parser.

### Improvements

1. **Markdown stripping**: Strip `**bold**`, `# headers`, `*italic*` before parsing. Handle `**WARM-UP: 600 meters**` and `# MAIN SET` section headers.
2. **Prose-style distances**: Recognize `200 Free easy`, `300 choice`, `400 pull` — single distances without `x` notation.
3. **Round notation**: Parse `3 rounds of:` / `4 rounds:` / `N rounds` with indented or subsequent sets, expanding into repeated set entries.
4. **Inline breakdowns**: Handle `500 (25 Free/25 stroke, 50 Free/50 stroke...)` — parenthetical component descriptions.
5. **Rest notation variety**: `@:20 rest`, `1:00 rest`, `1:00 extra rest between rounds`, `:30 rest` (no `@`).
6. **Sub-section labels**: Recognize `*Sprint Set:*`, `Part A:`, `TECHNIQUE BLOCK 1:`, labeled sub-sections within main set.
7. **Pace notation**: Handle `@1:20/100 pace` (pace-per-100 intervals seen in distance workouts).

### Files

- **Modified:** `backend/app/services/workout_parser.py` — expanded patterns and pre-processing

---

## Section 3: On-Demand Analysis Flow

### Current Flow (Replaced)
1. Coach types workout text
2. `RealtimeWorkoutAnalyzer` fires on every change (1200ms debounce)
3. Calls `/workout-analysis/analyze` constantly
4. Side panel updates in real-time

### New Flow
1. Coach types/pastes workout text in a clean editor
2. **Quick-stats preview** (regex-powered) shows approximate total meters and set count instantly — lightweight, no API call
3. Coach clicks **"Analyze"** button OR auto-triggers after **4 seconds of inactivity**
4. Single call to `POST /workout-analysis/analyze` (LLM-powered)
5. **Metrics card** appears below the editor with full breakdown
6. If coach edits text after analysis, metrics card shows a **"Stale"** badge
7. If LLM API is unreachable, falls back to improved regex parser with a notice

### Backend Endpoint Changes

**`POST /workout-analysis/analyze`** (updated):
- Request: `{ "workout_text": "..." }`
- Primary: LLM parser → server-side totals → duration estimation
- Fallback: Improved regex parser → existing analyzer (automatic on LLM failure)
- Response always includes `parser_used: "llm" | "regex"` field
- Response schema is identical regardless of which parser was used

**`POST /workout-analysis/quick-stats`** (kept, regex-only):
- Lightweight endpoint for instant preview while LLM analysis is in-flight
- Returns: `{ "total_meters": int, "total_sets": int }` (approximate)
- No LLM call, regex-only, <100ms response time
- Other fields from the current response (`estimated_duration_minutes`, etc.) are dropped to keep this fast and focused

### Frontend Components

- **Removed:** `RealtimeWorkoutAnalyzer` component (deleted)
- **New:** `WorkoutMetricsCard` component — displays analysis results with stroke icons, breakdowns, stale badge
- **New:** `useWorkoutAnalysis` hook — manages analyze trigger (button + inactivity timer), loading state, stale detection

---

## Section 4: Save-as-Workout Flow (AI Coach)

### Current Flow (Broken)
1. Coach clicks "Save as Workout" in AI chat
2. Extracts last assistant message as raw markdown
3. Navigates to `/workouts/create?aiWorkout=<markdown-text>`
4. Markdown dumps into text field looking messy

### New Flow
1. Coach clicks **"Save as Workout"** on a workout message in the AI chat
2. An **inline modal/drawer** opens within the AI Coach page (no navigation)
3. The modal displays:
   - **Name**: Auto-generated via existing `POST /ai-coach/generate-title` endpoint
   - **Workout text**: Cleaned (markdown stripped for display, raw preserved for storage)
   - **Metrics card**: Pre-analyzed (LLM parse runs immediately when modal opens)
   - **Classification**: Manual dropdown (Sprint, Endurance, Technique, IM, Recovery, Race Prep)
   - **Effort level**: Slider (1-10)
   - **Tags**: Tag selector (existing component)
   - **Visibility**: Toggle (private/network/public)
4. Coach adjusts anything, clicks **Save**
5. `POST /workouts` creates the `workout_template` record with:
   - `raw_description`: Original workout text (with markdown)
   - `json_description`: Structured JSON from LLM parser (sections + totals)
   - `total_meters`, `estimated_time_minutes`: From computed totals
   - `classification`: Coach-selected value
6. Message metadata updated with `saved_workout_id` and `saved_workout_title` via `PATCH /ai-coach/conversations/{id}/messages/{msg_id}` (new endpoint) to persist the association in the backend `ai_coach_messages.message_metadata` JSON column
7. Modal closes, coach stays in conversation

### Files

- **New:** `frontend/src/components/ai-coach/SaveWorkoutModal.tsx`
- **Modified:** `frontend/src/components/ai-coach/WorkoutCard.tsx` — save button triggers modal instead of navigation
- **Modified:** `frontend/src/pages/AICoachPage.tsx` — remove `handleSaveWorkout` navigation, add modal state
- **New endpoint:** `PATCH /ai-coach/conversations/{id}/messages/{msg_id}` — updates message metadata (for saved_workout_id persistence)

---

## Section 5: Create/Edit Workout Page Redesign

Standalone page for creating workouts manually (not from AI Coach).

### Layout

```
+------------------------------------------------------------------+
| [Name field                          ] [Classification v] [Save] |
+------------------------------------------------------------------+
|                                                                   |
|  [Workout text editor - full width, monospace, spacious]          |
|  (placeholder: "Write your workout here...")                      |
|                                                                   |
+------------------------------------------------------------------+
| [Effort: ----o------] [Tags: + Add] [Visibility: Private v]      |
|                                          [Analyze]                |
+------------------------------------------------------------------+
| Metrics Card (appears after analysis)                             |
|                                                                   |
| Total: 3200m  |  14 sets  |  ~55 min                             |
|                                                                   |
| Stroke Breakdown:                                                 |
| [🏊 Free 75%] [🏊 Back 12%] [🏊 Fly 8%] [🏊 Breast 5%]         |
|                                                                   |
| Activity: [Swim 81%] [Kick 9%] [Drill 10%]                       |
| Energy:   [EN1 25%] [EN2 38%] [EN3 25%] [Sprint 12%]             |
+------------------------------------------------------------------+
```

### Stroke Icons

Icons from `public/images/`:
- `freestyle.png` → freestyle
- `backstroke.png` → backstroke
- `breastroke.png` → breaststroke (note: filename has typo, missing 't')
- `butterfly.png` → butterfly
- `im.png` → im
- `dives.png` → not used for workouts
- `choice` → Lucide fallback icon (e.g. `Waves` or `Shuffle`)

### Key Changes from Current Page

- **Removed:** Split panel layout with real-time metrics
- **Removed:** Calorie estimation
- **Removed:** Separate `description` field — `rawDescription` is the single source of truth
- **Removed:** `EditMetricModal` — metrics come from analysis, not manual override
- **Added:** Classification dropdown (manual)
- **Added:** Analyze button with stale detection
- **Added:** Stroke icons in breakdown display
- **Changed:** Metrics appear on-demand, not in real-time

### Database Changes

- **Add column:** `workout_template.classification` — `VARCHAR(50)`, nullable, stores coach-selected classification
  - Alembic migration created in Phase 3 of rollout: `backend/alembic/versions/xxxx_add_classification_to_workout_template.py`
  - Zero-downtime: nullable column with no default, no data backfill needed
  - Existing workouts will show "Unclassified" in the UI when `classification IS NULL`
- **Remove usage of:** `estimated_calories` field — stop writing to it (column stays for backwards compat, just ignored)
- **`description` field**: Stop writing to `workout_template.description`. The `raw_description` field is the single source of truth for workout text. The `description` column remains in the schema but is no longer read or written by new code. Existing data is preserved.

### Backwards Compatibility

- Workouts saved before this change will have `classification = NULL` → UI shows "Unclassified"
- Workouts with old `json_description` schema (from regex parser) will still render — the `WorkoutMetricsCard` handles both old and new JSON shapes gracefully
- The `description` column is not deleted; old workouts that only populated `description` (not `raw_description`) will display `description` as fallback

### Files

- **Modified:** `frontend/src/pages/WorkoutForm.tsx` — full redesign
- **Modified:** `frontend/src/pages/WorkoutForm/hooks/useWorkoutForm.ts` — remove real-time analysis, add on-demand
- **Removed:** `frontend/src/components/workout/RealtimeWorkoutAnalyzer.tsx`
- **New:** `frontend/src/components/workout/WorkoutMetricsCard.tsx`
- **New:** `frontend/src/hooks/useWorkoutAnalysis.ts`
- **Migration:** Add `classification` column to `workout_template`

---

## Section 6: Testing Strategy

### Accuracy Target: 99%

The LLM parser must correctly extract sets, distances, strokes, and activities from 99% of real-world workout formats. "Correctly" means server-computed `total_meters` matches the hand-verified expected value exactly.

### Test Tiers

#### Tier 1: Golden Set (50 workouts, exact match)

Hand-pick 50 workouts from ChromaDB spanning:
- All 20 source styles (USMS, Athlete Approved, Claude AI Generator, Swimming Wizard, compiled patterns, etc.)
- All format variations (standard NxM, prose-style, round-based, markdown headers, inline breakdowns)
- Range of distances (1500m recovery to 6000m distance)
- All stroke/activity/energy zone combinations

For each workout:
- Manually verify expected `total_meters`, `total_sets`, stroke breakdown, activity breakdown
- Assert **exact match** on `total_meters` and `total_sets`
- Assert **exact match** on stroke and activity breakdown meters

These are snapshot tests stored as JSON fixtures.

#### Tier 2: Regression Suite (1901 workouts, sanity checks)

Run the full ChromaDB corpus through both parsers:
- Assert `total_meters > 0` for all workouts that have actual content
- Assert `total_sets > 0`
- Assert no crashes/exceptions
- Assert response time < 5s per workout (LLM) and < 100ms (regex)
- Log any workout where LLM and regex disagree by more than 20% for manual review

#### Tier 3: Edge Cases

- Empty string
- Garbage text / non-workout content
- Single-line workout (`400 Free`)
- Workout with only a warm-up
- Mixed yards/meters in same workout
- Extremely long workout (10000+ meters)
- Unicode characters, emoji, special formatting
- Workout with no recognizable sets (should return zero gracefully)

#### Tier 4: Parser Comparison

For the golden set, run both LLM and regex parsers and compare:
- Document where regex falls short (expected, this motivates the LLM approach)
- Document where regex matches LLM (validates the fallback)
- Track accuracy percentage for both parsers across the golden set

#### Tier 5: Determinism

Run 10 golden set workouts through the LLM parser 5 times each:
- Assert identical `total_meters` and `total_sets` across all runs
- Assert identical stroke and activity breakdown meters across all runs
- `temperature=0` should guarantee this, but `notes` text may vary slightly — only assert on numeric/enum fields, not free-text

### Test Files

- **New:** `backend/tests/test_workout_llm_parser.py` — golden set + edge cases
- **New:** `backend/tests/test_workout_totals.py` — arithmetic verification
- **New:** `backend/tests/test_workout_regression.py` — full corpus sanity
- **New:** `backend/tests/fixtures/golden_workouts.json` — 50 hand-verified workouts
- **Modified:** `backend/tests/test_workout_parser.py` — updated for regex improvements
- **New:** `frontend/src/components/workout/__tests__/WorkoutMetricsCard.test.tsx`
- **New:** `frontend/src/components/ai-coach/__tests__/SaveWorkoutModal.test.tsx`
- **New:** `frontend/src/hooks/__tests__/useWorkoutAnalysis.test.ts`

---

## Migration / Rollout

1. **Phase 1**: Build LLM parser + totals service + tests (backend only)
2. **Phase 2**: Improve regex parser + tests (backend only)
3. **Phase 3**: Update `/workout-analysis/analyze` endpoint + Alembic migration for `classification` column + `PATCH` message metadata endpoint
4. **Phase 4**: Build frontend components (WorkoutMetricsCard, SaveWorkoutModal, useWorkoutAnalysis hook)
5. **Phase 5**: Redesign Create/Edit Workout page
6. **Phase 6**: Redesign Save-as-Workout flow in AI Coach
7. **Phase 7**: Full integration testing, golden set validation, regression suite

Each phase can be tested independently before moving to the next.
