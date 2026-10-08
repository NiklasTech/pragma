export type ConsoleEntryKind = "input" | "result" | "error" | "stdout" | "stderr";

export interface ConsoleEntry {
  id: string;
  kind: ConsoleEntryKind;
  text: string;
}

const MAX_CONSOLE_ENTRIES = 500;
const MAX_CONSOLE_HISTORY = 100;

export function outputEntryKind(category: string | undefined): ConsoleEntryKind {
  return category === "stderr" ? "stderr" : "stdout";
}

export function appendConsoleEntry(
  entries: ConsoleEntry[],
  kind: ConsoleEntryKind,
  text: string,
): ConsoleEntry[] {
  return [...entries, { id: crypto.randomUUID(), kind, text }].slice(-MAX_CONSOLE_ENTRIES);
}

export function pushConsoleHistory(history: string[], expression: string): string[] {
  if (history[history.length - 1] === expression) return history;
  return [...history, expression].slice(-MAX_CONSOLE_HISTORY);
}

/** Steps through the history; `null` stands for the fresh, not yet submitted input. */
export function navigateConsoleHistory(
  history: string[],
  index: number | null,
  direction: "up" | "down",
): { index: number | null; value: string } {
  if (history.length === 0) return { index: null, value: "" };
  if (direction === "up") {
    const next = index === null ? history.length - 1 : Math.max(0, index - 1);
    return { index: next, value: history[next] };
  }
  if (index === null || index >= history.length - 1) return { index: null, value: "" };
  return { index: index + 1, value: history[index + 1] };
}
