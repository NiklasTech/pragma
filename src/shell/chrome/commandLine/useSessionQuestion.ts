import { useAcpApprovalsStore } from "@/features/ai/acp/acpApprovals";
import { useSpawnApprovalsStore } from "@/features/ai/children/acpSpawn";

import type { Question } from "./question";

/// What a session asks: a permission it waits for, else a plain "needs you".
export function useSessionQuestion(sessionId: string): Question {
  const acp = useAcpApprovalsStore((state) => state.bySession[sessionId]?.[0]);
  const spawn = useSpawnApprovalsStore((state) => state.bySession[sessionId]?.[0]);
  // Answered by session; the pane position only matters for "go to".
  const entry = { sessionId, leafId: "", tabId: "", tabNumber: 0 };
  if (acp) return { kind: "acp", entry, approval: acp };
  if (spawn) return { kind: "spawn", entry, approval: spawn };
  return { kind: "attention", entry };
}
