import { create } from "zustand";

import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { resolveSpawnApproval, useSpawnApprovalsStore } from "../children/acpSpawn";
import { stopSession } from "../children/release";
import type { SessionActivity } from "../notifications/activity";
import { readSessionActivity } from "../notifications/useSessionActivity";
import { stopLiveSession } from "../tasks/sessionRuns";
import { getTerminalEntryStatus } from "../terminal/runner";

/// Sessions of the repository that run, wait for the user, or keep a terminal running.
export function selectRunningSessions(
  sessions: readonly ChatSession[],
  rootPath: string,
  activity: SessionActivity,
  isTerminalRunning: (sessionId: string) => boolean,
): ChatSession[] {
  const live = new Set([...activity.running, ...activity.waiting]);
  return sessions.filter(
    (session) =>
      session.rootPath === rootPath &&
      (live.has(session.id) || (session.kind === "terminal" && isTerminalRunning(session.id))),
  );
}

export function runningRepositorySessions(rootPath: string): ChatSession[] {
  return selectRunningSessions(
    useAIStore.getState().chatSessions,
    rootPath,
    readSessionActivity(),
    (sessionId) => getTerminalEntryStatus(sessionId) === "running",
  );
}

/// Stops each session's run, terminal and streaming chat, and denies the child sessions it asked for.
export function stopSessions(sessionIds: readonly string[]): void {
  for (const sessionId of sessionIds) {
    stopSession(sessionId);
    stopLiveSession(sessionId);
    const approvals = useSpawnApprovalsStore.getState().bySession[sessionId] ?? [];
    for (const approval of approvals) {
      resolveSpawnApproval(sessionId, approval.toolCallId, false);
    }
  }
}

interface CloseRepositoryRequest {
  path: string;
  sessionIds: string[];
}

interface CloseRepositoryRequestState {
  request: CloseRepositoryRequest | null;
}

/// A repository the user asked to close while sessions still run in it.
export const useCloseRepositoryRequestStore = create<CloseRepositoryRequestState>()(() => ({
  request: null,
}));
