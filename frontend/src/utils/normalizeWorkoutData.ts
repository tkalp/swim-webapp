import type { WorkoutAnalysis, BreakdownEntry } from '@/services/workoutAnalysisService';

/**
 * Normalize any known json_description format into the canonical WorkoutAnalysis shape.
 * Handles 4 formats: new (sections+totals), versioned (version+analysis),
 * legacy blocks+estimate (old regex parser), and bare estimate (oldest).
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

  // Format 3: Legacy blocks + estimate (old regex parser output)
  // Has blocks[].sets[] with numeric intervals + estimate with flat breakdowns
  if ('blocks' in jsonDesc && 'estimate' in jsonDesc) {
    const e = jsonDesc.estimate;
    const total = e.totalDistance ?? 0;
    const sections = convertBlocksToSections(jsonDesc.blocks ?? []);
    return {
      parser_used: 'regex',
      total_meters: total,
      total_sets: sections.reduce((sum, s) => sum + s.sets.length, 0),
      estimated_duration_minutes: e.totalMinutes ?? 0,
      rest_time_minutes: 0,
      stroke_breakdown: convertFlatBreakdown(e.strokeBreakdown, total, {
        individualMedley: 'im',
      }),
      activity_breakdown: convertFlatBreakdown(e.activityBreakdown, total),
      energy_zone_breakdown: {},
      sections,
    };
  }

  // Format 4: Bare estimate (oldest — no blocks, no sections)
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
 * Convert legacy blocks[].sets[] into the canonical sections[].sets[] format.
 * Filters out rest/zero-distance sets, converts numeric intervals to mm:ss strings.
 */
function convertBlocksToSections(blocks: any[]): WorkoutAnalysis['sections'] {
  return blocks.map((block) => ({
    name: block.name ?? 'Workout',
    sets: (block.sets ?? [])
      .filter((s: any) => s.stroke !== 'rest' && (s.distance ?? 0) > 0)
      .map((s: any) => ({
        reps: s.reps ?? 1,
        distance: s.distance ?? 0,
        stroke: s.stroke === 'mixed' ? 'choice' : (s.stroke ?? 'choice'),
        activity: s.activity === 'mixed' ? 'swim' : (s.activity ?? 'swim'),
        interval: typeof s.interval === 'number' ? formatSecondsToInterval(s.interval) : undefined,
        energy_zone: 'en2',
        equipment: s.equipment ?? [],
        notes: s.originalText ?? undefined,
      })),
  }));
}

/** Convert seconds (e.g. 80) to interval string (e.g. "1:20") */
function formatSecondsToInterval(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
