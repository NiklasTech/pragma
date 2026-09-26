import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import type { WorktreeChoice } from "./choice";

interface WorktreeCreateResponse {
  branch: string;
  path: string;
  setup_log: string;
  status: "ready" | "error";
}

export async function createSessionForChoice(
  rootPath: string,
  choice: WorktreeChoice,
): Promise<ChatSession | null> {
  const { createChatSession } = useAIStore.getState();

  if (choice === "checkout") {
    return createChatSession(rootPath, { kind: "agent", environment: "checkout" });
  }

  const id = crypto.randomUUID();

  let created: WorktreeCreateResponse;
  try {
    created = await invoke<WorktreeCreateResponse>("git_session_worktree_create", {
      repoPath: rootPath,
      sessionId: id,
    });
  } catch {
    toast.error("Could not create a worktree for this thread");
    return null;
  }

  return createChatSession(rootPath, {
    id,
    kind: "agent",
    environment: "worktree",
    worktree: {
      branch: created.branch,
      path: created.path,
      setupLog: created.setup_log,
      status: created.status,
    },
  });
}
