import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useAgentStore } from "@/features/agent/store";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";

interface TeardownResult {
  ok: boolean;
  log: string;
}

/** Runs the teardown script, removes the worktree and moves the thread back to the checkout. */
export async function removeSessionWorktree(
  rootPath: string,
  session: ChatSession,
  force: boolean,
): Promise<boolean> {
  if (!session.worktree) return false;

  const agent = useAgentStore.getState();
  if (agent.runSessionId === session.id) agent.requestStop();

  const teardown = await invoke<TeardownResult>("git_session_worktree_teardown", {
    repoPath: rootPath,
    worktreePath: session.worktree.path,
  });
  if (!teardown.ok) {
    toast.error(teardown.log || "Could not tear down the worktree");
    return false;
  }

  await invoke("git_session_worktree_remove", {
    repoPath: rootPath,
    worktreePath: session.worktree.path,
    force,
  });

  await useAIStore.getState().updateChatSession(rootPath, {
    ...session,
    environment: "checkout",
    worktree: null,
    updatedAt: Date.now(),
  });
  return true;
}
