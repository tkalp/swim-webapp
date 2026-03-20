# Save-as-Workout Display Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw text workout display with structured, coach-friendly rendering using existing parsed data, and backfill legacy workouts missing analysis.

**Architecture:** A shared normalizer utility converts any `json_description` format to the canonical `WorkoutAnalysis` type. A new `WorkoutStructuredView` component renders sections/sets in coach notation with `WorkoutMetricsCard` for breakdowns. All display surfaces swap in this component. A Celery task backfills legacy workouts via the V2 analyzer.

**Tech Stack:** React/TypeScript (frontend), Vitest/RTL (tests), FastAPI/Celery/SQLAlchemy (backend), Python pytest (backend tests)

**Spec:** `docs/superpowers/specs/2026-03-20-save-workout-display-fix-design.md`

---

### Task 1: Extend `stripMarkdown()` with tests

**Files:**
- Modify: `frontend/src/utils/cleanWorkoutText.ts:53-72`
- Create: `frontend/src/utils/__tests__/cleanWorkoutText.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/utils/__tests__/cleanWorkoutText.test.ts
import { describe, it, expect } from 'vitest';
import { stripMarkdown, splitWorkoutText, stripNotesHeader } from '../cleanWorkoutText';

describe('stripMarkdown', () => {
  // Existing patterns (regression)
  it('strips bold', () => {
    expect(stripMarkdown('**bold text**')).toBe('bold text');
  });

  it('strips italic', () => {
    expect(stripMarkdown('*italic text*')).toBe('italic text');
  });

  it('strips heading markers', () => {
    expect(stripMarkdown('### Warm-up')).toBe('Warm-up');
  });

  it('strips horizontal rules', () => {
    expect(stripMarkdown('---')).toBe('');
  });

  // New patterns
  it('strips bullet lists (dash)', () => {
    expect(stripMarkdown('- 4x100 Free')).toBe('4x100 Free');
  });

  it('strips bullet lists (asterisk)', () => {
    expect(stripMarkdown('* 4x100 Free')).toBe('4x100 Free');
  });

  it('strips numbered lists', () => {
    expect(stripMarkdown('1. 4x100 Free')).toBe('4x100 Free');
    expect(stripMarkdown('12. 4x100 Free')).toBe('4x100 Free');
  });

  it('strips inline code backticks', () => {
    expect(stripMarkdown('Use `fins` for this set')).toBe('Use fins for this set');
  });

  it('strips links, keeps text', () => {
    expect(stripMarkdown('[click here](https://example.com)')).toBe('click here');
  });

  it('strips blockquotes', () => {
    expect(stripMarkdown('> Focus on technique')).toBe('Focus on technique');
  });

  it('handles mixed markdown', () => {
    const input = '### Warm-up\n- **4x100** Free\n- *2x50* Back\n> Easy pace\n---';
    const result = stripMarkdown(input);
    expect(result).toBe('Warm-up\n4x100 Free\n2x50 Back\nEasy pace');
  });

  it('preserves non-markdown content', () => {
    expect(stripMarkdown('4x100 Free @ 1:30')).toBe('4x100 Free @ 1:30');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/utils/__tests__/cleanWorkoutText.test.ts`
Expected: New pattern tests (bullets, numbered lists, backticks, links, blockquotes) FAIL

- [ ] **Step 3: Implement the new stripping patterns**

Add these to `stripMarkdown()` in `frontend/src/utils/cleanWorkoutText.ts`, between the horizontal rules removal and the blank line collapsing:

```typescript
// Remove bullet list markers: - item, * item (but not ** bold or --- rules)
result = result.replace(/^[\t ]*[-*]\s+/gm, '');

// Remove numbered list markers: 1. item, 12. item
result = result.replace(/^[\t ]*\d+\.\s+/gm, '');

// Remove inline code backticks: `text` -> text
result = result.replace(/`([^`]+)`/g, '$1');

// Remove links: [text](url) -> text
result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

// Remove blockquotes: > text -> text
result = result.replace(/^>\s?/gm, '');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/utils/__tests__/cleanWorkoutText.test.ts`
Expected: ALL PASS

---

### Task 2: Create shared `normalizeToWorkoutAnalysis()` utility

**Files:**
- Create: `frontend/src/utils/normalizeWorkoutData.ts`
- Create: `frontend/src/utils/__tests__/normalizeWorkoutData.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/utils/__tests__/normalizeWorkoutData.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeToWorkoutAnalysis } from '../normalizeWorkoutData';

