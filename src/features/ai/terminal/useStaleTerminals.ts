import { useEffect, useMemo, useState } from "react";

import { repositorySessions, useAIStore, type ChatSession } from "@/shared/stores/ai";

import { collectLeaves } from "../panes/layout";
import { useAgentsPanesStore, type PaneTreeEntry } from "../panes/store";
import { releaseWorktrees } from "../worktree/cleanup";
import { disposeTerminal, getTerminalEntryStatus, subscribeTerminalStatus } from "./runner";
import { isKeptForResume, staleTerminalIds } from "./staleTerminals";

function isRunning(sessionId: string): boolean {
  return getTerminalEntryStatus(sessionId) === "running";
}

/// Sessions in a pane of any tab; a tab that was not shown since the start has not started its terminals yet.
function openSessionIds(trees: Record<string, PaneTreeEntry>): Set<string> {
  return new Set(
    Object.values(trees).flatMap((entry) =>
      collectLeaves(entry.root).flatMap((leaf) => (leaf.sessionId ? [leaf.sessionId] : [])),
    ),
  );
}

/// Terminal sessions to hide from the thread list, updated when their process exits; open in the pane layout of any repository counts.
export function useStaleTerminalIds(sessions: ChatSession[]): Set<string> {
  const trees = useAgentsPanesStore((state) => state.trees);
  const [statusVersion, setStatusVersion] = useState(0);

  const terminalKey = sessions
    .filter((session) => session.kind === "terminal" && !session.parentId)
    .map((session) => session.id)
    .join("\n");

  useEffect(() => {
    if (!terminalKey) return;
    const unsubscribes = terminalKey
      .split("\n")
      .map((id) => subscribeTerminalStatus(id, () => setStatusVersion((value) => value + 1)));
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [terminalKey]);

  return useMemo(() => {
    return new Set(staleTerminalIds(sessions, openSessionIds(trees), isRunning));
    // statusVersion re-reads the terminal statuses, which live outside React.
  }, [trees, sessions, statusVersion]);
}

/// Deletes standalone terminal sessions of the folder that are neither open nor running.
export async function purgeStaleTerminals(rootPath: string): Promise<void> {
  const { chatSessions, deleteSession } = useAIStore.getState();
  const sessions = repositorySessions(chatSessions, rootPath);
  const open = openSessionIds(useAgentsPanesStore.getState().trees);
  const ids = new Set(staleTerminalIds(sessions, open, isRunning));
  const stale = sessions.filter((session) => ids.has(session.id));
  // Opening a kept conversation again has to start its CLI, not show the ended one.
  for (const session of sessions) {
    if (open.has(session.id) || ids.has(session.id) || isRunning(session.id)) continue;
    if (isKeptForResume(session, Date.now())) disposeTerminal(session.id);
  }
  for (const session of stale) await deleteSession(session.id);
  await releaseWorktrees(rootPath, stale);
}
