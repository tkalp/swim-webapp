import { describe, it, expect } from 'vitest';
import { parseWorkoutSections } from '../parseWorkoutSections';

describe('parseWorkoutSections', () => {
  // 1. Full workout with all 4 sections
  it('parses a full workout with all four sections', () => {
    const text = `Warm-up: 400m easy freestyle
4x100 at aerobic pace

Pre-set: 4x50 kick with fins

Main Set: 8x200 at threshold
Rest 30s between

Cool-down: 200m easy`;

    const result = parseWorkoutSections(text);

    expect(result.warmup).toContain('400m easy freestyle');
    expect(result.preset).toContain('4x50 kick with fins');
    expect(result.main).toContain('8x200 at threshold');
    expect(result.cooldown).toContain('200m easy');
    expect(result.raw).toBeUndefined();
  });

  // 2. Workout with only Warm-up and Main Set
  it('parses a workout with only warmup and main set', () => {
    const text = `Warm-up: 300m easy
100 pull buoy

Main Set: 6x100 descend 1-3`;

    const result = parseWorkoutSections(text);

    expect(result.warmup).toContain('300m easy');
    expect(result.main).toContain('6x100 descend 1-3');
    expect(result.preset).toBeUndefined();
    expect(result.cooldown).toBeUndefined();
    expect(result.raw).toBeUndefined();
  });

  // 3. No recognizable sections → returns { raw: text }
  it('returns raw text when no section headers are found', () => {
    const text = 'Swim 400m easy, then do some drills, then cool off.';

    const result = parseWorkoutSections(text);

    expect(result.raw).toBe(text.trim());
    expect(result.warmup).toBeUndefined();
    expect(result.main).toBeUndefined();
  });

  // 4. Empty string → returns { raw: '' }
  it('returns { raw: "" } for an empty string', () => {
    expect(parseWorkoutSections('')).toEqual({ raw: '' });
  });

  it('returns { raw: "" } for a whitespace-only string', () => {
    expect(parseWorkoutSections('   ')).toEqual({ raw: '' });
  });

  // 5. Section headers with different formats
  describe('warmup header variants', () => {
    it('recognises "Warm-up:"', () => {
      const result = parseWorkoutSections('Warm-up: 400m easy');
      expect(result.warmup).toContain('400m easy');
    });

    it('recognises "WARM UP:" (uppercase, no hyphen)', () => {
      const result = parseWorkoutSections('WARM UP: 400m easy');
      expect(result.warmup).toContain('400m easy');
    });

    it('recognises "WU:" (abbreviation)', () => {
      const result = parseWorkoutSections('WU: 400m easy');
      expect(result.warmup).toContain('400m easy');
    });

    it('recognises "Warmup:" (no hyphen, mixed case)', () => {
      const result = parseWorkoutSections('Warmup: 400m easy');
      expect(result.warmup).toContain('400m easy');
    });
  });

  // 6. "Main Set:" vs "Main:" both recognised
  describe('main set header variants', () => {
    it('recognises "Main Set:"', () => {
      const result = parseWorkoutSections('Main Set: 8x100');
      expect(result.main).toContain('8x100');
    });

    it('recognises "Main:"', () => {
      const result = parseWorkoutSections('Main: 8x100');
      expect(result.main).toContain('8x100');
    });

    it('recognises "MAIN SET:" (uppercase)', () => {
      const result = parseWorkoutSections('MAIN SET: 8x100');
      expect(result.main).toContain('8x100');
    });
  });

  // 7. "Cool-down:" vs "Cooldown:" vs "CD:" all recognised
  describe('cooldown header variants', () => {
    it('recognises "Cool-down:"', () => {
      const result = parseWorkoutSections('Cool-down: 200m easy');
      expect(result.cooldown).toContain('200m easy');
    });

    it('recognises "Cooldown:"', () => {
      const result = parseWorkoutSections('Cooldown: 200m easy');
      expect(result.cooldown).toContain('200m easy');
    });

    it('recognises "CD:"', () => {
      const result = parseWorkoutSections('CD: 200m easy');
      expect(result.cooldown).toContain('200m easy');
    });

    it('recognises "COOL DOWN:" (uppercase, no hyphen)', () => {
      const result = parseWorkoutSections('COOL DOWN: 200m easy');
      expect(result.cooldown).toContain('200m easy');
    });
  });

  // Content integrity — sections should not bleed into each other
  it('does not include the next section header in the previous section content', () => {
    const text = `Warm-up: 400m easy

Main Set: 8x50 sprint

Cool-down: 200m easy`;

    const result = parseWorkoutSections(text);

    expect(result.warmup).not.toContain('Main Set');
    expect(result.main).not.toContain('Cool-down');
  });

  // Pre-set header variant
  it('recognises "Pre-set:"', () => {
    const result = parseWorkoutSections('Pre-set: 4x50 drill');
    expect(result.preset).toContain('4x50 drill');
  });
});
