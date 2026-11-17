import type { AgentState } from "@/shared/components/ui/status-dot";
import type { ChatSession } from "@/shared/stores/ai";

import type { RailEntry } from "./railEntries";

export const SHEET_STATE_ORDER: readonly AgentState[] = ["needs-you", "working", "done", "idle"];

const EARLIER_LIMIT = 8;

export interface SheetGroup {
  state: AgentState;
  entries: RailEntry[];
}

function matches(session: ChatSession | undefined, needle: string): boolean {
  if (!needle) return true;
  return (session?.title ?? "").toLowerCase().includes(needle);
}

/// The panes of the space by agent state, in the order needs you, working, done, idle.
export function sheetGroups(
  entries: readonly RailEntry[],
  stateOf: (sessionId: string) => AgentState,
  sessionOf: (sessionId: string) => ChatSession | undefined,
  filter: string,
): SheetGroup[] {
  const needle = filter.trim().toLowerCase();
  return SHEET_STATE_ORDER.flatMap((state): SheetGroup[] => {
    const inState = entries.filter(
      (entry) => stateOf(entry.sessionId) === state && matches(sessionOf(entry.sessionId), needle),
    );
    return inState.length > 0 ? [{ state, entries: inState }] : [];
  });
}

/// The newest threads of the folder that no pane shows, for picking one up again.
export function earlierSessions(
  sessions: readonly ChatSession[],
  shownSessionIds: ReadonlySet<string>,
  filter: string,
): ChatSession[] {
  const needle = filter.trim().toLowerCase();
  return [...sessions]
    .filter(
      (session) =>
        !shownSessionIds.has(session.id) &&
        !session.archived &&
        !session.parentId &&
        matches(session, needle),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, EARLIER_LIMIT);
}
