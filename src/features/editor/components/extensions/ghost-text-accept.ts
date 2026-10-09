const NEXT_WORD = /^\s*(?:\w+|[^\w\s]+)/;

/// The part of a suggestion up to the end of its next word or run of symbols.
export function nextWordChunk(text: string): string {
  return text.match(NEXT_WORD)?.[0] ?? text;
}

/// The part of a suggestion up to and including its first line break, or all of it.
export function nextLineChunk(text: string): string {
  const firstContent = text.search(/\S/);
  const newline = text.indexOf("\n", firstContent === -1 ? 0 : firstContent);
  return newline === -1 ? text : text.slice(0, newline + 1);
}

export const MAX_ALTERNATIVES = 5;

/// Appends a new alternative unless it repeats one; returns the list and the index to show.
export function addAlternative(
  suggestions: string[],
  next: string,
): { suggestions: string[]; index: number } {
  const existing = suggestions.indexOf(next);
  if (existing !== -1) return { suggestions, index: existing };
  const merged = [...suggestions, next].slice(-MAX_ALTERNATIVES);
  return { suggestions: merged, index: merged.length - 1 };
}
