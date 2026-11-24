import { useMemo } from "react";

import { useAgentStore } from "@/features/agent/store";

import { useAcpApprovalsStore } from "../acp/acpApprovals";
import { useSpawnApprovalsStore } from "../children/acpSpawn";
import { useChildRunsStore } from "../children/runStore";
import { useBackgroundChatsStore } from "../live/backgroundChats";
import { useSessionRunsStore } from "../tasks/sessionRuns";
import { resolveSessionActivity, type SessionActivity } from "./activity";

export function readSessionActivity(): SessionActivity {
  const agent = useAgentStore.getState();
  return resolveSessionActivity({
    liveSessionId: useSessionRunsStore.getState().liveSessionId,
    backgroundChats: useBackgroundChatsStore.getState().running,
    agentStatus: agent.status,
    runSessionId: agent.runSessionId,
    runs: useChildRunsStore.getState().runs,
    spawnApprovals: useSpawnApprovalsStore.getState().bySession,
    acpApprovals: useAcpApprovalsStore.getState().bySession,
  });
}

export function useSessionActivity(): SessionActivity {
  const liveSessionId = useSessionRunsStore((state) => state.liveSessionId);
  const backgroundChats = useBackgroundChatsStore((state) => state.running);
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const runs = useChildRunsStore((state) => state.runs);
  const spawnApprovals = useSpawnApprovalsStore((state) => state.bySession);
  const acpApprovals = useAcpApprovalsStore((state) => state.bySession);

  return useMemo(
    () =>
      resolveSessionActivity({
        liveSessionId,
        backgroundChats,
        agentStatus,
        runSessionId,
        runs,
        spawnApprovals,
        acpApprovals,
      }),
    [agentStatus, backgroundChats, liveSessionId, runSessionId, runs, spawnApprovals, acpApprovals],
  );
}
