import { useAgentStore } from "@/features/agent/store";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { disposeTerminal } from "../terminal/runner";
import { releaseWorktrees } from "../worktree/cleanup";
import { childSessions, descendantIds } from "./limits";
import { getChildRun, isRunLive } from "./runStore";

/// Stops whatever a session is running: its background run, its terminal, or the focused turn.
export function stopSession(sessionId: string): void {
  // A live run means the runner is already loaded, so this keeps the AI SDK out of startup.
  if (isRunLive(getChildRun(sessionId))) {
    void import("./runner").then((m) => m.stopChildRun(sessionId));
  }
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
    const archived = chatSessions.filter((item) => ids.has(item.id) && !item.archived);
    for (const child of archived) {
      stopSession(child.id);
      await updateChatSession({ ...child, archived: true, updatedAt: now });
    }
    await releaseWorktrees(rootPath, archived);
    return;
  }

  for (const child of outsideChildren(chatSessions, parentIds)) {
    const unlinked = { ...child, updatedAt: now };
    delete unlinked.parentId;
    await updateChatSession(unlinked);
  }
}
