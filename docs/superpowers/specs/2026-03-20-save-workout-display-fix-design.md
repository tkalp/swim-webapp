# Save-as-Workout Display Fix

**Date:** 2026-03-20
**Status:** Draft
**Branch:** `feature/add-search-swimmer-feature`

## Problem Statement

When coaches save an AI-generated workout from the AI Coach chat, the stored `raw_description` contains residual markdown artifacts (bullets, numbered lists, backticks) that `stripMarkdown()` doesn't catch. More importantly, the `WorkoutPreviewModal` displays `raw_description` as preformatted plain text, ignoring the rich structured data already stored in `json_description` (parsed sections, sets with reps/distance/stroke/interval, breakdowns). Coaches see a wall of text instead of a clean, formatted workout.

Additionally, older workouts saved before the LLM analyzer existed have no `json_description` at all.

## Solution Overview

1. Improve `stripMarkdown()` to catch all common markdown artifacts
2. Create a new `WorkoutStructuredView` component that renders workouts from `json_description` in a coach-friendly format
3. Update all workout display surfaces to use the structured view
4. Add a backend Celery task to backfill `json_description` for legacy workouts

## Scope

### In Scope
- Extended markdown stripping (bullets, numbered lists, backticks, links, blockquotes)
- New `WorkoutStructuredView` component
- Shared `normalizeToWorkoutAnalysis()` utility (replaces 3 duplicate normalizers)
- `WorkoutPreviewModal` update (Discover Workouts page — clone flow)
- `WorkoutView` page update (coach's own workout detail page)
- `WorkoutMiniChart` update (use shared normalizer)
- `SquadWorkouts` inline preview update
- Backend backfill Celery task for legacy workouts

### Out of Scope
- Changes to the WorkoutForm edit/create page (stays as raw text editor with on-demand analysis)
- Changes to AI Coach workout generation or prompt_builder
- Changes to the LLM parser or regex parser
- Changes to the `SaveWorkoutModal` flow (already working correctly)

---

## Section 1: Improved `stripMarkdown()`

**File:** `frontend/src/utils/cleanWorkoutText.ts`

Extend the existing `stripMarkdown()` function to handle additional markdown patterns:

| Pattern | Example | Action |
|---------|---------|--------|
| Bullet lists | `- item`, `* item` | Strip marker, keep text |
| Numbered lists | `1. item` | Strip number+dot, keep text |
| Inline code | `` `text` `` | Unwrap backticks |
| Links | `[text](url)` | Keep text, drop URL |
| Blockquotes | `> text` | Strip the `>` |

Existing handling (bold, italic, headers, horizontal rules, blank line collapsing) stays unchanged.

---

## Section 2: `WorkoutStructuredView` Component

**File:** `frontend/src/components/workout/WorkoutStructuredView.tsx`

A read-only component that renders a saved workout from its structured data.

### Layout (top to bottom)

1. **Metrics summary** — Reuse the existing `WorkoutMetricsCard` component. The component accepts a `WorkoutAnalysis` shape from `workoutAnalysisService.ts`. `WorkoutStructuredView` maps from whatever `json_description` format is stored (see Data Shape Normalization below) to the `WorkoutAnalysis` interface before passing to `WorkoutMetricsCard`.

2. **Sections** — Each section (Warm-up, Main Set, Cool-down, etc.) from `json_description.sections` rendered as a labeled group:
   - Section header (e.g., "Warm-up", "Main Set") styled as a subtle label
   - Sets listed beneath

3. **Sets** — Each set rendered as a single line in standard coach notation:
   ```
   4 x 100 Freestyle @ 1:30 [fins]
   ```
   Format: `{reps} x {distance} {stroke} @ {interval} [{equipment}]`
   - Fields that are null/empty are omitted (no interval → skip `@` portion, no equipment → skip brackets)
   - If a set has a `notes` field, show it as muted text below the set line

4. **Coaching notes** — The workout's `description` field (coaching notes extracted during save) rendered below the sets, if present.

5. **"Show original text"** — A small, subtle link at the bottom. On click, expands a `<pre>` block showing `raw_description`. Collapsed by default. Toggle text: "Show original text" / "Hide original text".

### Data Shape Normalization

The `json_description` column has been written by different code paths over time. `WorkoutStructuredView` must handle all known formats:

| Format | Shape | Source |
|--------|-------|--------|
| **New format** (from SaveWorkoutModal + backfill) | `{ sections: [...], totals: { total_meters, stroke_breakdown: { freestyle: { meters, percentage } }, ... } }` | Current save flow, backfill task |
| **Versioned format** | `{ version: N, analysis: { total_meters, stroke_breakdown: { freestyle: N }, ... } }` | Older save paths |
| **Legacy estimate format** | `{ estimate: { totalDistance, strokeBreakdown: { freestyle: N } } }` | Oldest save path |

The component includes a `normalizeToWorkoutAnalysis(jsonDesc: any): WorkoutAnalysis | null` helper that converts any of these formats into the standard `WorkoutAnalysis` interface (from `workoutAnalysisService.ts`). This replaces the existing `normalizeJsonDescription()` in `WorkoutPreviewModal` and consolidates format handling in one place.

### Fallback

If `json_description` is missing, null, or has no parseable `sections` array, fall back to rendering `raw_description` as cleaned plain text (applying the improved `stripMarkdown()`). No "show original" toggle in this case since the text IS the original.

### Props Interface

```typescript
interface WorkoutStructuredViewProps {
  jsonDescription?: Record<string, any>;  // accepts any format, normalized internally
  rawDescription?: string;
  description?: string;  // coaching notes
}
```

The set type aligns with the existing `WorkoutAnalysis.sections[].sets[]` interface from `workoutAnalysisService.ts`:

```typescript
// From workoutAnalysisService.ts — this is the canonical type
{
  reps: number;
  distance: number;
  stroke: string;
  activity: string;
  interval?: string;
  energy_zone: string;
  equipment?: string[];
  notes?: string;  // NOT "description" — use "notes" consistently
}
```

---

## Section 3: Display Surface Updates

### 3a. `WorkoutPreviewModal`

**File:** `frontend/src/components/workouts/WorkoutPreviewModal.tsx`

This modal is used on the **Discover Workouts** page. It shows a shared workout with community ratings, clone count, and a "Clone to My Library" button. It does NOT have Edit or Delete actions.

**Changes:**
- Replace the "Workout Details" section (lines 255-298: line numbers + `<pre>` raw_description) with `<WorkoutStructuredView>`
- Replace the "Stats Grid" section (lines 164-227: hand-rolled distance/duration/calories/effort cards) — these are now handled by `WorkoutMetricsCard` inside `WorkoutStructuredView`
- Remove `normalizeJsonDescription()` helper — logic moves to `WorkoutStructuredView`
- Remove `WorkoutBreakdownCharts` usage (lines 300-303) — stroke/activity breakdowns are now inside `WorkoutMetricsCard`
- **Keep unchanged:** header (workout name + coach name + difficulty badge), community rating section, "Copy" button (copies `raw_description` to clipboard — stays in the modal header bar), "Close" and "Clone to My Library" action buttons

**Copy button:** Stays in the modal. Copies `raw_description` (the clean text version). This is intentional — coaches copy workout text to paste into other tools (e.g., team apps, printed sheets). The structured view is for reading; copy is for exporting.

### 3b. `WorkoutView` Page

**File:** `frontend/src/pages/WorkoutView.tsx`

The coach's own workout detail page (reached by clicking "View" from the library). Has Edit, Delete, Copy, Download actions. Currently renders `raw_description` as `<pre>` text with its own duplicate `normalizeJsonDescription()` + hand-rolled stats grid + `WorkoutBreakdownCharts`.

**Changes:**
- Replace the raw text display + stats grid + `WorkoutBreakdownCharts` with `<WorkoutStructuredView>`
- Remove the local `normalizeJsonDescription()` duplicate — normalization moves to `WorkoutStructuredView`
- **Keep unchanged:** header (workout name, back button), action buttons (Edit, Delete, Copy, Download), tags display, metadata (created date, classification, effort level)
- **Copy button:** Same behavior as WorkoutPreviewModal — copies `raw_description`

### 3c. `WorkoutsLibrary` Page

**File:** `frontend/src/pages/WorkoutsLibrary.tsx`

The coach's workout library list. Shows truncated `raw_description` as preview text in workout cards and inline mini-charts from `json_description`.

**Changes:**
- Truncated preview text in list cards stays as-is (it's just a snippet for scanning)
- No structural changes — clicking "View" navigates to `WorkoutView` (covered in 3b)

### 3d. `WorkoutMiniChart`

**File:** `frontend/src/components/workout/WorkoutMiniChart.tsx`

Used in workout list cards for small inline stroke breakdown charts. Has its own duplicate `normalizeJsonDescription()`.

**Changes:**
- Extract the shared `normalizeToWorkoutAnalysis()` helper into a utility file (`frontend/src/utils/normalizeWorkoutData.ts`) and import it here instead of using the local duplicate
- The `WorkoutMiniChart` component itself stays unchanged — it just needs to use the shared normalization

### 3e. `SquadWorkouts` Component

**File:** `frontend/src/components/squad/SquadWorkouts.tsx`

Shows workouts assigned to a squad. Currently renders `raw_description` as `<pre>` text (line 327).

**Changes:**
- Replace `<pre>{workout.raw_description}</pre>` with `<WorkoutStructuredView>` when showing workout details

---

## Section 4: Backend Backfill Task

**File:** `backend/app/tasks/backfill_workout_analysis.py` (new)

A Celery task that backfills `json_description` for legacy workouts that were saved before the LLM analyzer existed.

### Query
```sql
SELECT id, raw_description
FROM workout_template
WHERE json_description IS NULL
  AND raw_description IS NOT NULL
  AND raw_description != ''
```

### Processing
For each matching workout:
1. Call the existing `WorkoutAnalyzer.analyze(raw_description)` service (LLM primary, regex fallback)
2. Transform the `WorkoutAnalysis` result into the **new format** used by `SaveWorkoutModal`:
   ```python
   json_description = {
       "sections": analysis.sections,
       "totals": {
           "total_meters": analysis.total_meters,
           "total_sets": analysis.total_sets,
           "estimated_duration_minutes": analysis.estimated_duration_minutes,
           "rest_time_minutes": analysis.rest_time_minutes,
           "stroke_breakdown": analysis.stroke_breakdown,
           "activity_breakdown": analysis.activity_breakdown,
           "energy_zone_breakdown": analysis.energy_zone_breakdown,
       }
   }
   ```
3. UPDATE the row with:
   - `json_description` = the structured object above
   - `total_meters` = analysis.total_meters
   - `estimated_time_minutes` = analysis.estimated_duration_minutes
4. Small delay between LLM calls (1-2 seconds) to avoid rate limiting

### Error Handling
- If analysis fails for a workout (unparseable text, LLM error, regex fallback also fails), **log the error and skip** — do not halt the entire batch
- Log: workout id, error message, raw_description length
- At the end, log summary: total processed, succeeded, failed

### Properties
- **Idempotent:** Skips rows that already have `json_description` (WHERE clause ensures this)
- **Rate limited:** Sequential processing, one workout at a time, with configurable delay between API calls
- **Resumable:** If worker restarts, re-running the task picks up where it left off (idempotent query skips completed rows)
- **Trigger:** Manual — invoked via management endpoint (`POST /admin/backfill-workout-analysis`) or CLI
- **Logging:** Log each workout processed (id, parser_used, total_meters) for audit trail

### Admin Endpoint
```
POST /api/admin/backfill-workout-analysis
```
Kicks off the Celery task asynchronously. Returns task ID. Admin-only (existing admin auth check).

---

## Testing

### Frontend
- Unit tests for extended `stripMarkdown()` covering all new patterns (bullets, numbered lists, backticks, links, blockquotes)
- Unit tests for `WorkoutStructuredView`:
  - Renders sections/sets correctly from new-format `json_description`
  - Renders correctly from versioned format
  - Renders correctly from legacy estimate format
  - Falls back to raw text when `json_description` is missing
  - Shows/hides original text toggle
  - Formats set line correctly with all fields
  - Omits missing fields gracefully (no interval, no equipment)

### Backend
- Unit test for backfill task — mocks the analyzer, verifies:
  - Correct rows are selected (NULL json_description only)
  - Analysis result is transformed to the correct format
  - Failed analyses are skipped with logging
  - Already-processed rows are not re-processed
