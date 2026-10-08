const MAX_RULER_COLUMN = 500;

/** Parses a list like "80, 120" into sorted, unique ruler columns. */
export function parseRulers(text: string): number[] {
  const columns = text
    .split(/[\s,]+/)
    .filter((part) => part.length > 0)
    .map(Number)
    .filter((column) => Number.isInteger(column) && column > 0 && column <= MAX_RULER_COLUMN);
  return [...new Set(columns)].sort((a, b) => a - b);
}
