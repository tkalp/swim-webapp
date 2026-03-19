# AI Coach Re-Engineer — SP2: Two-Stage RAG & Coach Style Engine

**Date:** 2026-03-19
**Status:** Approved
**Branch:** `feature/add-search-swimmer-feature`
**Part of:** AI Coach Re-Engineer (4 sub-projects: SP1 → SP2 → SP3 → SP4)
**Depends on:** SP1 (populated ChromaDB with 750+ tagged workouts)

## Problem

The current AI Coach has no personalization. Every coach gets the same generic output regardless of how they write workouts. The retrieval is a single vector search on a thin corpus with no metadata filtering. Coaches want workouts that sound like they wrote them.

## Goal

Replace the single-stage vector search with a two-stage retrieval system (global pool + coach's personal context) and build a coach style engine that learns from saved workouts and optional style notes.

## Architecture Overview

```
Coach requests workout generation
    |
    v
Stage 1: Global Pool (ChromaDB)
    - Metadata-filtered vector search
    - 5 structurally diverse examples
    |
    v
Stage 2: Coach's Personal Context (PostgreSQL)
    - 3 most recent saved workouts
    - Pre-computed style profile (JSONB on coach table)
    - Optional free-text coaching style notes
    |
    v
Prompt Assembly
    1. System prompt (swim coach persona)
    2. Coach style profile
    3. Coach's style notes (if set)
    4. Coach's 3 recent workouts
    5. 5 global pool examples
    6. Athlete performance data
    7. User's request
    |
    v
Claude Sonnet → Generated workout
```

## Database Changes

### Migration: Add columns to `coach` table + missing index

```sql
ALTER TABLE coach
    ADD COLUMN style_profile JSONB,
    ADD COLUMN coaching_style_notes TEXT;

-- Critical: workout_template.create_by_coach has no index.
-- Style queries, Stage 2 retrieval, and RLS policy all scan this column.
CREATE INDEX ix_workout_template_create_by_coach ON workout_template (create_by_coach);
```

Migration `down_revision` must be `'c080fc5d3fbf'` (current head).

**`style_profile`** — Pre-computed JSON analysis of the coach's workout writing style. Computed by a Celery task when the coach saves a workout. NULL if the coach has fewer than 3 saved workouts (insufficient data).

Schema:
```json
{
  "warm_up_pattern": "Usually starts with 400 choice",
  "preferred_distances": "Favors 50s and 100s for main sets",
  "interval_style": "Tight intervals, short rest",
  "notation_style": "Uses shorthand (Fr, Bk, Br, Fly)",
  "stroke_emphasis": "Freestyle-dominant with weekly IM work",
  "activity_mix": "Heavy kick work (~25%), moderate drill",
  "set_structure": "Prefers descending sets and broken swims",
  "personality": "Technical and precise",
  "typical_volume": "3000-4000 meters",
  "coaching_cues": ["streamline off every wall", "DPS on easy", "negative split"],
  "workout_count": 15,
  "last_analyzed_at": "2026-03-19T14:30:00Z"
}
```

**`coaching_style_notes`** — Free-text field where the coach describes their style in their own words. Optional. Set via API endpoint. **Max 2000 characters** — enforced at the Pydantic schema level on `PUT /api/coaches/me/style-notes` to prevent prompt bloat.

### `workout_template` — add missing index

The existing `create_by_coach` FK links workouts to coaches, but has **no index**. This column is queried by style computation, Stage 2 retrieval, and the existing RLS policy. The migration adds `ix_workout_template_create_by_coach`.

Also add to the SQLAlchemy model:
```python
# WorkoutTemplate
__table_args__ = (
    Index("ix_workout_template_create_by_coach", "create_by_coach"),
)
```

### No new tables

Style data lives on the existing `coach` table. No junction tables or separate style tables needed.

## Style Profile Computation

### Trigger

Celery task dispatched when a coach saves/creates/updates a workout template (from the existing workout template API routes).

### Process

1. Query `workout_template` where `create_by_coach = coach_id`, order by `created_at DESC`, limit 20
2. If fewer than 3 workouts, skip (clear `style_profile` to NULL)
3. Format workouts as text context
4. Single Claude Haiku call to extract style patterns → JSON
5. Update `coach.style_profile` with result + `workout_count` + `last_analyzed_at`

### Classifier prompt

```
Analyze these swim workouts written by the same coach and extract their coaching style.
Return JSON only, no explanation.

Workouts:
"""
{formatted_workouts — title + raw_description for each}
"""

Return this exact JSON structure:
{
  "warm_up_pattern": "<how they typically structure warm-ups>",
  "preferred_distances": "<most common set distances and preferences>",
  "interval_style": "<rest patterns, interval philosophy>",
  "notation_style": "<stroke abbreviations, formatting conventions>",
  "stroke_emphasis": "<which strokes they emphasize>",
  "activity_mix": "<swim/kick/drill/pull balance>",
  "set_structure": "<favorite set types: descending, pyramids, broken, etc.>",
  "personality": "<overall coaching voice and approach>",
  "typical_volume": "<usual total distance range>",
  "coaching_cues": ["<common phrases they use>", "..."]
}
```

### Cost

~$0.005 per computation (Haiku with ~2000 tokens). Runs only on workout save — negligible.

### Skip condition

If coach has fewer than 3 saved workouts, don't compute. The generation prompt falls back to global pool only (no personalization).

## Two-Stage Retrieval

### Stage 1: Global Pool (ChromaDB)

Query the `swimming_workouts` collection populated by SP1:

1. Extract keywords from the user's prompt for metadata filtering (e.g., "sprint" → `training_focus=sprint`)
2. Build ChromaDB `where` filter from extracted metadata
3. Query: `collection.query(query_texts=[prompt], where=filter, n_results=5)`
4. Format results via `build_context()` (already compatible with SP1's `Title:/Workout:` document format)

**Metadata filter extraction:** Simple keyword matching from the prompt:
- "sprint" / "fast" / "speed" → `training_focus: "sprint"`
- "endurance" / "distance" / "aerobic" → `training_focus: "endurance"`
- "technique" / "drill" / "form" → `training_focus: "technique"`
- "IM" / "medley" → `training_focus: "IM"`
- "recovery" / "easy" → `training_focus: "recovery"`
- If no keywords match, don't filter (full vector search)

### Stage 2: Coach's Personal Context (PostgreSQL)

1. Query `workout_template` where `create_by_coach = coach_id`, order by `created_at DESC`, limit 3
2. Format each as: title + raw_description text
3. Load `coach.style_profile` (the pre-computed JSONB)
4. Load `coach.coaching_style_notes` (the free-text field)

### Prompt Assembly

```
SYSTEM: {SWIM_COACH_SYSTEM_PROMPT — existing 107-line system prompt}

USER MESSAGE:

COACHING STYLE PROFILE:
{style_profile formatted as readable key-value pairs}

COACH'S STYLE NOTES:
"{coaching_style_notes}" (omitted if NULL)

RECENT WORKOUTS BY THIS COACH (match this style):
---
{workout 1: title + raw_description}
---
{workout 2: title + raw_description}
---
{workout 3: title + raw_description}

EXAMPLE WORKOUTS FROM DATABASE (for structural reference):
{5 ChromaDB results via build_context()}

ATHLETE PERFORMANCE DATA:
{best times + calculated intervals — existing logic from prompt_builder.py}

USER REQUEST:
{the coach's prompt}

Generate a workout that matches this coach's writing style, notation, and training philosophy.
```

## API Changes

### New endpoints

**`GET /api/coaches/me/style`**
- Auth: `Depends(get_current_user_id)` → resolve coach
- Returns: `{style_profile: dict|null, coaching_style_notes: str|null, workout_count: int}`

**`PUT /api/coaches/me/style-notes`**
- Auth: `Depends(get_current_user_id)` → resolve coach
- Body: `{coaching_style_notes: str}` — Pydantic `Field(max_length=2000)`
- Updates `coach.coaching_style_notes`
- Returns: `{coaching_style_notes: str}`

**`POST /api/coaches/me/style/recompute`**
- Auth: `Depends(get_current_user_id)` → resolve coach
- Dispatches `recompute_coach_style_task` Celery task
- Returns: `{status: "queued"}`

### Modified endpoints

**`POST /api/ai-coach/generate`**
- Same request/response schema (no breaking changes)
- Internally: resolves coach_id from auth, loads style context, does two-stage retrieval, assembles enhanced prompt
- Falls back gracefully: if no style profile, uses global pool only; if no ChromaDB, uses coach workouts only; if neither, behaves like current implementation

### Celery task

**`recompute_coach_style_task(coach_id: str)`**
- Registered in worker's Celery app
- Queries coach's recent workouts from PostgreSQL
- Calls Claude Haiku for style analysis
- Updates `coach.style_profile` column
- Auto-dispatched from workout template save routes

## File Changes

### New files
- `backend/app/services/coach_style_service.py` — style profile CRUD, analysis prompt, Celery task dispatch
- `backend/app/routes/coach_style.py` — 3 new endpoints (GET style, PUT notes, POST recompute)
- Alembic migration for `coach` table columns

### Modified files
- `backend/app/services/ai_coach/workout_generator.py` — rewrite `generate_workout()` for two-stage retrieval
- `backend/app/services/ai_coach/prompt_builder.py` — add `build_style_context()` and `build_coach_examples()` functions
- `backend/app/services/ai_coach/client.py` — update `generate_with_claude()` to accept the richer prompt
- `backend/app/routes/ai_coach.py` — pass coach_id into generate flow
- `backend/app/main.py` — register new coach_style router
- `worker/celery_app.py` — register new task
- `worker/sync_tasks.py` — add `recompute_coach_style_task`

### Workout save trigger
- `backend/app/routes/workouts.py` (or wherever workout templates are created/updated) — add Celery task dispatch after successful save

## Error Handling

- **No style profile:** Generation works without personalization (global pool only). No error surfaced to user.
- **ChromaDB unavailable:** Fall back to coach's workouts only. Log warning.
- **Both unavailable:** Fall back to current behavior (generic prompt). Log error.
- **Style computation fails:** Log error, leave `style_profile` as-is (stale data better than no data).
- **Coach has 0 workouts:** No personalization, no style profile. Fully functional with global pool only.

## Success Criteria

- [ ] Coach with 5+ saved workouts gets a computed style profile
- [ ] Generated workouts reflect the coach's notation style and set preferences
- [ ] `GET /api/coaches/me/style` returns the profile
- [ ] `PUT /api/coaches/me/style-notes` persists free-text notes
- [ ] Workout generation uses both global pool and coach context
- [ ] Generation still works for coaches with 0 saved workouts (graceful fallback)
- [ ] Style profile recomputes on workout save (Celery task)
- [ ] Metadata-filtered ChromaDB queries improve retrieval relevance

## Out of Scope (SP3-SP4)

- Frontend UI for style notes / style profile display (SP3)
- Workout quality scoring / feedback loop (SP4)
- A/B testing of personalized vs generic (SP4)
- Coach style comparison / sharing (future)
