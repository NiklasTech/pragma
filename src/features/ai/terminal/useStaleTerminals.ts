import { useEffect, useMemo, useState } from "react";

import { repositorySessions, useAIStore, type ChatSession } from "@/shared/stores/ai";

import { collectLeaves } from "../panes/layout";
import { useAgentsPanesStore } from "../panes/store";
import { releaseWorktrees } from "../worktree/cleanup";
import { getTerminalEntryStatus, subscribeTerminalStatus } from "./runner";
import { staleTerminalIds } from "./staleTerminals";

function isRunning(sessionId: string): boolean {
  return getTerminalEntryStatus(sessionId) === "running";
}

function openSessionIds(rootPath: string): Set<string> {
  const root = useAgentsPanesStore.getState().trees[rootPath]?.root ?? null;
  return new Set(collectLeaves(root).flatMap((leaf) => (leaf.sessionId ? [leaf.sessionId] : [])));
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
    const open = new Set(
      Object.values(trees).flatMap((entry) =>
        collectLeaves(entry.root).flatMap((leaf) => (leaf.sessionId ? [leaf.sessionId] : [])),
      ),
    );
    return new Set(staleTerminalIds(sessions, open, isRunning));
    // statusVersion re-reads the terminal statuses, which live outside React.
  }, [trees, sessions, statusVersion]);
}

/// Deletes standalone terminal sessions of the folder that are neither open nor running.
export async function purgeStaleTerminals(rootPath: string): Promise<void> {
  const { chatSessions, deleteSession } = useAIStore.getState();
  const sessions = repositorySessions(chatSessions, rootPath);
  const ids = new Set(staleTerminalIds(sessions, openSessionIds(rootPath), isRunning));
  const stale = sessions.filter((session) => ids.has(session.id));
  for (const session of stale) await deleteSession(session.id);
  await releaseWorktrees(rootPath, stale);
}
