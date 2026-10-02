import { useEffect, useMemo, useState } from "react";

import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { collectLeaves } from "../panes/layout";
import { useAgentsPanesStore } from "../panes/store";
import { getTerminalEntryStatus, subscribeTerminalStatus } from "./runner";
import { staleTerminalIds } from "./staleTerminals";

function isRunning(sessionId: string): boolean {
  return getTerminalEntryStatus(sessionId) === "running";
}

function openSessionIds(rootPath: string): Set<string> {
  const root = useAgentsPanesStore.getState().trees[rootPath]?.root ?? null;
  return new Set(collectLeaves(root).flatMap((leaf) => (leaf.sessionId ? [leaf.sessionId] : [])));
}

/// Terminal sessions to hide from the thread list, updated when their process exits.
export function useStaleTerminalIds(sessions: ChatSession[], rootPath: string): Set<string> {
  const root = useAgentsPanesStore((state) => state.trees[rootPath]?.root ?? null);
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
      collectLeaves(root).flatMap((leaf) => (leaf.sessionId ? [leaf.sessionId] : [])),
    );
    return new Set(staleTerminalIds(sessions, open, isRunning));
    // statusVersion re-reads the terminal statuses, which live outside React.
  }, [root, sessions, statusVersion]);
}

/// Deletes standalone terminal sessions of the folder that are neither open nor running.
export async function purgeStaleTerminals(rootPath: string): Promise<void> {
  const { chatSessions, deleteSession } = useAIStore.getState();
  const ids = staleTerminalIds(chatSessions, openSessionIds(rootPath), isRunning);
  for (const id of ids) await deleteSession(rootPath, id);
}