describe('normalizeToWorkoutAnalysis', () => {
  it('returns null for null input', () => {
    expect(normalizeToWorkoutAnalysis(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeToWorkoutAnalysis(undefined)).toBeNull();
  });

  it('normalizes new format (sections + totals)', () => {
    const input = {
      sections: [
        {
          name: 'Warm-up',
          sets: [{ reps: 4, distance: 100, stroke: 'freestyle', activity: 'swim', energy_zone: 'en1' }],
        },
      ],
      totals: {
        total_meters: 400,
        total_sets: 1,
        estimated_duration_minutes: 8,
        rest_time_minutes: 0,
        stroke_breakdown: { freestyle: { meters: 400, percentage: 100 } },
        activity_breakdown: { swim: { meters: 400, percentage: 100 } },
        energy_zone_breakdown: { en1: { meters: 400, percentage: 100 } },
      },
    };
    const result = normalizeToWorkoutAnalysis(input);
    expect(result).not.toBeNull();
    expect(result!.total_meters).toBe(400);
    expect(result!.sections).toHaveLength(1);
    expect(result!.stroke_breakdown.freestyle.meters).toBe(400);
    expect(result!.parser_used).toBe('llm');
  });

  it('normalizes versioned format', () => {
    const input = {
      version: 1,
      analysis: {
        total_meters: 2000,
        estimated_duration_minutes: 45,
        estimated_calories: 900,
        stroke_breakdown: { freestyle: 1200, backstroke: 800 },
        activity_breakdown: { swim: 1500, kick: 500 },
      },
    };
    const result = normalizeToWorkoutAnalysis(input);
    expect(result).not.toBeNull();
    expect(result!.total_meters).toBe(2000);
    expect(result!.stroke_breakdown.freestyle.meters).toBe(1200);
    expect(result!.stroke_breakdown.backstroke.meters).toBe(800);
  });

  it('normalizes legacy estimate format', () => {
    const input = {
      estimate: {
        totalDistance: 3000,
        totalMinutes: 60,
        strokeBreakdown: { freestyle: 2000, breaststroke: 1000 },
        activityBreakdown: { swim: 2500, kick: 500 },
      },
    };
    const result = normalizeToWorkoutAnalysis(input);
    expect(result).not.toBeNull();
    expect(result!.total_meters).toBe(3000);
    expect(result!.estimated_duration_minutes).toBe(60);
    expect(result!.stroke_breakdown.freestyle.meters).toBe(2000);
  });

  it('returns null for unrecognized format', () => {
    expect(normalizeToWorkoutAnalysis({ random: 'data' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/utils/__tests__/normalizeWorkoutData.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the normalizer**

```typescript
// frontend/src/utils/normalizeWorkoutData.ts
import type { WorkoutAnalysis, BreakdownEntry } from '@/services/workoutAnalysisService';

/**
 * Normalize any known json_description format into the canonical WorkoutAnalysis shape.
 * Handles 3 formats: new (sections+totals), versioned (version+analysis), legacy (estimate).
 */
export function normalizeToWorkoutAnalysis(jsonDesc: any): WorkoutAnalysis | null {
  if (!jsonDesc) return null;

  // Format 1: New format from SaveWorkoutModal / backfill (sections + totals)
  if ('sections' in jsonDesc && 'totals' in jsonDesc) {
    const t = jsonDesc.totals;
    return {
      parser_used: 'llm',
      total_meters: t.total_meters ?? 0,
      total_sets: t.total_sets ?? 0,
      estimated_duration_minutes: t.estimated_duration_minutes ?? 0,
      rest_time_minutes: t.rest_time_minutes ?? 0,
      stroke_breakdown: t.stroke_breakdown ?? {},
      activity_breakdown: t.activity_breakdown ?? {},
      energy_zone_breakdown: t.energy_zone_breakdown ?? {},
      sections: jsonDesc.sections ?? [],
    };
  }

  // Format 2: Versioned format (version + analysis)
  if ('version' in jsonDesc && 'analysis' in jsonDesc) {
    const a = jsonDesc.analysis;
    return {
      parser_used: 'llm',
      total_meters: a.total_meters ?? 0,
      total_sets: a.total_sets ?? 0,
      estimated_duration_minutes: a.estimated_duration_minutes ?? 0,
      rest_time_minutes: a.rest_time_minutes ?? 0,
      stroke_breakdown: convertFlatBreakdown(a.stroke_breakdown),
      activity_breakdown: convertFlatBreakdown(a.activity_breakdown),
      energy_zone_breakdown: {},
      sections: a.sections ?? [],
    };
  }

  // Format 3: Legacy estimate format
  if ('estimate' in jsonDesc) {
    const e = jsonDesc.estimate;
    const total = e.totalDistance ?? 0;
    return {
      parser_used: 'regex',
      total_meters: total,
      total_sets: 0,
      estimated_duration_minutes: e.totalMinutes ?? 0,
      rest_time_minutes: 0,
      stroke_breakdown: convertFlatBreakdown(e.strokeBreakdown, total, {
        individualMedley: 'im',
      }),
      activity_breakdown: convertFlatBreakdown(e.activityBreakdown, total),
      energy_zone_breakdown: {},
      sections: [],
    };
  }

  return null;
}

/**
 * Convert a flat { freestyle: 1200 } breakdown into { freestyle: { meters: 1200, percentage: 60 } }.
 * If values are already { meters, percentage } objects, pass through.
 */
function convertFlatBreakdown(
  breakdown: Record<string, any> | undefined,
  totalOverride?: number,
  keyMap?: Record<string, string>
): Record<string, BreakdownEntry> {
  if (!breakdown) return {};

  const result: Record<string, BreakdownEntry> = {};
  let total = totalOverride ?? 0;

  // First pass: detect format and compute total if needed
  const entries = Object.entries(breakdown);
  const isAlreadyStructured = entries.some(
    ([, v]) => typeof v === 'object' && v !== null && 'meters' in v
  );

  if (isAlreadyStructured) {
    for (const [key, value] of entries) {
      const normalizedKey = keyMap?.[key] ?? key;
      result[normalizedKey] = value as BreakdownEntry;
    }
    return result;
  }

  // Flat numbers — compute total if not provided
  if (!totalOverride) {
    total = entries.reduce((sum, [, v]) => sum + (typeof v === 'number' ? v : 0), 0);
  }

  for (const [key, value] of entries) {
    if (typeof value !== 'number' || value === 0) continue;
    const normalizedKey = keyMap?.[key] ?? key;
    result[normalizedKey] = {
      meters: value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    };
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/utils/__tests__/normalizeWorkoutData.test.ts`
Expected: ALL PASS

---

### Task 3: Create `WorkoutStructuredView` component with tests

**Files:**
- Create: `frontend/src/components/workout/WorkoutStructuredView.tsx`
- Create: `frontend/src/components/workout/__tests__/WorkoutStructuredView.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/workout/__tests__/WorkoutStructuredView.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkoutStructuredView } from '../WorkoutStructuredView';

const mockJsonDescription = {
  sections: [
    {
      name: 'Warm-up',
      sets: [
        { reps: 4, distance: 100, stroke: 'freestyle', activity: 'swim', energy_zone: 'en1' },
        { reps: 2, distance: 50, stroke: 'backstroke', activity: 'kick', energy_zone: 'en1', equipment: ['fins'] },
      ],
    },
    {
      name: 'Main Set',
      sets: [
        { reps: 8, distance: 50, stroke: 'freestyle', activity: 'swim', energy_zone: 'en3', interval: '0:55', notes: 'Fast!' },
      ],
    },
  ],
  totals: {
    total_meters: 900,
    total_sets: 3,
    estimated_duration_minutes: 20,
    rest_time_minutes: 2,
    stroke_breakdown: {
      freestyle: { meters: 800, percentage: 89 },
      backstroke: { meters: 100, percentage: 11 },
    },
    activity_breakdown: {
      swim: { meters: 800, percentage: 89 },
      kick: { meters: 100, percentage: 11 },
    },
    energy_zone_breakdown: {
      en1: { meters: 500, percentage: 56 },
      en3: { meters: 400, percentage: 44 },
    },
  },
};

describe('WorkoutStructuredView', () => {
  it('renders section headers', () => {
    render(<WorkoutStructuredView jsonDescription={mockJsonDescription} />);
    expect(screen.getByText('Warm-up')).toBeInTheDocument();
    expect(screen.getByText('Main Set')).toBeInTheDocument();
  });

  it('renders sets in coach notation', () => {
    render(<WorkoutStructuredView jsonDescription={mockJsonDescription} />);
    expect(screen.getByText(/4 x 100 Freestyle/)).toBeInTheDocument();
    expect(screen.getByText(/2 x 50 Backstroke/)).toBeInTheDocument();
    expect(screen.getByText(/8 x 50 Freestyle/)).toBeInTheDocument();
  });

  it('shows interval when present', () => {
    render(<WorkoutStructuredView jsonDescription={mockJsonDescription} />);
    expect(screen.getByText(/@ 0:55/)).toBeInTheDocument();
  });

  it('shows equipment in brackets', () => {
    render(<WorkoutStructuredView jsonDescription={mockJsonDescription} />);
    expect(screen.getByText(/\[fins\]/)).toBeInTheDocument();
  });

  it('shows set notes as muted text', () => {
    render(<WorkoutStructuredView jsonDescription={mockJsonDescription} />);
    expect(screen.getByText('Fast!')).toBeInTheDocument();
  });

  it('shows coaching notes when description provided', () => {
    render(
      <WorkoutStructuredView
        jsonDescription={mockJsonDescription}
        description="Focus on high elbows during catch phase"
      />
    );
    expect(screen.getByText(/Focus on high elbows/)).toBeInTheDocument();
  });

  it('shows "Show original text" toggle when rawDescription provided', () => {
    render(
      <WorkoutStructuredView
        jsonDescription={mockJsonDescription}
        rawDescription="4x100 Free\n8x50 Free @ 0:55"
      />
    );
    const toggle = screen.getByText('Show original text');
    expect(toggle).toBeInTheDocument();
    // Pre block should NOT be visible initially
    expect(screen.queryByText('4x100 Free\n8x50 Free @ 0:55')).not.toBeInTheDocument();
  });

  it('expands original text on toggle click', () => {
    render(
      <WorkoutStructuredView
        jsonDescription={mockJsonDescription}
        rawDescription="4x100 Free"
      />
    );
    fireEvent.click(screen.getByText('Show original text'));
    expect(screen.getByText('Hide original text')).toBeInTheDocument();
    expect(screen.getByText('4x100 Free')).toBeInTheDocument();
  });

  it('falls back to raw text when jsonDescription is missing', () => {
    render(<WorkoutStructuredView rawDescription="4x100 Free @ 1:30" />);
    expect(screen.getByText('4x100 Free @ 1:30')).toBeInTheDocument();
    // Should NOT show the toggle since text IS the original
    expect(screen.queryByText('Show original text')).not.toBeInTheDocument();
  });

  it('falls back to raw text when jsonDescription has no sections', () => {
    render(
      <WorkoutStructuredView
        jsonDescription={{ totals: { total_meters: 0 } }}
        rawDescription="Some workout text"
      />
    );
    expect(screen.getByText('Some workout text')).toBeInTheDocument();
  });

  it('omits missing fields gracefully', () => {
    const minimal = {
      sections: [
        {
          name: 'Set',
          sets: [{ reps: 4, distance: 100, stroke: 'freestyle', activity: 'swim', energy_zone: 'en1' }],
        },
      ],
      totals: { total_meters: 400, total_sets: 1, estimated_duration_minutes: 8, rest_time_minutes: 0 },
    };
    render(<WorkoutStructuredView jsonDescription={minimal} />);
    const setLine = screen.getByText(/4 x 100 Freestyle/);
    // Should NOT contain @ or brackets
    expect(setLine.textContent).not.toContain('@');
    expect(setLine.textContent).not.toContain('[');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/workout/__tests__/WorkoutStructuredView.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `WorkoutStructuredView`**

```typescript
// frontend/src/components/workout/WorkoutStructuredView.tsx
import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { WorkoutMetricsCard } from '@/components/workout/WorkoutMetricsCard';
import { normalizeToWorkoutAnalysis } from '@/utils/normalizeWorkoutData';
import { stripMarkdown } from '@/utils/cleanWorkoutText';

interface WorkoutStructuredViewProps {
  jsonDescription?: Record<string, any>;
  rawDescription?: string;
  description?: string;
}

function formatSetLine(set: {
  reps?: number;
  distance?: number;
  stroke?: string;
  activity?: string;
  interval?: string;
  equipment?: string[];
}): string {
  const parts: string[] = [];

  if (set.reps && set.distance) {
    parts.push(`${set.reps} x ${set.distance}`);
  } else if (set.distance) {
    parts.push(`${set.distance}`);
  }

  if (set.stroke) {
    parts.push(set.stroke.charAt(0).toUpperCase() + set.stroke.slice(1));
  }

  if (set.activity && set.activity !== 'swim') {
    parts.push(`(${set.activity})`);
  }

  if (set.interval) {
    parts.push(`@ ${set.interval}`);
  }

  if (set.equipment && set.equipment.length > 0) {
    parts.push(`[${set.equipment.join(', ')}]`);
  }

  return parts.join(' ');
}

export function WorkoutStructuredView({
  jsonDescription,
  rawDescription,
  description,
}: WorkoutStructuredViewProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  const analysis = normalizeToWorkoutAnalysis(jsonDescription);
  const hasSections = analysis && analysis.sections && analysis.sections.length > 0;

  // Fallback: no structured data, show cleaned raw text
  if (!hasSections) {
    if (!rawDescription) return null;
    return (
      <div className="space-y-4">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-300 bg-slate-800/50 rounded-lg p-4 border border-slate-700/40">
          {stripMarkdown(rawDescription)}
        </pre>
        {description && (
          <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={14} className="text-cyan-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Coaching Notes</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{description}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <WorkoutMetricsCard analysis={analysis} />

      {/* Sections */}
      <div className="space-y-4">
        {analysis.sections.map((section, sIdx) => (
          <div key={sIdx} className="bg-slate-800/30 rounded-lg border border-slate-700/30 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-700/30 bg-slate-800/40">
              <h4 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                {section.name}
              </h4>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {section.sets.map((set, setIdx) => (
                <div key={setIdx}>
                  <div className="text-sm text-slate-200 font-mono">
                    {formatSetLine(set)}
                  </div>
                  {set.notes && (
                    <div className="text-xs text-slate-500 ml-4 italic">{set.notes}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Coaching Notes */}
      {description && (
        <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={14} className="text-cyan-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Coaching Notes</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{description}</p>
        </div>
      )}

      {/* Show Original Text toggle */}
      {rawDescription && (
        <div>
          <button
            onClick={() => setShowOriginal((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showOriginal ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showOriginal ? 'Hide original text' : 'Show original text'}
          </button>
          {showOriginal && (
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-400 bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
              {rawDescription}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Export from barrel file**

Add to `frontend/src/components/workout/index.ts`:
```typescript
export { WorkoutStructuredView } from '@/components/workout/WorkoutStructuredView';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/workout/__tests__/WorkoutStructuredView.test.tsx`
Expected: ALL PASS

---

### Task 4: Update `WorkoutPreviewModal` to use `WorkoutStructuredView`

**Files:**
- Modify: `frontend/src/components/workouts/WorkoutPreviewModal.tsx`

- [ ] **Step 1: Replace imports**

Remove these imports:
```typescript
// REMOVE:
import { Copy, Calendar, Timer, Flame, BarChart3, TrendingUp, Activity, Target, Zap, CheckCircle } from 'lucide-react';
import WorkoutBreakdownCharts from '@/components/workout/WorkoutBreakdownCharts';
```

Replace with:
```typescript
import { Copy, TrendingUp, Activity, CheckCircle } from 'lucide-react';
import { WorkoutStructuredView } from '@/components/workout/WorkoutStructuredView';
```

- [ ] **Step 2: Remove `normalizeJsonDescription()` function**

Delete lines 20-60 (the entire `normalizeJsonDescription` function).

- [ ] **Step 3: Remove the `normalized`/`estimate` variables**

Delete these lines:
```typescript
const normalized = workout?.json_description ? normalizeJsonDescription(workout.json_description) : null;
const estimate = normalized?.estimate;
```

- [ ] **Step 4: Replace Stats Grid + Workout Description + Charts with `WorkoutStructuredView`**

Replace everything between the Community Rating section and the Action Buttons section (the Stats Grid at lines 164-227, the Workout Description at lines 254-298, and the Charts at lines 300-303) with:

```typescript
{/* Structured Workout View */}
<WorkoutStructuredView
  jsonDescription={workout.json_description}
  rawDescription={workout.raw_description}
  description={workout.description}
/>
```

Keep the header section (lines 139-163), community rating section (lines 229-252), and action buttons (lines 305-321) unchanged. Keep the `handleCopy` function and the Copy button in the header unchanged.

- [ ] **Step 5: Remove the difficulty badge from the header that relied on `estimate`**

Replace the difficulty badge that used `estimate?.difficulty` (lines 152-157) with a simpler classification badge:

```typescript
{workout.classification && (
  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium capitalize">
    <TrendingUp size={14} />
    {workout.classification}
  </span>
)}
```

- [ ] **Step 6: Verify the app compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

---

### Task 5: Update `WorkoutView` page to use `WorkoutStructuredView`

**Files:**
- Modify: `frontend/src/pages/WorkoutView.tsx`
- Modify: `frontend/src/hooks/useWorkout.ts` (add `classification` to `Workout` type)

- [ ] **Step 0: Add `classification` to the `Workout` type**

In `frontend/src/hooks/useWorkout.ts`, add `classification` to the `Workout` type and the `convertToWorkout` mapper:

```typescript
// Add to Workout type:
classification?: string;

// Add to convertToWorkout:
classification: data.classification,
```

- [ ] **Step 1: Replace imports**

Remove:
```typescript
import { BarChart3, Flame, Timer, TrendingUp } from "lucide-react";
import WorkoutBreakdownCharts from '@/components/workout/WorkoutBreakdownCharts';
```

Add:
```typescript
import { WorkoutStructuredView } from '@/components/workout/WorkoutStructuredView';
```

- [ ] **Step 2: Remove `normalizeJsonDescription()` function**

Delete lines 28-65 (the entire local `normalizeJsonDescription` function).

- [ ] **Step 3: Remove the `normalized` variable**

Delete:
```typescript
const normalized = normalizeJsonDescription(workout.jsonDescription);
```

- [ ] **Step 4: Remove the difficulty badge that used `normalized.estimate`**

Replace lines 238-243:
```typescript
{normalized?.estimate?.difficulty && (
  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium">
    <TrendingUp size={14} />
    {normalized.estimate.difficulty}
  </span>
)}
```

With:
```typescript
{workout.classification && (
  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium capitalize">
    <TrendingUp size={14} />
    {workout.classification}
  </span>
)}
```

- [ ] **Step 5: Replace the entire Main Content section**

Replace the Stats Grid (lines 309-366) + the grid layout with Analysis and Workout Plan (lines 368-442) with:

```typescript
{/* Main Content */}
<div className="max-w-7xl mx-auto px-6 py-6">
  <WorkoutStructuredView
    jsonDescription={workout.jsonDescription}
    rawDescription={workout.rawDescription}
    description={workout.description}
  />
</div>
```

Note: `WorkoutView` uses camelCase field names (via `useWorkout` hook) — `jsonDescription`, `rawDescription`, `description`.

- [ ] **Step 6: Verify the app compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

---

### Task 6: Update `WorkoutMiniChart` to use shared normalizer

**Files:**
- Modify: `frontend/src/components/workout/WorkoutMiniChart.tsx`

- [ ] **Step 1: Replace the local normalizer and type**

Add import:
```typescript
import { normalizeToWorkoutAnalysis } from '@/utils/normalizeWorkoutData';
```

Delete the local `WorkoutData` type (lines 7-37) and `normalizeJsonDescription` function (lines 39-73). Replace with a simpler type:

```typescript
type WorkoutData = {
  id: string;
  name: string;
  total_meters: number;
  json_description?: Record<string, any>;
};
```

- [ ] **Step 2: Update usage**

Replace:
```typescript
const normalized = normalizeJsonDescription(workout.json_description);
if (!normalized?.estimate) {
```

With:
```typescript
const analysis = normalizeToWorkoutAnalysis(workout.json_description);
if (!analysis) {
```

- [ ] **Step 3: Update data references**

Replace `normalized.estimate.totalDistance` with `analysis.total_meters`.

Replace `strokeBreakdown` references: `normalized.estimate.strokeBreakdown` keys are `{ freestyle: number }` (flat). The normalized `analysis.stroke_breakdown` uses `{ freestyle: { meters, percentage } }`. Update the segment mapping:

```typescript
const { stroke_breakdown, activity_breakdown } = analysis;

const strokeSegments = Object.entries(stroke_breakdown)
  .filter(([_, v]) => v.meters > 0)
  .sort((a, b) => b[1].meters - a[1].meters)
  .map(([key, value]) => ({
    label: key === 'im' ? 'IM' : key.charAt(0).toUpperCase() + key.slice(1),
    value: value.meters,
    color: STROKE_COLORS[key] || STROKE_COLORS[key === 'im' ? 'individualMedley' : key] || '#6B7280',
    percentage: value.percentage,
  }));

const activitySegments = Object.entries(activity_breakdown)
  .filter(([_, v]) => v.meters > 0)
  .sort((a, b) => b[1].meters - a[1].meters)
  .map(([key, value]) => ({
    label: key.charAt(0).toUpperCase() + key.slice(1),
    value: value.meters,
    color: ACTIVITY_COLORS[key] || '#6B7280',
    percentage: value.percentage,
  }));
```

Update the "Total Distance Header" to use `analysis.total_meters`:
```typescript
<span className="text-xs font-semibold text-text-primary">
  {analysis.total_meters.toLocaleString()}m
</span>
```

Also update `STROKE_COLORS` to add an `im` key mapping:
```typescript
const STROKE_COLORS: Record<string, string> = {
  freestyle: '#06B6D4',
  backstroke: '#8B5CF6',
  breaststroke: '#10B981',
  butterfly: '#F59E0B',
  im: '#EC4899',
  individualMedley: '#EC4899',
  choice: '#A78BFA'
};
```

- [ ] **Step 4: Verify the app compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

---

### Task 7: Update `SquadWorkouts` to use `WorkoutStructuredView`

**Files:**
- Modify: `frontend/src/components/squad/SquadWorkouts.tsx`

- [ ] **Step 1: Add import**

```typescript
import { WorkoutStructuredView } from '@/components/workout/WorkoutStructuredView';
```

- [ ] **Step 2: Improve the raw_description preview text**

`SquadWorkouts` renders workout cards in a list — NOT a detail view. A full `WorkoutStructuredView` with metrics + sections would be too heavy here. Instead, clean the preview text using `stripMarkdown`:

Add import:
```typescript
import { stripMarkdown } from '@/utils/cleanWorkoutText';
```

Replace line 326-328:
```typescript
<p className="text-sm text-slate-400 mb-4 line-clamp-2">
  {workout.raw_description}
</p>
```

With:
```typescript
<p className="text-sm text-slate-400 mb-4 line-clamp-2">
  {stripMarkdown(workout.raw_description)}
</p>
```

This strips markdown artifacts from the truncated preview. Coaches see clean text in the card list. Clicking into a workout navigates to `WorkoutView` which has the full structured view (Task 5).

- [ ] **Step 3: Verify the app compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

---

### Task 8: Backend backfill Celery task

**Files:**
- Create: `backend/app/tasks/backfill_workout_analysis.py`
- Modify: `backend/app/routes/admin.py`
- Create: `backend/tests/test_backfill_workout_analysis.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_backfill_workout_analysis.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.tasks.backfill_workout_analysis import backfill_single_workout


@pytest.mark.asyncio
async def test_backfill_transforms_to_correct_format():
    """Verify the analysis result is transformed to the sections+totals format."""
    mock_analysis = {
        "parser_used": "llm",
        "sections": [{"name": "Warm-up", "sets": [{"reps": 4, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en1"}]}],
        "total_meters": 400,
        "total_sets": 1,
        "estimated_duration_minutes": 8.0,
        "rest_time_minutes": 0.0,
        "stroke_breakdown": {"freestyle": {"meters": 400, "percentage": 100}},
        "activity_breakdown": {"swim": {"meters": 400, "percentage": 100}},
        "energy_zone_breakdown": {"en1": {"meters": 400, "percentage": 100}},
    }

    result = backfill_single_workout(mock_analysis)

    assert "sections" in result
    assert "totals" in result
    assert result["totals"]["total_meters"] == 400
    assert result["totals"]["stroke_breakdown"]["freestyle"]["meters"] == 400
    assert result["sections"][0]["name"] == "Warm-up"


def test_backfill_returns_none_on_empty_analysis():
    """Verify that empty analysis returns None."""
    mock_analysis = {
        "parser_used": "regex",
        "sections": [],
        "total_meters": 0,
        "total_sets": 0,
        "estimated_duration_minutes": 0,
        "rest_time_minutes": 0,
        "stroke_breakdown": {},
        "activity_breakdown": {},
        "energy_zone_breakdown": {},
    }
    result = backfill_single_workout(mock_analysis)
    assert result is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_backfill_workout_analysis.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Create the backfill task module**

```python
# backend/app/tasks/backfill_workout_analysis.py
"""
One-time backfill task: re-analyze existing workouts that have raw_description
but no json_description, using the V2 analyzer (LLM primary, regex fallback).
"""

import asyncio
import time
from typing import Any, Optional

from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import AsyncSessionLocal
from app.infrastructure.models import WorkoutTemplate
from app.services.workout_analyzer import WorkoutAnalyzer
from app.utils import logger


def backfill_single_workout(analysis: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Transform a V2 analysis result into the sections+totals format used by SaveWorkoutModal.

    Returns None if analysis has no useful data (0 meters, no sections).
    """
    if not analysis.get("sections") or analysis.get("total_meters", 0) == 0:
        return None

    return {
        "sections": analysis["sections"],
        "totals": {
            "total_meters": analysis.get("total_meters", 0),
            "total_sets": analysis.get("total_sets", 0),
            "estimated_duration_minutes": analysis.get("estimated_duration_minutes", 0),
            "rest_time_minutes": analysis.get("rest_time_minutes", 0),
            "stroke_breakdown": analysis.get("stroke_breakdown", {}),
            "activity_breakdown": analysis.get("activity_breakdown", {}),
            "energy_zone_breakdown": analysis.get("energy_zone_breakdown", {}),
        },
    }


async def run_backfill(delay_seconds: float = 1.5) -> dict[str, int]:
    """Run the backfill: find workouts with NULL json_description, analyze, and update.

    Returns summary dict with counts: total, succeeded, failed, skipped.
    """
    analyzer = WorkoutAnalyzer()
    summary = {"total": 0, "succeeded": 0, "failed": 0, "skipped": 0}

    async with AsyncSessionLocal() as db:
        # Find all workouts needing backfill
        result = await db.execute(
            select(WorkoutTemplate.id, WorkoutTemplate.raw_description)
            .where(WorkoutTemplate.json_description.is_(None))
            .where(WorkoutTemplate.raw_description.isnot(None))
            .where(WorkoutTemplate.raw_description != "")
        )
        rows = result.all()

    summary["total"] = len(rows)
    logger.info(f"Backfill: found {len(rows)} workouts to process")

    for workout_id, raw_description in rows:
        try:
            # Analyze using V2 (LLM primary, regex fallback)
            analysis = await analyzer.analyze_workout_v2(raw_description)
            json_desc = backfill_single_workout(analysis)

            if json_desc is None:
                logger.info(f"Backfill: skipping workout {workout_id} — no useful data extracted")
                summary["skipped"] += 1
                continue

            # Update the row
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(WorkoutTemplate)
                    .where(WorkoutTemplate.id == workout_id)
                    .values(
                        json_description=json_desc,
                        total_meters=analysis.get("total_meters", 0),
                        estimated_time_minutes=analysis.get("estimated_duration_minutes", 0),
                    )
                )
                await db.commit()

            parser = analysis.get("parser_used", "unknown")
            meters = analysis.get("total_meters", 0)
            logger.info(f"Backfill: processed workout {workout_id} — parser={parser}, meters={meters}")
            summary["succeeded"] += 1

        except Exception as e:
            logger.error(f"Backfill: failed workout {workout_id} — {e} (text length={len(raw_description)})")
            summary["failed"] += 1

        # Rate limit between API calls
        if delay_seconds > 0:
            await asyncio.sleep(delay_seconds)

    logger.info(f"Backfill complete: {summary}")
    return summary
```

- [ ] **Step 4: Create the tasks directory and `__init__.py`**

Run: `ls backend/app/tasks/` — if the directory doesn't exist, create it along with `__init__.py`:

```bash
mkdir -p backend/app/tasks
```

```python
# backend/app/tasks/__init__.py
```

- [ ] **Step 5: Add the admin endpoint**

Add to `backend/app/routes/admin.py`:

```python
from app.tasks.backfill_workout_analysis import run_backfill

@router.post("/backfill-workout-analysis")
async def trigger_backfill(current_user: dict = Depends(require_admin)):
    """Backfill json_description for workouts missing analysis. Admin only.

    Uses the existing `require_admin` dependency (checks email against admin email).
    Runs inline since this is a one-time operation — not a Celery task.
    """
    summary = await run_backfill()
    return {"success": True, "summary": summary}
```

Note: `require_admin` is already defined in `admin.py` (line 84) and used by all other admin endpoints.
The spec mentions a Celery task, but running inline via `await` is simpler for a one-time operation and avoids the complexity of Celery task registration. The endpoint is still async and returns the summary when done.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_backfill_workout_analysis.py -v`
Expected: ALL PASS

---

### Task 9: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All existing tests pass + new tests pass. No regressions.

- [ ] **Step 2: Run all backend tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All existing tests pass + new backfill test passes.

- [ ] **Step 3: Type check frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Visual smoke test**

Start the dev server (`./run.sh`) and verify:
1. AI Coach → generate a workout → click "Save" → verify SaveWorkoutModal still works
2. Workout Library → click a saved workout → verify structured view renders (sections, sets in coach notation, metrics)
3. Discover page → preview a shared workout → verify structured view
4. If there are legacy workouts, run the backfill via `POST /api/admin/backfill-workout-analysis` and verify they display correctly after

- [ ] **Step 5: Commit all changes**

```bash
git add -A
git commit -m "feat: structured workout display with shared normalizer and backfill task"
```
