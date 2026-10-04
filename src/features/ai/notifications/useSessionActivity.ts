import { useMemo } from "react";

import { useAgentStore } from "@/features/agent/store";

import { useSpawnApprovalsStore } from "../children/acpSpawn";
import { useChildRunsStore } from "../children/runStore";
import { useSessionRunsStore } from "../tasks/sessionRuns";
import { resolveSessionActivity, type SessionActivity } from "./activity";

export function readSessionActivity(): SessionActivity {
  const agent = useAgentStore.getState();
  return resolveSessionActivity({
    liveSessionId: useSessionRunsStore.getState().liveSessionId,
    agentStatus: agent.status,
    runSessionId: agent.runSessionId,
    runs: useChildRunsStore.getState().runs,
    spawnApprovals: useSpawnApprovalsStore.getState().bySession,
  });
}

export function useSessionActivity(): SessionActivity {
  const liveSessionId = useSessionRunsStore((state) => state.liveSessionId);
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const runs = useChildRunsStore((state) => state.runs);
  const spawnApprovals = useSpawnApprovalsStore((state) => state.bySession);

  return useMemo(
    () =>
      resolveSessionActivity({ liveSessionId, agentStatus, runSessionId, runs, spawnApprovals }),
    [agentStatus, liveSessionId, runSessionId, runs, spawnApprovals],
  );
}
