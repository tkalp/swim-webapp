// frontend/src/utils/__tests__/cleanWorkoutText.test.ts
import { describe, it, expect } from 'vitest';
import { stripMarkdown } from '../cleanWorkoutText';

describe('stripMarkdown', () => {
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
