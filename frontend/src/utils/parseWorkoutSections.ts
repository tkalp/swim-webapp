import type { WorkoutSections } from '@/types/ai-coach/types';

const SECTION_PATTERNS: { key: keyof Omit<WorkoutSections, 'raw'>; pattern: RegExp }[] = [
  { key: 'warmup', pattern: /^(?:warm[-\s]?up|wu)\s*[:—\-]/im },
  { key: 'preset', pattern: /^(?:pre[-\s]?set)\s*[:—\-]/im },
  { key: 'main', pattern: /^(?:main\s*set?|main)\s*[:—\-]/im },
  { key: 'cooldown', pattern: /^(?:cool[-\s]?down|cd)\s*[:—\-]/im },
];

export function parseWorkoutSections(text: string): WorkoutSections {
  if (!text || !text.trim()) {
    return { raw: '' };
  }

  // Find all section boundaries
  const boundaries: { key: keyof Omit<WorkoutSections, 'raw'>; index: number; headerEnd: number }[] = [];

  for (const { key, pattern } of SECTION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      boundaries.push({
        key,
        index: match.index,
        headerEnd: match.index + match[0].length,
      });
    }
  }

  // If no sections found, return raw
  if (boundaries.length === 0) {
    return { raw: text.trim() };
  }

  // Sort by position in text
  boundaries.sort((a, b) => a.index - b.index);

  const sections: WorkoutSections = {};

  for (let i = 0; i < boundaries.length; i++) {
    const current = boundaries[i];
    const nextIndex = i + 1 < boundaries.length ? boundaries[i + 1].index : text.length;
    const sectionContent = text.slice(current.headerEnd, nextIndex).trim();
    if (sectionContent) {
      sections[current.key] = sectionContent;
    }
  }

  // If we found at least one section, consider it a success
  return Object.keys(sections).length > 0 ? sections : { raw: text.trim() };
}
