export interface InsertAtCursorResult {
  value: string;
  cursor: number;
}

// Space-separated insert keeps transcribed words from concatenating.
export function insertAtCursor(
  value: string,
  insert: string,
  cursor: number,
): InsertAtCursorResult {
  const text = insert.trim();
  if (!text) {
    return { value, cursor };
  }

  const position = Math.max(0, Math.min(cursor, value.length));
  const before = value.slice(0, position);
  const after = value.slice(position);
  const prefix = before && !/\s$/.test(before) ? " " : "";
  const suffix = after && !/^\s/.test(after) ? " " : "";

  return {
    value: `${before}${prefix}${text}${suffix}${after}`,
    cursor: position + prefix.length + text.length,
  };
}
