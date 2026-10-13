import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useAgentStore } from "@/features/agent/store";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { sessionEnvironment } from "./cwd";

interface TeardownResult {
  ok: boolean;
  log: string;
}

/** Runs the teardown script, removes the worktree and moves its threads back to the checkout. */
export async function removeSessionWorktree(
  rootPath: string,
  session: ChatSession,
  force: boolean,
): Promise<boolean> {
  const store = useAIStore.getState();
  const worktree = sessionEnvironment(session, store.workEnvironments);
  if (worktree?.kind !== "worktree") return false;

  const users = store.chatSessions.filter((item) => item.environmentId === worktree.id);
  const agent = useAgentStore.getState();
  if (users.some((item) => item.id === agent.runSessionId)) agent.requestStop();

  const teardown = await invoke<TeardownResult>("git_session_worktree_teardown", {
    repoPath: rootPath,
    worktreePath: worktree.path,
  });
  if (!teardown.ok) {
    toast.error(teardown.log || "Could not tear down the worktree");
    return false;
  }

  await invoke("git_session_worktree_remove", {
    repoPath: rootPath,
    worktreePath: worktree.path,
    force,
  });

  for (const user of users) {
    await store.updateChatSession(rootPath, {
      ...user,
      environment: "checkout",
      environmentId: undefined,
      updatedAt: Date.now(),
    });
  }
  await store.deleteEnvironment(rootPath, worktree.id);
  return true;
}
