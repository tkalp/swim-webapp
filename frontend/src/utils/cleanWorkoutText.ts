/**
 * Split AI-generated workout text into clean workout sets and coaching notes.
 */
export function splitWorkoutText(text: string): { workout: string; notes: string } {
  // Find where coaching notes begin — look for these markers:
  // "COACHING NOTES:", "Coach Notes:", "Coaching Notes:", "NOTES:", "PURPOSE:",
  // "Key Focus:", "Technical Cues:", "Coaching Cues:"
  // Take the FIRST one that appears as the split point

  const notePatterns = [
    /^(?:COACHING NOTES|Coach(?:ing)? Notes|NOTES|PURPOSE|Key Focus|Technical Cues|Coaching Cues)[:\s]*$/im,
    /^(?:COACHING NOTES|Coach(?:ing)? Notes|NOTES|PURPOSE|Key Focus|Technical Cues|Coaching Cues)[:\s]/im,
  ];

  let splitIndex = -1;
  for (const pattern of notePatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      // Find the start of the line containing the match
      const lineStart = text.lastIndexOf('\n', match.index - 1) + 1;
      if (splitIndex === -1 || lineStart < splitIndex) {
        splitIndex = lineStart;
      }
    }
  }

  if (splitIndex > 0) {
    return {
      workout: text.slice(0, splitIndex).trim(),
      notes: text.slice(splitIndex).trim(),
    };
  }

  return { workout: text.trim(), notes: '' };
}

/**
 * Strip the "COACHING NOTES:" / "Notes:" etc. header prefix from notes text,
 * returning just the body content.
 */
export function stripNotesHeader(notes: string): string {
  return notes
    .replace(
      /^(?:COACHING NOTES|Coach(?:ing)? Notes|NOTES|PURPOSE|Key Focus|Technical Cues|Coaching Cues)[:\s]*/im,
      ''
    )
    .trim();
}

/**
 * Strip markdown formatting from workout text while preserving structure.
 */
export function stripMarkdown(text: string): string {
  let result = text;

  // Remove bold: **text** -> text
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');

  // Remove italic: *text* -> text (but not **)
  result = result.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '$1');

  // Remove heading markers: ### Header -> Header
  result = result.replace(/^#{1,4}\s+/gm, '');

  // Remove horizontal rules
  result = result.replace(/^[-*_]{3,}\s*$/gm, '');

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

  // Collapse multiple blank lines into one
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}
