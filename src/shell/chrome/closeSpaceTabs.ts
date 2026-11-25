import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import { collectLeaves } from "@/features/ai/panes/layout";
import { useAgentsPanesStore, type PaneTreeEntry } from "@/features/ai/panes/store";
import { stopSessions } from "@/features/ai/sessions/runningSessions";
import { useAgentStatesStore } from "@/features/ai/state/agentStates";
import { getTerminalEntryStatus, getTerminalPtyId } from "@/features/ai/terminal/runner";
import { isShellSession } from "@/features/ai/terminal/shell";
import { purgeStaleTerminals } from "@/features/ai/terminal/useStaleTerminals";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import type { AgentState } from "@/shared/components/ui/status-dot";

interface CloseTabsRequest {
  spaceId: string;
  tabIds: string[];
  /** Titles of the sessions that would be stopped in the middle of something. */
  busy: string[];
}

/// Tabs the user asked to close while something still works in them.
export const useCloseTabsRequestStore = create<{ request: CloseTabsRequest | null }>()(() => ({
  request: null,
}));

/// The sessions only these tabs show; one that another tab shows too is left alone.
export function sessionsOnlyIn(
  tabIds: readonly string[],
  trees: Readonly<Record<string, PaneTreeEntry>>,
): string[] {
  const inTabs = (ids: readonly string[]) =>
    ids.flatMap((id) =>
      collectLeaves(trees[id]?.root ?? null).flatMap((leaf) =>
        leaf.sessionId === null ? [] : [leaf.sessionId],
      ),
    );
  const elsewhere = new Set(inTabs(Object.keys(trees).filter((id) => !tabIds.includes(id))));
  return [...new Set(inTabs(tabIds))].filter((id) => !elsewhere.has(id));
}

/// An agent in the middle of a turn or a question, or a shell that runs a program.
export function isBusy(
  session: ChatSession,
  state: AgentState | undefined,
  shellProgram: boolean,
): boolean {
  if (isShellSession(session)) return shellProgram;
  return state === "working" || state === "needs-you";
}

async function runsProgram(sessionId: string): Promise<boolean> {
  const id = getTerminalPtyId(sessionId);
  if (!id || getTerminalEntryStatus(sessionId) !== "running") return false;
  // Without an answer the shell counts as busy, so nothing is stopped unasked.
  return invoke<string[] | null>("pty_foreground_process", { id })
    .then((names) => names !== null)
    .catch(() => true);
}

/// Closes tabs and stops what runs in them; asks first while something works.
export async function requestCloseTabs(spaceId: string, tabIds: string[]): Promise<void> {
  const ids = new Set(sessionsOnlyIn(tabIds, useAgentsPanesStore.getState().trees));
  const sessions = useAIStore.getState().chatSessions.filter((session) => ids.has(session.id));
  const states = useAgentStatesStore.getState().entries;
  const busy: string[] = [];
  for (const session of sessions) {
    const shellProgram = isShellSession(session) && (await runsProgram(session.id));
    if (isBusy(session, states[session.id]?.state, shellProgram)) busy.push(session.title);
  }
  if (busy.length > 0) {
    useCloseTabsRequestStore.setState({ request: { spaceId, tabIds, busy } });
    return;
  }
  closeTabsNow(spaceId, tabIds);
}

export function closeTabsNow(spaceId: string, tabIds: string[]): void {
  const ids = sessionsOnlyIn(tabIds, useAgentsPanesStore.getState().trees);
  const sessions = useAIStore.getState().chatSessions.filter((session) => ids.includes(session.id));
  for (const tabId of tabIds) {
    useOpenRepositoriesStore.getState().closeTab(spaceId, tabId);
    useAgentsPanesStore.getState().removeTree(tabId);
  }
  stopSessions(ids);
  for (const rootPath of new Set(sessions.map((session) => session.rootPath))) {
    void purgeStaleTerminals(rootPath).catch(() => {});
  }
}
