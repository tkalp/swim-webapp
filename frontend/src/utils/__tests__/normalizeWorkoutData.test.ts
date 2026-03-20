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

  it('normalizes legacy blocks + estimate format', () => {
    const input = {
      blocks: [
        {
          name: 'Main Workout',
          sets: [
            {
              reps: 12,
              stroke: 'backstroke',
              activity: 'mixed',
              distance: 50,
              interval: 75,
              equipment: [],
              originalText: '12x50 backstroke mixed',
            },
            {
              reps: 1,
              stroke: 'rest',
              activity: 'rest',
              distance: 0,
              interval: null,
              originalText: '1x0 rest rest',
            },
            {
              reps: 10,
              stroke: 'breaststroke',
              activity: 'kick',
              distance: 50,
              interval: 90,
              equipment: [],
              originalText: '10x50 breaststroke kick',
            },
          ],
        },
      ],
      estimate: {
        totalDistance: 1100,
        totalMinutes: 30,
        strokeBreakdown: { backstroke: 600, breaststroke: 500 },
        activityBreakdown: { swim: 600, kick: 500 },
      },
      confidence: 'medium',
    };
    const result = normalizeToWorkoutAnalysis(input);
    expect(result).not.toBeNull();
    expect(result!.total_meters).toBe(1100);
    expect(result!.estimated_duration_minutes).toBe(30);
    // Should have 1 section
    expect(result!.sections).toHaveLength(1);
    expect(result!.sections[0].name).toBe('Main Workout');
    // Rest sets should be filtered out
    expect(result!.sections[0].sets).toHaveLength(2);
    // First set: backstroke, interval 75s -> "1:15"
    expect(result!.sections[0].sets[0].stroke).toBe('backstroke');
    expect(result!.sections[0].sets[0].interval).toBe('1:15');
    expect(result!.sections[0].sets[0].reps).toBe(12);
    // "mixed" activity should become "swim"
    expect(result!.sections[0].sets[0].activity).toBe('swim');
    // Second set: breaststroke kick, interval 90s -> "1:30"
    expect(result!.sections[0].sets[1].stroke).toBe('breaststroke');
    expect(result!.sections[0].sets[1].interval).toBe('1:30');
    // Breakdowns should be structured
    expect(result!.stroke_breakdown.backstroke.meters).toBe(600);
  });

  it('returns null for unrecognized format', () => {
    expect(normalizeToWorkoutAnalysis({ random: 'data' })).toBeNull();
  });
});
