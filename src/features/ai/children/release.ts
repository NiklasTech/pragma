import { useAgentStore } from "@/features/agent/store";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { disposeTerminal } from "../terminal/runner";
import { childSessions, descendantIds } from "./limits";
import { stopChildRun } from "./runner";

/// Stops whatever a session is running: its background run, its terminal, or the focused turn.
export function stopSession(rootPath: string, sessionId: string): void {
  stopChildRun(rootPath, sessionId);
  disposeTerminal(sessionId);
  const agent = useAgentStore.getState();
  if (agent.runSessionId === sessionId) agent.requestStop();
}

/// Direct children of the given sessions that are not in that set themselves.
export function outsideChildren(sessions: ChatSession[], parentIds: string[]): ChatSession[] {
  return parentIds
    .flatMap((parentId) => childSessions(sessions, parentId))
    .filter((child) => !parentIds.includes(child.id));
}

/// Archives and stops the sessions' descendants, or keeps the children without a parent link.
export async function releaseChildren(
  rootPath: string,
  parentIds: string[],
  archive: boolean,
): Promise<void> {
  const { chatSessions, updateChatSession } = useAIStore.getState();
  const now = Date.now();

  if (archive) {
    const ids = new Set(parentIds.flatMap((parentId) => descendantIds(chatSessions, parentId)));
    for (const parentId of parentIds) ids.delete(parentId);
    for (const child of chatSessions.filter((item) => ids.has(item.id) && !item.archived)) {
      stopSession(rootPath, child.id);
      await updateChatSession(rootPath, { ...child, archived: true, updatedAt: now });
    }
    return;
  }

  for (const child of outsideChildren(chatSessions, parentIds)) {
    const unlinked = { ...child, updatedAt: now };
    delete unlinked.parentId;
    await updateChatSession(rootPath, unlinked);
  }
}
