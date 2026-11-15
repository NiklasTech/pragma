export type GoToScope = "all" | "commands" | "symbols" | "agents";

const PREFIXES: Record<string, GoToScope> = { ">": "commands", "@": "symbols", "#": "agents" };

/// The group a prefix limits the search to, and the text after it.
export function parseGoToQuery(raw: string): { scope: GoToScope; text: string } {
  const scope = PREFIXES[raw.charAt(0)];
  if (scope) return { scope, text: raw.slice(1).trim() };
  return { scope: "all", text: raw.trim() };
}

/// Higher is better; null when the label does not contain the text. Earlier and word-start matches win.
export function labelScore(label: string, text: string): number | null {
  if (!text) return 0;
  const haystack = label.toLowerCase();
  const needle = text.toLowerCase();
  const index = haystack.indexOf(needle);
  if (index === -1) return null;
  const wordStart = index === 0 || /[\s_\-:./]/.test(haystack.charAt(index - 1));
  return 1000 - index * 2 + (wordStart ? 200 : 0) - haystack.length;
}

/// The best matches by label, keeping the input order among equals.
export function rankByLabel<T>(
  items: readonly T[],
  text: string,
  label: (item: T) => string,
  limit: number,
): T[] {
  if (!text) return items.slice(0, limit);
  return items
    .map((item, order) => ({ item, order, score: labelScore(label(item), text) }))
    .filter((entry): entry is { item: T; order: number; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export interface LabelParts {
  before: string;
  match: string;
  after: string;
}

/// The label split around the first place it contains the text, for underlining the match.
export function highlightParts(label: string, text: string): LabelParts {
  const index = text ? label.toLowerCase().indexOf(text.toLowerCase()) : -1;
  if (index === -1) return { before: label, match: "", after: "" };
  return {
    before: label.slice(0, index),
    match: label.slice(index, index + text.length),
    after: label.slice(index + text.length),
  };
}

/// How many of each group show when every group shares the list; a prefix shows only its group, longer.
export const GROUP_LIMITS = {
  all: { symbols: 3, files: 6, agents: 3, commands: 3, text: 3 },
  focused: 50,
} as const;
