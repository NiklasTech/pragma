import { useEffect, useMemo, useState } from "react";

import { useAgentStore } from "@/features/agent/store";
import type { ChatSession } from "@/shared/stores/ai";

import { getTerminalEntryStatus, subscribeTerminalStatus } from "../terminal/runner";
import { useChildRunsStore } from "./runStore";
import { resolveChildStatus, type ChildSessionStatus } from "./status";

type StatusSession = Pick<ChatSession, "id" | "kind">;

export function useSessionStatuses(sessions: StatusSession[]): Map<string, ChildSessionStatus> {
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const runs = useChildRunsStore((state) => state.runs);
  const [terminalVersion, setTerminalVersion] = useState(0);

  const terminalKey = sessions
    .filter((session) => session.kind === "terminal")
    .map((session) => session.id)
    .join("\n");

  useEffect(() => {
    if (!terminalKey) return;
    const unsubscribes = terminalKey
      .split("\n")
      .map((id) => subscribeTerminalStatus(id, () => setTerminalVersion((value) => value + 1)));
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [terminalKey]);

  return useMemo(() => {
    const statuses = new Map<string, ChildSessionStatus>();
    for (const session of sessions) {
      const terminalStatus =
        session.kind === "terminal" ? getTerminalEntryStatus(session.id) : null;
      statuses.set(
        session.id,
        resolveChildStatus(
          session,
          agentStatus,
          runSessionId,
          terminalStatus,
          runs[session.id]?.status ?? null,
        ),
      );
    }
    return statuses;
    // terminalVersion re-reads the terminal statuses, which live outside React.
  }, [agentStatus, runSessionId, runs, sessions, terminalVersion]);
}
